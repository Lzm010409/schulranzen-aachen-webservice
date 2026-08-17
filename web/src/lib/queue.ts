import "server-only";
import { db } from "./db";
import { buildWhere, type CustomerFilter } from "./customer-filter";
import type { Prisma } from "@/generated/prisma/client";

export type SkipReason =
  | "keine E-Mail-Adresse"
  | "abgemeldet"
  | "Zustellung dauerhaft fehlgeschlagen";

export type EnqueueResult = {
  queued: number;
  skipped: Record<SkipReason, number>;
  total: number;
};

const EMPTY_SKIPS: Record<SkipReason, number> = {
  "keine E-Mail-Adresse": 0,
  abgemeldet: 0,
  "Zustellung dauerhaft fehlgeschlagen": 0,
};

function classify(customer: {
  email: string | null;
  unsubscribedAt: Date | null;
  bouncedAt: Date | null;
}): SkipReason | null {
  if (!customer.email) return "keine E-Mail-Adresse";
  if (customer.unsubscribedAt) return "abgemeldet";
  if (customer.bouncedAt) return "Zustellung dauerhaft fehlgeschlagen";
  return null;
}

/**
 * Ermittelt die Empfaenger einer Kampagne und legt fuer jeden eine Job-Zeile an.
 * Das Ergebnis nennt die Zahl der uebersprungenen Empfaenger nach Grund, damit
 * der Nutzer vor dem Absenden sieht, was tatsaechlich passiert.
 *
 * Der Aufruf ist wiederholbar: `skipDuplicates` verhindert doppelte Jobs,
 * ein zweiter Klick kann also keinen Doppelversand ausloesen.
 */
export async function enqueueRecipients(
  campaignId: string,
  selection: { customerIds: string[] } | { filter: CustomerFilter },
): Promise<EnqueueResult> {
  const where: Prisma.CustomerWhereInput =
    "customerIds" in selection
      ? { id: { in: selection.customerIds }, deletedAt: null }
      : buildWhere(selection.filter);

  const customers = await db.customer.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      unsubscribedAt: true,
      bouncedAt: true,
    },
  });

  const skipped = { ...EMPTY_SKIPS };
  const rows: Prisma.MailJobCreateManyInput[] = [];

  for (const customer of customers) {
    const reason = classify(customer);
    if (reason) {
      skipped[reason] += 1;
      continue;
    }
    rows.push({
      campaignId,
      customerId: customer.id,
      toEmail: customer.email as string,
      toName: [customer.firstName, customer.lastName].filter(Boolean).join(" "),
    });
  }

  let queued = 0;
  if (rows.length > 0) {
    const created = await db.mailJob.createMany({
      data: rows,
      skipDuplicates: true,
    });
    queued = created.count;
  }

  return { queued, skipped, total: customers.length };
}

/** Zaehlt die Jobs einer Kampagne nach Status fuer die Fortschrittsanzeige. */
export async function campaignProgress(campaignId: string) {
  const grouped = await db.mailJob.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true },
  });

  const counts = {
    PENDING: 0,
    SENDING: 0,
    SENT: 0,
    FAILED: 0,
    SKIPPED: 0,
  };
  for (const row of grouped) {
    counts[row.status] = row._count._all;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const done = counts.SENT + counts.FAILED + counts.SKIPPED;
  return {
    ...counts,
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    finished: total > 0 && counts.PENDING === 0 && counts.SENDING === 0,
  };
}

/** Setzt fehlgeschlagene Jobs zurueck, damit nur sie erneut versendet werden. */
export async function retryFailed(campaignId: string): Promise<number> {
  const result = await db.mailJob.updateMany({
    where: { campaignId, status: "FAILED" },
    data: {
      status: "PENDING",
      attempts: 0,
      error: null,
      nextAttemptAt: new Date(),
    },
  });
  if (result.count > 0) {
    await db.campaign.update({
      where: { id: campaignId },
      data: { status: "SENDING", finishedAt: null },
    });
  }
  return result.count;
}
