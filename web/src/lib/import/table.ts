/**
 * Einlesen tabellarischer Dateien (CSV und Excel) fuer den allgemeinen Import.
 * Bewusst ohne Server-Abhaengigkeiten, damit die Zerlegung testbar bleibt.
 */

export type Table = { headers: string[]; rows: string[][] };

/**
 * Erkennt das Trennzeichen anhand der Kopfzeile. Deutsche Excel-Exporte nutzen
 * Semikolon, internationale Werkzeuge Komma; Tabulator kommt bei Kopien aus
 * Tabellen vor.
 */
export function detectDelimiter(firstLine: string): string {
  const candidates = [";", ",", "\t", "|"];
  let best = ";";
  let bestCount = -1;
  for (const candidate of candidates) {
    // Zeichen innerhalb von Anfuehrungszeichen zaehlen nicht mit.
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const char = firstLine[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && char === candidate) {
        count++;
      }
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return bestCount > 0 ? best : ";";
}

/** Vollstaendiger CSV-Parser: Anfuehrungszeichen, verdoppelte Quotes, CRLF. */
export function parseCsv(input: string, delimiter?: string): Table {
  // BOM entfernen — Excel schreibt es, sonst heisst die erste Spalte "﻿Vorname".
  const text = input.replace(/^﻿/, "");
  const firstLineEnd = text.search(/\r?\n/);
  const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const sep = delimiter ?? detectDelimiter(firstLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === sep) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // Teil eines CRLF; das \n schliesst die Zeile ab.
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Leerzeilen am Ende verwerfen.
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c.trim() === "")) {
    rows.pop();
  }

  if (rows.length === 0) return { headers: [], rows: [] };

  const headers = rows[0].map((h) => h.trim());
  return { headers, rows: rows.slice(1) };
}

/**
 * Felder des Zielmodells und die Kopfzeilen, unter denen sie ueblicherweise
 * auftauchen — inklusive der Schreibweisen aus dem CSV-Export des Altsystems.
 */
export const IMPORT_FIELDS = [
  {
    key: "firstName",
    label: "Vorname",
    required: true,
    aliases: ["vorname", "first name", "firstname", "given name"],
  },
  {
    key: "lastName",
    label: "Nachname",
    required: true,
    aliases: ["nachname", "name", "last name", "lastname", "surname", "familienname"],
  },
  {
    key: "street",
    label: "Adresse",
    required: false,
    aliases: ["adresse", "strasse", "straße", "street", "anschrift", "strasse und hausnummer"],
  },
  {
    key: "zip",
    label: "PLZ",
    required: false,
    aliases: ["plz", "postleitzahl", "zip", "postal code"],
  },
  {
    key: "city",
    label: "Stadt",
    required: false,
    aliases: ["stadt", "ort", "city", "wohnort"],
  },
  {
    key: "email",
    label: "E-Mail",
    required: false,
    aliases: ["mail", "e-mail", "email", "e mail", "mailadresse", "e-mail-adresse"],
  },
  {
    key: "phone",
    label: "Telefon",
    required: false,
    aliases: ["telefon", "tel", "phone", "rufnummer", "telefonnummer", "handy"],
  },
  {
    key: "product",
    label: "Produkt",
    required: false,
    aliases: ["produkt", "produkte", "product", "artikel", "ranzen"],
  },
  {
    key: "purchasedAt",
    label: "Kaufdatum",
    required: false,
    aliases: ["kaufdatum", "kaufdaten", "datum", "date", "gekauft am", "kauf"],
  },
  {
    key: "notes",
    label: "Notiz",
    required: false,
    aliases: ["notiz", "notizen", "bemerkung", "kommentar", "hinweis"],
  },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ordnet Kopfzeilen den Zielfeldern zu. Liefert je Feld den Spaltenindex oder
 * -1, wenn nichts passt — der Nutzer kann die Zuordnung danach korrigieren.
 */
export function guessMapping(headers: string[]): Record<ImportField, number> {
  const normalized = headers.map(normalizeHeader);
  const mapping = {} as Record<ImportField, number>;
  const used = new Set<number>();

  for (const field of IMPORT_FIELDS) mapping[field.key] = -1;

  // Zwei Durchgaenge, und zwar in dieser Reihenfolge: erst exakte Treffer fuer
  // *alle* Felder, dann erst Teiltreffer. Andernfalls schnappt sich ein
  // frueheres Feld per Teiltreffer eine Spalte, die ein spaeteres Feld exakt
  // trifft — "Adresse" wuerde sonst die Spalte "E-Mail-Adresse" belegen.
  for (const field of IMPORT_FIELDS) {
    for (const alias of field.aliases) {
      const needle = normalizeHeader(alias);
      const found = normalized.findIndex(
        (header, i) => !used.has(i) && header === needle,
      );
      if (found !== -1) {
        mapping[field.key] = found;
        used.add(found);
        break;
      }
    }
  }

  for (const field of IMPORT_FIELDS) {
    if (mapping[field.key] !== -1) continue;
    for (const alias of field.aliases) {
      const needle = normalizeHeader(alias);
      const found = normalized.findIndex(
        (header, i) => !used.has(i) && header.includes(needle),
      );
      if (found !== -1) {
        mapping[field.key] = found;
        used.add(found);
        break;
      }
    }
  }

  return mapping;
}

/**
 * Deutet ein Datum aus den Schreibweisen, die in Exporten vorkommen:
 * 14.08.2024, 2024-08-14, 14/08/2024 sowie Excel-Serienzahlen.
 */
export function parseImportDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmed);
  if (match) {
    return toDate(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  match = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/.exec(trimmed);
  if (match) {
    let year = Number(match[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return toDate(year, Number(match[2]), Number(match[1]));
  }

  // Excel zaehlt Tage ab dem 30.12.1899.
  if (/^\d{5}$/.test(trimmed)) {
    const days = Number(trimmed);
    return new Date(Date.UTC(1899, 11, 30) + days * 86_400_000);
  }

  return null;
}

function toDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}
