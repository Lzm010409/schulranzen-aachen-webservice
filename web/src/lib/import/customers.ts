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
} from "../normalize";
import {
  IMPORT_FIELDS,
  guessMapping,
  parseCsv,
  parseImportDate,
  type ImportField,
  type Table,
} from "./table";

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
  issues: RowIssue[];
  sample: PreparedRow[];
};

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
 */
async function attachMatches(rows: PreparedRow[]): Promise<void> {
  const emails = [...new Set(rows.map((r) => r.email).filter(Boolean))] as string[];

  const byEmail = new Map<string, string>();
  if (emails.length > 0) {
    const found = await db.customer.findMany({
      where: { deletedAt: null, email: { in: emails } },
      select: { id: true, email: true },
    });
    for (const customer of found) {
      if (customer.email) byEmail.set(customer.email, customer.id);
    }
  }

  const nameKey = (row: PreparedRow) =>
    `${row.firstName.toLowerCase()}|${row.lastName.toLowerCase()}|${row.zip}`;

  const keys = [...new Set(rows.map(nameKey))];
  const byName = new Map<string, string>();
  if (keys.length > 0) {
    const candidates = await db.customer.findMany({
      where: {
        deletedAt: null,
        OR: rows.map((row) => ({
          firstName: { equals: row.firstName, mode: "insensitive" as const },
          lastName: { equals: row.lastName, mode: "insensitive" as const },
          zip: row.zip,
        })),
      },
      select: { id: true, firstName: true, lastName: true, zip: true },
      take: 5000,
    });
    for (const candidate of candidates) {
      const key = `${candidate.firstName.toLowerCase()}|${candidate.lastName.toLowerCase()}|${candidate.zip}`;
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

/** Fasst Zeilen zusammen, die dieselbe Person meinen. */
function groupRows(rows: PreparedRow[]): PreparedRow[][] {
  const groups = new Map<string, PreparedRow[]>();
  for (const row of rows) {
    const key = row.email
      ? `mail:${row.email}`
      : `name:${row.firstName.toLowerCase()}|${row.lastName.toLowerCase()}|${row.zip}|${row.street.toLowerCase()}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.values()];
}

export async function buildPreview(
  table: Table,
  mapping: Record<ImportField, number>,
): Promise<ImportPreview> {
  const { rows, issues } = await prepareImport(table, mapping);
  const groups = groupRows(rows);

  const existingProducts = new Set(
    (await db.product.findMany({ select: { name: true } })).map((p) =>
      p.name.trim().toLowerCase(),
    ),
  );
  const newProducts = new Set<string>();
  let purchases = 0;

  for (const row of rows) {
    if (row.product) {
      purchases += 1;
      if (!existingProducts.has(row.product.toLowerCase())) {
        newProducts.add(row.product);
      }
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
    newProducts: [...newProducts],
    issues,
    sample: rows.slice(0, 20),
  };
}

export type ImportOutcome = {
  createdCustomers: number;
  updatedCustomers: number;
  createdPurchases: number;
  createdProducts: number;
  issues: RowIssue[];
};

/**
 * Schreibt den Import. Eine Zeile ohne Produkt legt nur den Kunden an; mit
 * Produkt entsteht zusaetzlich ein Kauf.
 */
export async function applyImport(
  table: Table,
  mapping: Record<ImportField, number>,
): Promise<ImportOutcome> {
  const { rows, issues } = await prepareImport(table, mapping);
  const groups = groupRows(rows);

  let createdCustomers = 0;
  let updatedCustomers = 0;
  let createdPurchases = 0;
  const productIds = new Map<string, string>();
  const productsBefore = await db.product.count();

  await db.$transaction(
    async (tx) => {
      for (const group of groups) {
        const first = group[0];
        const existingId =
          group.find((row) => row.matchesCustomerId)?.matchesCustomerId ?? null;

        // Innerhalb einer Gruppe gewinnt der erste nicht-leere Wert; so
        // ergaenzen spaetere Zeilen fehlende Angaben, ohne gute zu ueberschreiben.
        const merged = {
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
        };

        let customerId: string;
        if (existingId) {
          // Vorhandene Angaben nicht mit Leerwerten ueberschreiben.
          const current = await tx.customer.findUniqueOrThrow({
            where: { id: existingId },
          });
          await tx.customer.update({
            where: { id: existingId },
            data: {
              firstName: merged.firstName,
              lastName: merged.lastName,
              street: merged.street !== "—" ? merged.street : current.street,
              zip: merged.zip || current.zip,
              city: merged.city !== "—" ? merged.city : current.city,
              email: merged.email ?? current.email,
              phone: merged.phone ?? current.phone,
              notes: merged.notes
                ? [current.notes, merged.notes].filter(Boolean).join("\n")
                : current.notes,
            },
          });
          customerId = existingId;
          updatedCustomers += 1;
        } else {
          const created = await tx.customer.create({ data: merged });
          customerId = created.id;
          createdCustomers += 1;
        }

        for (const row of group) {
          if (!row.product) continue;

          let productId = productIds.get(row.product.toLowerCase());
          if (!productId) {
            const product = await findOrCreateProduct(row.product, tx);
            productId = product.id;
            productIds.set(row.product.toLowerCase(), productId);
          }

          // Denselben Kauf nicht doppelt anlegen, wenn die Datei zweimal
          // eingelesen wird.
          const duplicate = await tx.purchase.findFirst({
            where: {
              customerId,
              productId,
              purchasedAt: row.purchasedAt,
            },
          });
          if (duplicate) continue;

          await tx.purchase.create({
            data: { customerId, productId, purchasedAt: row.purchasedAt },
          });
          createdPurchases += 1;
        }
      }
    },
    { timeout: 10 * 60 * 1000, maxWait: 60_000 },
  );

  const productsAfter = await db.product.count();

  return {
    createdCustomers,
    updatedCustomers,
    createdPurchases,
    createdProducts: productsAfter - productsBefore,
    issues,
  };
}
