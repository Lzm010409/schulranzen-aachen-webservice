import "server-only";
import { db } from "./db";
import type { LogLevel } from "@/generated/prisma/client";

/**
 * Anwendungsprotokoll.
 *
 * Das Aenderungsprotokoll (`audit.ts`) haelt fest, wer was getan hat. Hier
 * steht, was die Anwendung selbst gemeldet hat: ein Versand, der nicht
 * durchging, eine Uebernahme, die abbrach, eine Seite, die beim Aufbau
 * scheiterte.
 *
 * Warum in der Datenbank und nicht nur auf der Konsole: die Ausgabe des
 * Containers ist nach dem naechsten Neustart weg, und wer sie lesen wollte,
 * braeuchte Zugriff auf den Server. Der Eintrag steht deshalb dort, wo ihn
 * jemand auch findet — unter Einstellungen → Protokoll.
 *
 * Auf der Konsole landet er trotzdem: wer beim Betrieb zusieht, soll nicht
 * erst in die Oberflaeche wechseln muessen.
 */

/** Lange Meldungen kuerzen — ein Stacktrace kann Kilobytes lang sein. */
const MAX_MESSAGE = 2_000;
const MAX_STACK = 8_000;

export type LogEingabe = {
  /** Woher die Meldung kommt: "worker", "mailer", "import", "oberflaeche", … */
  source: string;
  message: string;
  /** Zusatzangaben zum Einordnen. Keine Passwoerter, keine Mailinhalte. */
  context?: Record<string, unknown>;
  /** Der aufgetretene Fehler; daraus werden Meldung und Aufrufliste ergaenzt. */
  error?: unknown;
  /** Wer es ausgeloest hat, soweit bekannt. Der Worker laeuft ohne Benutzer. */
  userId?: string | null;
};

function kuerzen(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)} …` : value;
}

/** Macht aus einem geworfenen Wert eine lesbare Meldung. */
export function fehlerText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    // `JSON.stringify` liefert bei undefined und bei Funktionen nichts —
    // die Rueckgabe waere dann keine Zeichenkette mehr.
    return JSON.stringify(error) ?? String(error);
  } catch {
    // Zirkulaere Verweise.
    return String(error);
  }
}

async function schreiben(level: LogLevel, input: LogEingabe): Promise<void> {
  const details = input.error ? fehlerText(input.error) : "";
  const message = kuerzen(
    details && details !== input.message
      ? `${input.message}: ${details}`
      : input.message,
    MAX_MESSAGE,
  );
  const stack =
    input.error instanceof Error && input.error.stack
      ? kuerzen(input.error.stack, MAX_STACK)
      : null;

  const konsole = level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.info;
  konsole(`[${input.source}] ${message}`, input.context ?? "");

  try {
    await db.appLog.create({
      data: {
        level,
        source: input.source.slice(0, 60),
        message,
        context: (input.context as never) ?? undefined,
        stack,
        userId: input.userId ?? null,
      },
    });
  } catch (error) {
    // Ein Protokolleintrag darf nie die Aktion kippen, die ihn ausgeloest hat —
    // und erst recht keine Schleife ausloesen, indem er sich selbst meldet.
    console.error("[protokoll] Eintrag konnte nicht geschrieben werden", error);
  }
}

export const log = {
  info: (input: LogEingabe) => schreiben("INFO", input),
  warn: (input: LogEingabe) => schreiben("WARN", input),
  error: (input: LogEingabe) => schreiben("ERROR", input),
};

/**
 * Raeumt alte Eintraege weg.
 *
 * Ohne das waechst die Tabelle unbegrenzt: ein Versandlauf mit ein paar
 * tausend Empfaengern kann leicht hunderte Zeilen erzeugen. Was aelter ist als
 * die Aufbewahrungsfrist, hilft niemandem mehr bei der Fehlersuche.
 */
export async function raeumeProtokollAuf(tage: number): Promise<number> {
  if (!Number.isFinite(tage) || tage <= 0) return 0;
  const grenze = new Date(Date.now() - tage * 24 * 60 * 60 * 1000);
  const { count } = await db.appLog.deleteMany({
    where: { createdAt: { lt: grenze } },
  });
  return count;
}
