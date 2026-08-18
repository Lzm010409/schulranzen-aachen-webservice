import "server-only";
import ExcelJS from "exceljs";
import { db } from "../db";
import { findOrCreateProduct } from "../customers";
import {
  isValidEmail,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeZip,
  productSlug,
} from "../normalize";
import {
  IMPORT_FIELDS,
  guessMapping,
  parseCsv,
  parseImportDate,
  type ImportField,
  type Table,
} from "./table";
import {
  LOOKUP_CHUNK,
  WRITE_CHUNK,
  chunk,
  type ProgressReporter,
} from "./batch";

/**
 * Allgemeiner Kundenimport aus CSV oder Excel.
 *
 * Auch hier gilt die Trennung von Person und Kauf: eine Zeile beschreibt einen
 * Kunden *und* optional einen Kauf. Mehrere Zeilen derselben Person werden zu
 * einem Kunden mit mehreren Kaeufen — dieselbe Regel wie bei der Uebernahme
 * aus dem Altsystem.
 */

export type RowIssue = {
  row: number;
  field?: string;
  message: string;
  severity: "fehler" | "hinweis";
};

export type PreparedRow = {
  row: number;
  firstName: string;
  lastName: string;
  street: string;
  zip: string;
  city: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  product: string | null;
  purchasedAt: Date | null;
  /** Auf welchen bestehenden Kunden diese Zeile trifft, falls einer passt. */
  matchesCustomerId: string | null;
};

export type ImportPreview = {
  totalRows: number;
  valid: number;
  invalid: number;
  newCustomers: number;
  updatedCustomers: number;
  purchases: number;
  newProducts: string[];
  /** Nur die ersten Auffaelligkeiten — bei 10.000 Zeilen sonst unlesbar. */
  issues: RowIssue[];
  /** Wie viele es insgesamt sind. */
  issueCount: number;
  sample: PreparedRow[];
};

/** So viele Auffaelligkeiten wandern in die Vorschau. */
const PREVIEW_ISSUES = 200;

/** So viele Beispielzeilen zeigt die Vorschau. */
const PREVIEW_ROWS = 20;

export async function readTable(
  filename: string,
  buffer: Buffer,
): Promise<Table> {
  if (/\.(xlsx|xlsm)$/i.test(filename)) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return { headers: [], rows: [] };

    const rows: string[][] = [];
    sheet.eachRow((row) => {
      const values: string[] = [];
      // ExcelJS zaehlt Spalten ab 1; values[0] ist immer leer.
      const raw = row.values as unknown[];
      for (let i = 1; i < raw.length; i++) {
        values.push(cellToText(raw[i]));
      }
      rows.push(values);
    });

    if (rows.length === 0) return { headers: [], rows: [] };
    return { headers: rows[0].map((h) => h.trim()), rows: rows.slice(1) };
  }

  return parseCsv(buffer.toString("utf8"));
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const obj = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (typeof obj.text === "string") return obj.text;
    if (Array.isArray(obj.richText)) return obj.richText.map((r) => r.text).join("");
    if (obj.result !== undefined) return String(obj.result);
    return "";
  }
  return String(value);
}

export { guessMapping, IMPORT_FIELDS };
export type { ImportField, Table };

function cell(row: string[], index: number): string {
  if (index < 0 || index >= row.length) return "";
  return (row[index] ?? "").trim();
}

/**
 * Prueft und normalisiert alle Zeilen und ermittelt, welche bestehenden Kunden
 * getroffen werden. Schreibt nichts.
 */
