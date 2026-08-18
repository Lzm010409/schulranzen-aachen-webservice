/**
 * Zerlegt eine Liste in Portionen fester Groesse.
 *
 * Gebraucht wird das ueberall dort, wo eine Menge Datensaetze auf einmal in
 * die Datenbank geht: Postgres nimmt pro Anweisung hoechstens 32.767
 * Platzhalter entgegen. Ein `createMany` mit 12.000 Zeilen ueberschreitet das
 * und bricht mit einem Fehler ab, der nichts ueber die Ursache verraet.
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error("Portionsgröße muss mindestens 1 sein.");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
