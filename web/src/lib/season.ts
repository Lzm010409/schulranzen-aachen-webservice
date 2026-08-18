/**
 * Saison eines Kaufs — der Einschulungsjahrgang.
 *
 * Warum am Kauf und nicht am Produkt: Ein „Ergobag Cubo“ wird über viele Jahre
 * verkauft. Ein einzelnes Saisonfeld am Produkt kann deshalb nur falsch sein.
 * Was den Laden tatsächlich interessiert, hängt am einzelnen Kauf: zu welcher
 * Einschulung wurde dieser Ranzen gekauft? Daran hängt die Frage, die den
 * Rundbrief auslöst — wer vor vier Jahren gekauft hat, braucht bald einen
 * neuen.
 *
 * Die Regel: Die Ranzensaison läuft auf die Einschulung im August zu. Wer im
 * Herbst kauft, kauft für den nächsten August; wer im Frühjahr oder Sommer
 * kauft, für den August desselben Jahres. Also
 *
 *     Kauf im Januar–August  →  Einschulung im selben Jahr
 *     Kauf im September–Dezember  →  Einschulung im Folgejahr
 *
 * Das ist eine Konvention, keine Naturkonstante — deshalb lässt sich die
 * Saison am Kauf von Hand überschreiben.
 */

/** Ab diesem Monat zählt ein Kauf zur Saison des Folgejahres (1 = Januar). */
const NAECHSTE_SAISON_AB_MONAT = 9;

/** Vor diesem Jahr wird keine Saison mehr angenommen — dann ist etwas kaputt. */
const FRUEHESTE_SAISON = 1990;
const SPAETESTE_SAISON = 2100;

/** Leitet die Saison (Einschulungsjahr) aus einem Kaufdatum ab. */
export function seasonOf(purchasedAt: Date | null | undefined): number | null {
  if (!purchasedAt) return null;
  const time = purchasedAt.getTime();
  if (Number.isNaN(time)) return null;

  const year = purchasedAt.getUTCFullYear();
  const month = purchasedAt.getUTCMonth() + 1;
  const season = month >= NAECHSTE_SAISON_AB_MONAT ? year + 1 : year;

  return isValidSeason(season) ? season : null;
}

/** Prueft, ob eine Zahl als Saison taugt. */
export function isValidSeason(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= FRUEHESTE_SAISON &&
    value <= SPAETESTE_SAISON
  );
}

/** Liest eine von Hand eingegebene Saison. Leere Eingabe heisst „ableiten“. */
export function parseSeason(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const text = String(input).trim();
  if (!text) return null;

  // „2025/26“ und „2025/2026“ kommen in Listen vor — das erste Jahr zaehlt.
  const match = text.match(/^(\d{4})/);
  if (!match) return null;

  const value = Number(match[1]);
  return isValidSeason(value) ? value : null;
}

/** Beschriftung fuer die Oberflaeche: „2025/26“. */
export function seasonLabel(season: number | null | undefined): string {
  if (!season) return "—";
  return `${season}/${String((season + 1) % 100).padStart(2, "0")}`;
}