export async function prepareImport(
  table: Table,
  mapping: Record<ImportField, number>,
): Promise<{ rows: PreparedRow[]; issues: RowIssue[] }> {
  const issues: RowIssue[] = [];
  const rows: PreparedRow[] = [];

  for (const [index, raw] of table.rows.entries()) {
    const rowNumber = index + 2; // Kopfzeile ist Zeile 1

    if (raw.every((value) => (value ?? "").trim() === "")) continue;

    const firstName = normalizeName(cell(raw, mapping.firstName));
    const lastName = normalizeName(cell(raw, mapping.lastName));

    if (!firstName && !lastName) {
      issues.push({
        row: rowNumber,
        field: "Name",
        message: "Weder Vor- noch Nachname — Zeile wird ausgelassen.",
        severity: "fehler",
      });
      continue;
    }

    const rawZip = cell(raw, mapping.zip);
    const zip = normalizeZip(rawZip);
    if (rawZip && zip.length !== 5) {
      issues.push({
        row: rowNumber,
        field: "PLZ",
        message: `„${rawZip}“ ergibt keine 5-stellige PLZ — wird leer übernommen.`,
        severity: "hinweis",
      });
    }

    let email = normalizeEmail(cell(raw, mapping.email));
    const noteParts: string[] = [];
    const rawNote = cell(raw, mapping.notes);
    if (rawNote) noteParts.push(rawNote);

    if (email && !isValidEmail(email)) {
      issues.push({
        row: rowNumber,
        field: "E-Mail",
        message: `„${email}“ ist keine gültige Adresse — wird als Notiz übernommen.`,
        severity: "hinweis",
      });
      noteParts.push(`Nicht übernommene E-Mail aus dem Import: ${email}`);
      email = null;
    }

    const rawDate = cell(raw, mapping.purchasedAt);
    const purchasedAt = rawDate ? parseImportDate(rawDate) : null;
    if (rawDate && !purchasedAt) {
      issues.push({
        row: rowNumber,
        field: "Kaufdatum",
        message: `„${rawDate}“ konnte nicht als Datum gelesen werden — Kauf ohne Datum.`,
        severity: "hinweis",
      });
    }

    rows.push({
      row: rowNumber,
      firstName: firstName || "—",
      lastName: lastName || "—",
      street: normalizeName(cell(raw, mapping.street)) || "—",
      zip,
      city: normalizeName(cell(raw, mapping.city)) || "—",
      email,
      phone: normalizePhone(cell(raw, mapping.phone)),
      notes: noteParts.length > 0 ? noteParts.join("\n") : null,
      product: normalizeName(cell(raw, mapping.product)) || null,
      purchasedAt,
      matchesCustomerId: null,
    });
  }

  await attachMatches(rows);
  return { rows, issues };
}

/**
 * Sucht zu jeder Zeile den passenden Bestandskunden: zuerst ueber die
 * E-Mail-Adresse, sonst ueber Name und PLZ. Zeilen derselben Person innerhalb
 * der Datei bekommen dieselbe Zuordnung, damit aus ihnen ein Kunde mit
 * mehreren Kaeufen wird statt mehrerer Kunden.
 *
 * Gesucht wird in Portionen. Bei 10.000 Zeilen entstuende sonst eine einzige
 * Abfrage mit 10.000 ODER-Zweigen — die laesst Postgres zwar zu, plant sie
 * aber katastrophal.
 */
async function attachMatches(rows: PreparedRow[]): Promise<void> {
  const byEmail = new Map<string, string>();
  const emails = [...new Set(rows.map((r) => r.email).filter(Boolean))] as string[];

  for (const part of chunk(emails, LOOKUP_CHUNK)) {
    const found = await db.customer.findMany({
      where: { deletedAt: null, email: { in: part } },
      select: { id: true, email: true },
    });
    for (const customer of found) {
      if (customer.email) byEmail.set(customer.email, customer.id);
    }
  }

  const nameKey = (row: { firstName: string; lastName: string; zip: string }) =>
    `${row.firstName.toLowerCase()}|${row.lastName.toLowerCase()}|${row.zip}`;

  // Dieselbe Person nur einmal suchen: in einer Datei mit 10.000 Zeilen
  // stecken meist deutlich weniger verschiedene Namen.
  const distinct = new Map<string, PreparedRow>();
  for (const row of rows) {
    const key = nameKey(row);
    if (!distinct.has(key)) distinct.set(key, row);
  }

  const byName = new Map<string, string>();
  for (const part of chunk([...distinct.values()], LOOKUP_CHUNK)) {
    const candidates = await db.customer.findMany({
      where: {
        deletedAt: null,
        OR: part.map((row) => ({
          firstName: { equals: row.firstName, mode: "insensitive" as const },
          lastName: { equals: row.lastName, mode: "insensitive" as const },
          zip: row.zip,
        })),
      },
      select: { id: true, firstName: true, lastName: true, zip: true },
    });
    for (const candidate of candidates) {
      const key = nameKey(candidate);
      if (!byName.has(key)) byName.set(key, candidate.id);
    }
  }

  for (const row of rows) {
    row.matchesCustomerId =
      (row.email ? byEmail.get(row.email) : undefined) ??
      byName.get(nameKey(row)) ??
      null;
  }
}

