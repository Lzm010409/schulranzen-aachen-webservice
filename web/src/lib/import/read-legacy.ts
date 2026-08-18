import { Pool } from "pg";

/**
 * Liest den Altbestand — entweder aus einer direkten Verbindung zur alten
 * Datenbank oder aus dem Schema `legacy` der neuen Datenbank, in das zuvor
 * ein Dump eingespielt wurde.
 *
 * Die Spaltennamen sind bewusst tolerant behandelt: das Altsystem hat sein
 * Schema von Hibernate erzeugen lassen, und je nach Version heissen Spalten
 * `product_id` oder `productid`.
 */

export type LegacyProduct = { id: bigint; productName: string | null };

export type LegacyKunde = {
  id: bigint;
  vorname: string | null;
  nachname: string | null;
  adresse: string | null;
  plz: string | null;
  stadt: string | null;
  kaufdatum: Date | null;
  mail: string | null;
  tel: string | null;
  productId: bigint | null;
};

export type LegacyProvider = {
  id: bigint;
  providerName: string | null;
  smtpHost: string | null;
  smtpPort: string | null;
};

export type LegacyTemplate = {
  id: bigint;
  name: string | null;
  subject: string | null;
  body: string | null;
  html: boolean | null;
};

export type LegacyData = {
  products: LegacyProduct[];
  kunden: LegacyKunde[];
  providers: LegacyProvider[];
  templates: LegacyTemplate[];
};

function asBigInt(value: unknown): bigint | null {
  if (value === null || value === undefined) return null;
  try {
    return BigInt(String(value));
  } catch {
    return null;
  }
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

/** Findet die tatsaechlich vorhandene Schreibweise einer Spalte. */
function pick(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (name in row) return row[name];
  }
  return null;
}

async function tableExists(
  pool: Pool,
  schema: string,
  table: string,
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = $2 LIMIT 1`,
    [schema, table],
  );
  return result.rowCount === 1;
}

export async function readLegacy(options: {
  connectionString: string;
  schema: string;
}): Promise<LegacyData> {
  const pool = new Pool({ connectionString: options.connectionString, max: 4 });
  const schema = options.schema;

  try {
    const missing: string[] = [];
    for (const table of ["kunde", "product"]) {
      if (!(await tableExists(pool, schema, table))) missing.push(table);
    }
    if (missing.length > 0) {
      throw new Error(
        `Im Schema "${schema}" fehlen die Tabellen: ${missing.join(", ")}. ` +
          `Wurde der Dump eingespielt bzw. zeigt LEGACY_DATABASE_URL auf die richtige Datenbank?`,
      );
    }

    const productRows = await pool.query(
      `SELECT * FROM ${schema}.product`,
    );
    const products: LegacyProduct[] = productRows.rows.map((row) => ({
      id: asBigInt(pick(row, "id")) ?? 0n,
      productName: asString(pick(row, "product_name", "productname", "productName")),
    }));

    const kundeRows = await pool.query(`SELECT * FROM ${schema}.kunde`);
    const kunden: LegacyKunde[] = kundeRows.rows.map((row) => ({
      id: asBigInt(pick(row, "id")) ?? 0n,
      vorname: asString(pick(row, "vorname")),
      nachname: asString(pick(row, "nachname")),
      adresse: asString(pick(row, "adresse")),
      plz: asString(pick(row, "plz")),
      stadt: asString(pick(row, "stadt")),
      kaufdatum: asDate(pick(row, "kaufdatum")),
      mail: asString(pick(row, "mail")),
      tel: asString(pick(row, "tel")),
      productId: asBigInt(pick(row, "product_id", "productid", "productId")),
    }));

    const providers: LegacyProvider[] = (await tableExists(pool, schema, "provider"))
      ? (await pool.query(`SELECT * FROM ${schema}.provider`)).rows.map((row) => ({
          id: asBigInt(pick(row, "id")) ?? 0n,
          providerName: asString(
            pick(row, "provider_name", "providername", "providerName"),
          ),
          smtpHost: asString(pick(row, "smtp_host", "smtphost", "smtpHost")),
          smtpPort: asString(pick(row, "smtp_port", "smtpport", "smtpPort")),
        }))
      : [];

    const templates: LegacyTemplate[] = (await tableExists(
      pool,
      schema,
      "mail_template",
    ))
      ? (await pool.query(`SELECT * FROM ${schema}.mail_template`)).rows.map(
          (row) => {
            const html = pick(row, "html", "is_html", "ishtml");
            return {
              id: asBigInt(pick(row, "id")) ?? 0n,
              name: asString(pick(row, "name")),
              subject: asString(pick(row, "subject")),
              body: asString(pick(row, "body")),
              html: html === null ? null : Boolean(html),
            };
          },
        )
      : [];

    return { products, kunden, providers, templates };
  } finally {
    await pool.end();
  }
}
