import "server-only";
import { headers } from "next/headers";
import { db } from "./db";
import type { AuditAction } from "@/generated/prisma/client";

type Scalar = string | number | boolean | Date | null | undefined | bigint;

/**
 * Vergleicht zwei Zustaende und liefert nur die tatsaechlich geaenderten Felder.
 * Ohne Aenderung `null`, damit der Aufrufer den Log-Eintrag ganz weglassen kann.
 */
export function diffOf<T extends Record<string, Scalar>>(
  before: T | null,
  after: T,
): Record<string, { von: unknown; auf: unknown }> | null {
  const out: Record<string, { von: unknown; auf: unknown }> = {};
  for (const [key, next] of Object.entries(after)) {
    const prev = before ? before[key as keyof T] : undefined;
    const a = prev instanceof Date ? prev.toISOString() : prev;
    const b = next instanceof Date ? next.toISOString() : next;
    if (String(a ?? "") !== String(b ?? "")) {
      out[key] = { von: a ?? null, auf: b ?? null };
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function recordAudit(input: {
  userId: string | null;
  entity: string;
  entityId?: string | null;
  action: AuditAction;
  diff?: unknown;
}): Promise<void> {
  let ip: string | null = null;
  try {
    const h = await headers();
    ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? null)
      ?.trim() ?? null;
  } catch {
    // Ausserhalb eines Requests (z. B. im Worker) gibt es keine Header.
  }

  await db.auditLog
    .create({
      data: {
        userId: input.userId,
        entity: input.entity,
        entityId: input.entityId ?? null,
        action: input.action,
        diff: (input.diff as never) ?? undefined,
        ip,
      },
    })
    // Ein fehlgeschlagenes Protokoll darf die fachliche Aktion nicht kippen —
    // aber es darf auch nicht spurlos bleiben.
    .catch(async (error) => {
      const { log } = await import("./log");
      await log.error({
        source: "protokoll",
        message: `Änderungsprotokoll konnte nicht geschrieben werden (${input.entity}, ${input.action})`,
        error,
        userId: input.userId,
      });
    });
}