/**
 * Fasst Zeilen zusammen, die dieselbe Person meinen — dieselbe Reihenfolge wie
 * bei der Uebernahme aus dem Altsystem: erst die E-Mail-Adresse, dann Name +
 * PLZ + Strasse.
 *
 * Beide Merkmale muessen greifen, nicht nur eines: In der Praxis steht
 * dieselbe Person einmal mit und einmal ohne Mailadresse in der Datei (zweiter
 * Kauf, Adresse nicht erneut erfasst). Wuerde nur nach E-Mail gruppiert, sobald
 * eine vorhanden ist, entstuenden daraus zwei Kunden.
 */
export function groupRows(rows: PreparedRow[]): PreparedRow[][] {
  const groups: PreparedRow[][] = [];
  const byEmail = new Map<string, PreparedRow[]>();
  const byName = new Map<string, PreparedRow[]>();

  const nameKey = (row: PreparedRow) =>
    [
      row.firstName.toLowerCase(),
      row.lastName.toLowerCase(),
      row.zip,
      row.street.toLowerCase(),
    ].join("|");

  for (const row of rows) {
    const key = nameKey(row);
    const existing =
      (row.email ? byEmail.get(row.email) : undefined) ?? byName.get(key);

    if (existing) {
      existing.push(row);
      // Bringt diese Zeile die Mailadresse erstmals mit, findet die naechste
      // Zeile mit derselben Adresse die Gruppe ebenfalls.
      if (row.email && !byEmail.has(row.email)) byEmail.set(row.email, existing);
      continue;
    }

    const group = [row];
    groups.push(group);
    byName.set(key, group);
    if (row.email) byEmail.set(row.email, group);
  }

  return groups;
}

export async function buildPreview(
  table: Table,
  mapping: Record<ImportField, number>,
): Promise<ImportPreview> {
  const { rows, issues } = await prepareImport(table, mapping);
  const groups = groupRows(rows);

  // Nach Schluessel vergleichen, nicht nach Kleinschreibung: sonst gilt
  // "ergobag  cubo" als neues Produkt, obwohl es dasselbe ist.
  const existingSlugs = new Set(
    (await db.product.findMany({ select: { slug: true } })).map((p) => p.slug),
  );
  const newProducts = new Map<string, string>();
  let purchases = 0;

  for (const row of rows) {
    if (!row.product) continue;
    purchases += 1;
    const slug = productSlug(row.product);
    if (slug && !existingSlugs.has(slug) && !newProducts.has(slug)) {
      newProducts.set(slug, row.product);
    }
  }

  const updated = groups.filter((group) =>
    group.some((row) => row.matchesCustomerId),
  ).length;

  return {
    totalRows: table.rows.length,
    valid: rows.length,
    invalid: issues.filter((i) => i.severity === "fehler").length,
    newCustomers: groups.length - updated,
    updatedCustomers: updated,
    purchases,
    newProducts: [...newProducts.values()],
    issues: issues.slice(0, PREVIEW_ISSUES),
    issueCount: issues.length,
    sample: rows.slice(0, PREVIEW_ROWS),
  };
}

export type ImportOutcome = {
  createdCustomers: number;
  updatedCustomers: number;
  createdPurchases: number;
  createdProducts: number;
  issues: RowIssue[];
};

