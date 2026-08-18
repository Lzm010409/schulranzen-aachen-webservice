/**
 * Portionierung fuer den Import.
 *
 * Ein Bestand aus dem Altsystem kann weit ueber 10.000 Zeilen haben. Wird so
 * etwas am Stueck verarbeitet, entsteht entweder eine Abfrage mit zehntausend
 * ODER-Zweigen oder eine Transaktion, die minutenlang Sperren haelt. Beides
 * geht schief, lange bevor die Daten es tun. Deshalb laeuft alles portionsweise:
 * gesucht wird in Portionen, geschrieben wird in Portionen.
 */
export { chunk } from "../chunk";

/** Zeilen je Suchabfrage (E-Mail- und Namensabgleich gegen den Bestand). */
export const LOOKUP_CHUNK = 200;

/** Kunden je Schreibtransaktion. */
export const WRITE_CHUNK = 250;

/** Fortschritt eines laufenden Imports. */
export type ProgressReporter = (done: number, total: number) => void;
