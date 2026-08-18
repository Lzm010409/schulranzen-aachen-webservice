/**
 * Normalisierung der Freitextfelder. Bewusst frei von Framework-Abhaengigkeiten,
 * damit sowohl die Formulare als auch der ETL-Import dieselben Regeln nutzen.
 */

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

const EMAIL_PATTERN =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

export function isValidEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

/**
 * Bringt deutsche Schreibweisen (0241/..., +49 241 ..., (0241) ...) auf E.164.
 * Nicht deutbare Eingaben werden unveraendert zurueckgegeben statt verworfen —
 * eine unschoene Nummer ist besser als eine geloeschte.
 */
export function normalizePhone(
  value: string | null | undefined,
  defaultCountry = "49",
): string | null {
  const raw = value?.trim() ?? "";
  if (!raw) return null;

  const hasPlus = raw.startsWith("+") || raw.startsWith("00");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 5) return raw;

  if (hasPlus) {
    const international = raw.startsWith("00") ? digits.slice(2) : digits;
    return `+${international}`;
  }
  if (digits.startsWith("0")) {
    return `+${defaultCountry}${digits.slice(1)}`;
  }
  return `+${defaultCountry}${digits}`;
}

export function normalizeZip(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.slice(0, 5);
}

export function isValidGermanZip(value: string): boolean {
  return /^\d{5}$/.test(value);
}

/**
 * Schluessel fuer die Duplikaterkennung von Produkten: kleingeschrieben,
 * Umlaute aufgeloest, Sonderzeichen zu Bindestrichen.
 */
export function productSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Schluessel fuer die Kundendublettenpruefung ohne E-Mail-Adresse. */
export function customerIdentityKey(input: {
  firstName: string;
  lastName: string;
  zip: string;
}): string {
  return [
    productSlug(input.firstName),
    productSlug(input.lastName),
    normalizeZip(input.zip),
  ].join("|");
}

/**
 * Liest eine Anrede aus freiem Text — aus einer Importdatei oder einem
 * Formular. Was sich nicht sicher zuordnen laesst, bleibt unbekannt; eine
 * falsche Anrede faellt beim Empfaenger sofort auf.
 */
export function parseSalutation(
  input: string | null | undefined,
): "FRAU" | "HERR" | "UNBEKANNT" {
  const text = (input ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!text) return "UNBEKANNT";

  if (["frau", "fr", "ms", "mrs", "miss", "w", "weiblich", "f"].includes(text)) {
    return "FRAU";
  }
  if (["herr", "hr", "hrn", "mr", "m", "maennlich", "männlich"].includes(text)) {
    return "HERR";
  }
  return "UNBEKANNT";
}