/** Ein Kunde, wie er nach dem Zusammenfassen der Zeilen geschrieben wird. */
type CustomerWrite = {
  group: PreparedRow[];
  existingId: string | null;
  data: {
    firstName: string;
    lastName: string;
    street: string;
    zip: string;
    city: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
  };
};

/**
 * Innerhalb einer Gruppe gewinnt der erste nicht-leere Wert; so ergaenzen
 * spaetere Zeilen fehlende Angaben, ohne gute zu ueberschreiben.
 */
function mergeGroup(group: PreparedRow[]): CustomerWrite {
  const first = group[0];
  return {
    group,
    existingId: group.find((row) => row.matchesCustomerId)?.matchesCustomerId ?? null,
    data: {
      firstName: first.firstName,
      lastName: first.lastName,
      street: group.find((r) => r.street !== "—")?.street ?? first.street,
      zip: group.find((r) => r.zip)?.zip ?? first.zip,
      city: group.find((r) => r.city !== "—")?.city ?? first.city,
      email: group.find((r) => r.email)?.email ?? null,
      phone: group.find((r) => r.phone)?.phone ?? null,
      notes:
        group
          .map((r) => r.notes)
          .filter(Boolean)
          .join("\n") || null,
    },
  };
}

/**
 * Legt alle vorkommenden Produkte einmal an, bevor die Kunden geschrieben
 * werden. Produkte sind wenige und werden von vielen Zeilen geteilt — sie
 * gehoeren nicht in die Schleife ueber zehntausend Zeilen.
 */
async function resolveProducts(
  rows: PreparedRow[],
): Promise<{ idBySlug: Map<string, string>; created: number }> {
  const nameBySlug = new Map<string, string>();
  for (const row of rows) {
    if (!row.product) continue;
    const slug = productSlug(row.product);
    if (slug && !nameBySlug.has(slug)) nameBySlug.set(slug, row.product);
  }

  const idBySlug = new Map<string, string>();
  const slugs = [...nameBySlug.keys()];

  for (const part of chunk(slugs, LOOKUP_CHUNK)) {
    const found = await db.product.findMany({
      where: { slug: { in: part } },
      select: { id: true, slug: true },
    });
    for (const product of found) idBySlug.set(product.slug, product.id);
  }

  let created = 0;
  for (const [slug, name] of nameBySlug) {
    if (idBySlug.has(slug)) continue;
    const product = await findOrCreateProduct(name);
    idBySlug.set(slug, product.id);
    created += 1;
  }

  return { idBySlug, created };
}

/**
 * Schreibt eine Portion Kunden samt ihrer Kaeufe in einer Transaktion.
 *
 * Die Kaeufe entstehen gesammelt: erst wird in einer Abfrage geholt, was
 * bereits an diesen Kunden haengt, dann wird der Rest in einem Zug angelegt.
 * Das ersetzt zwei Datenbankzugriffe je Kaufzeile.
 */
async function writeBatch(
  batch: CustomerWrite[],
  productIdBySlug: Map<string, string>,
): Promise<{ created: number; updated: number; purchases: number }> {
  return db.$transaction(
    async (tx) => {
      let created = 0;
      let updated = 0;

      const existingIds = batch
        .map((entry) => entry.existingId)
        .filter((id): id is string => Boolean(id));

      const currentById = new Map(
        (existingIds.length > 0
          ? await tx.customer.findMany({ where: { id: { in: existingIds } } })
          : []
        ).map((customer) => [customer.id, customer]),
      );

      const customerIdByEntry = new Map<CustomerWrite, string>();

      for (const entry of batch) {
        const current = entry.existingId ? currentById.get(entry.existingId) : undefined;

        if (entry.existingId && current) {
          // Vorhandene Angaben nicht mit Leerwerten ueberschreiben.
          await tx.customer.update({
            where: { id: entry.existingId },
            data: {
              firstName: entry.data.firstName,
              lastName: entry.data.lastName,
              street: entry.data.street !== "—" ? entry.data.street : current.street,
              zip: entry.data.zip || current.zip,
              city: entry.data.city !== "—" ? entry.data.city : current.city,
              email: entry.data.email ?? current.email,
              phone: entry.data.phone ?? current.phone,
              notes: entry.data.notes
                ? [current.notes, entry.data.notes].filter(Boolean).join("\n")
                : current.notes,
            },
          });
          customerIdByEntry.set(entry, entry.existingId);
          updated += 1;
        } else {
          const fresh = await tx.customer.create({ data: entry.data });
          customerIdByEntry.set(entry, fresh.id);
          created += 1;
        }
      }

      // ---------------------------------------------------------- Kaeufe
      const wanted: {
        customerId: string;
        productId: string;
        purchasedAt: Date | null;
      }[] = [];

      for (const entry of batch) {
        const customerId = customerIdByEntry.get(entry);
        if (!customerId) continue;
        for (const row of entry.group) {
          if (!row.product) continue;
          const productId = productIdBySlug.get(productSlug(row.product));
          if (!productId) continue;
          wanted.push({ customerId, productId, purchasedAt: row.purchasedAt });
        }
      }

      if (wanted.length === 0) return { created, updated, purchases: 0 };

      // Denselben Kauf nicht doppelt anlegen, wenn die Datei zweimal
      // eingelesen wird — ein Zugriff je Portion statt einer je Kauf.
      const seen = new Set<string>();
      const key = (p: { customerId: string; productId: string; purchasedAt: Date | null }) =>
        `${p.customerId}|${p.productId}|${p.purchasedAt?.toISOString() ?? ""}`;

      const known = await tx.purchase.findMany({
        where: { customerId: { in: [...new Set(wanted.map((p) => p.customerId))] } },
        select: { customerId: true, productId: true, purchasedAt: true },
      });
      for (const purchase of known) seen.add(key(purchase));

      const fresh = wanted.filter((purchase) => {
        const id = key(purchase);
        // Auch innerhalb der Datei: zwei gleiche Zeilen ergeben einen Kauf.
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      // Auch hier portionsweise: eine Datei kann sehr viele Kaeufe fuer
      // dieselbe Person enthalten, und ein INSERT hat eine Obergrenze an
      // Platzhaltern.
      for (const part of chunk(fresh, WRITE_CHUNK)) {
        await tx.purchase.createMany({ data: part });
      }

      return { created, updated, purchases: fresh.length };
    },
    { timeout: 120_000, maxWait: 30_000 },
  );
}

/**
 * Schreibt den Import. Eine Zeile ohne Produkt legt nur den Kunden an; mit
 * Produkt entsteht zusaetzlich ein Kauf.
 *
 * Geschrieben wird portionsweise, nicht in einer einzigen Transaktion: bei
 * 10.000 Zeilen liefe die minutenlang und sperrte dabei den halben Bestand.
 * Der Preis dafuer steht in MIGRATION.md — bricht der Lauf in der Mitte ab,
 * bleiben die bereits geschriebenen Portionen stehen. Weil der Import
 * wiederholbar ist, setzt ein zweiter Lauf sauber darauf auf.
 */
export async function applyImport(
  table: Table,
  mapping: Record<ImportField, number>,
  onProgress?: ProgressReporter,
): Promise<ImportOutcome> {
  const { rows, issues } = await prepareImport(table, mapping);
  const groups = groupRows(rows);

  const { idBySlug, created: createdProducts } = await resolveProducts(rows);

  let createdCustomers = 0;
  let updatedCustomers = 0;
  let createdPurchases = 0;
  let done = 0;

  const entries = groups.map(mergeGroup);

  for (const batch of chunk(entries, WRITE_CHUNK)) {
    const outcome = await writeBatch(batch, idBySlug);
    createdCustomers += outcome.created;
    updatedCustomers += outcome.updated;
    createdPurchases += outcome.purchases;
    done += batch.length;
    onProgress?.(done, entries.length);
  }

  return {
    createdCustomers,
    updatedCustomers,
    createdPurchases,
    createdProducts,
    issues,
  };
}
