import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LEGACY_SCHEMA_SQL } from "./legacy-schema";
import { readLegacy } from "./read-legacy";
import { transform, type TransformResult } from "./transform";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Uebernahme aus dem Vaadin-Altsystem. Wird sowohl vom Kommandozeilenwerkzeug
 * (scripts/etl/import.ts) als auch von der Oberflaeche genutzt, damit es nur
 * eine Wahrheit gibt.
 */

const LEGACY_TABLES = ["kunde", "product", "provider", "mail_template"];

/**
 * Schreibt einen Dump so um, dass er im Schema `legacy` landet.
 *
 * Ein pg_dump des Altsystems referenziert seine Tabellen vollqualifiziert als
 * `public.kunde` usw. Wuerde man ihn unveraendert einspielen, zielte er auf
 * die gleichnamigen Tabellen der NEUEN Anwendung — ein `search_path` hilft
 * dagegen nicht. Deshalb werden die Verweise zeilenweise umgebogen, und zwar
 * nur ausserhalb der COPY-Nutzdaten, damit echte Inhalte unangetastet bleiben.
 */
export function rewriteDumpSql(sql: string): string {
  const pattern = new RegExp(`\\bpublic\\.(${LEGACY_TABLES.join("|")})\\b`, "g");
  const out: string[] = [];
  let inCopyData = false;

  for (const line of sql.split("\n")) {
    if (inCopyData) {
      out.push(line);
      if (line === "\\.") inCopyData = false;
      continue;
    }
    const rewritten = line.replace(pattern, "legacy.$1");
    out.push(rewritten);
    if (/^COPY\s.+FROM stdin;\s*$/i.test(rewritten)) inCopyData = true;
  }

  return out.join("\n");
}

/** Legt das Schema `legacy` samt Tabellen an, falls es noch fehlt. */
export async function ensureLegacySchema(db: PrismaClient): Promise<void> {
  await db.$executeRawUnsafe("CREATE SCHEMA IF NOT EXISTS legacy");
  for (const statement of LEGACY_SCHEMA_SQL.split(";")) {
    const trimmed = statement.trim();
    if (trimmed) await db.$executeRawUnsafe(trimmed);
  }
}

/**
 * Leert die Ablage im Schema `legacy`, bevor ein Dump eingespielt wird.
 *
 * Ohne das scheitert jeder zweite Lauf am Primaerschluessel, denn der Dump
 * bringt dieselben IDs erneut mit. Der Rohbestand ist eine reine Zwischenablage:
 * nach dem Lauf enthaelt sie genau den soeben eingespielten Dump. Die Tabellen
 * sind ausdruecklich schemaqualifiziert — die gleichnamigen Tabellen der
 * Anwendung liegen in `public` und werden nicht angefasst.
 */
export async function clearLegacyStaging(db: PrismaClient): Promise<void> {
  for (const table of LEGACY_TABLES) {
    await db.$executeRawUnsafe(`TRUNCATE TABLE legacy."${table}"`);
  }
}

/** Spielt einen Dump in das Schema `legacy` der Zieldatenbank ein. */
export function restoreDump(dumpFile: string, databaseUrl: string): void {
  if (!existsSync(dumpFile)) {
    throw new Error(`Dump-Datei nicht gefunden: ${dumpFile}`);
  }

  const isCustomFormat = (() => {
    try {
      execFileSync("pg_restore", ["-l", dumpFile], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();

  // Beide Formate werden zuerst zu SQL-Text, dann umgeschrieben eingespielt.
  const rawSql = isCustomFormat
    ? execFileSync(
        "pg_restore",
        // -f - schreibt SQL nach stdout, statt direkt in eine Datenbank.
        ["--data-only", "--no-owner", "--no-privileges", "-f", "-", dumpFile],
        { encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 },
      )
    : readFileSync(dumpFile, "utf8");

  const sql = rewriteDumpSql(rawSql);

  const stillPublic = sql.match(
    new RegExp(`\\bpublic\\.(${LEGACY_TABLES.join("|")})\\b`),
  );
  if (stillPublic) {
    throw new Error(
      `Der Dump verweist weiterhin auf ${stillPublic[0]}. Abbruch, um die Tabellen der neuen Anwendung nicht zu überschreiben.`,
    );
  }

  const temp = join(tmpdir(), `legacy-import-${process.pid}-${Date.now()}.sql`);
  writeFileSync(temp, sql, "utf8");
  try {
    execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", temp], {
      stdio: "pipe",
    });
  } catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? "";
    throw new Error(
      `Der Dump konnte nicht eingespielt werden.${stderr ? ` ${stderr.slice(0, 500)}` : ""}`,
    );
  } finally {
    rmSync(temp, { force: true });
  }
}

/**
 * Schreibt das Ergebnis in einer Transaktion. `legacyId` macht den Lauf
 * wiederholbar: bereits uebernommene Datensaetze werden aktualisiert statt
 * ein zweites Mal angelegt.
 */
export async function writeResult(
  db: PrismaClient,
  result: TransformResult,
): Promise<void> {
  await db.$transaction(
    async (tx) => {
      const productIdBySlug = new Map<string, string>();

      for (const product of result.products) {
        const saved = await tx.product.upsert({
          where: { slug: product.slug },
          update: { name: product.name, legacyId: product.legacyIds[0] },
          create: {
            name: product.name,
            slug: product.slug,
            legacyId: product.legacyIds[0],
          },
        });
        productIdBySlug.set(product.slug, saved.id);
      }

      for (const customer of result.customers) {
        const data = {
          firstName: customer.firstName,
          lastName: customer.lastName,
          street: customer.street,
          zip: customer.zip,
          city: customer.city,
          email: customer.email,
          phone: customer.phone,
          notes: customer.notes,
        };

        const saved = await tx.customer.upsert({
          where: { legacyId: customer.legacyId },
          update: data,
          create: { ...data, legacyId: customer.legacyId },
        });

        for (const purchase of customer.purchases) {
          const productId = purchase.productSlug
            ? productIdBySlug.get(purchase.productSlug)
            : undefined;
          // Ohne Produkt gibt es keinen Kauf — die Beziehung ist Pflicht.
          if (!productId) continue;

          await tx.purchase.upsert({
            where: { legacyId: purchase.legacyKundeId },
            // customerId gehoert auch in den Update-Zweig: aendert sich im
            // Altsystem etwas, das die Zusammenfuehrung verschiebt (etwa eine
            // nachgetragene E-Mail), muss der Kauf beim zweiten Lauf zum
            // richtigen Kunden wandern.
            update: {
              customerId: saved.id,
              productId,
              purchasedAt: purchase.purchasedAt,
            },
            create: {
              legacyId: purchase.legacyKundeId,
              customerId: saved.id,
              productId,
              purchasedAt: purchase.purchasedAt,
            },
          });
        }
      }

      for (const provider of result.providers) {
        const fields = {
          host: provider.host,
          port: provider.port,
          security: provider.security,
        };

        const byLegacy = await tx.provider.findUnique({
          where: { legacyId: provider.legacyId },
        });
        if (byLegacy) {
          await tx.provider.update({ where: { id: byLegacy.id }, data: fields });
          continue;
        }

        // Der Name ist eindeutig. Gibt es ihn bereits (etwa aus dem Seed mit
        // den Standard-Providern), wird der vorhandene Eintrag uebernommen
        // statt an der Eindeutigkeit zu scheitern.
        const byName = await tx.provider.findUnique({
          where: { name: provider.name },
        });
        if (byName) {
          await tx.provider.update({
            where: { id: byName.id },
            data: { ...fields, legacyId: provider.legacyId },
          });
          continue;
        }

        await tx.provider.create({
          data: { ...fields, name: provider.name, legacyId: provider.legacyId },
        });
      }

      for (const template of result.templates) {
        await tx.mailTemplate.upsert({
          where: { legacyId: template.legacyId },
          update: {
            name: template.name,
            subject: template.subject,
            body: template.body,
            isHtml: template.isHtml,
          },
          create: {
            legacyId: template.legacyId,
            name: template.name,
            subject: template.subject,
            body: template.body,
            isHtml: template.isHtml,
          },
        });
      }
    },
    { timeout: 15 * 60 * 1000, maxWait: 60_000 },
  );
}

export function buildReport(
  result: TransformResult,
  dryRun: boolean,
): string {
  const { stats } = result;
  const byKind = new Map<string, number>();
  for (const issue of result.issues) {
    byKind.set(issue.kind, (byKind.get(issue.kind) ?? 0) + 1);
  }

  const lines: string[] = [
    "# Übernahmebericht",
    "",
    dryRun
      ? "**Trockenlauf — es wurde nichts geschrieben.**"
      : "Der Import wurde geschrieben.",
    "",
    "## Mengengerüst",
    "",
    "| Kennzahl | Altsystem | Neu |",
    "| --- | ---: | ---: |",
    `| Produkte | ${stats.legacyProducts} | ${stats.products} |`,
    `| Kunden | ${stats.legacyKunden} | ${stats.customers} |`,
    `| Käufe | ${stats.legacyKunden} | ${stats.purchases} |`,
    `| Provider | — | ${result.providers.length} |`,
    `| Vorlagen | — | ${result.templates.length} |`,
    "",
    "## Zusammenführungen und Auffälligkeiten",
    "",
    `- ${stats.mergedProducts} Produkte fielen als Duplikate zusammen`,
    `- ${stats.mergedCustomers} Kundendatensätze gehörten zur selben Person und wurden zu einem Kunden mit mehreren Käufen zusammengeführt`,
    `- ${stats.invalidEmails} ungültige E-Mail-Adressen wurden in die Notiz verschoben`,
    `- ${stats.droppedRows} Zeilen ohne verwertbaren Namen wurden ausgelassen`,
    "",
  ];

  if (byKind.size > 0) {
    lines.push("### Nach Art", "");
    for (const [kind, count] of [...byKind].sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${kind}: ${count}`);
    }
    lines.push("");
  }

  const detailed = result.issues.slice(0, 200);
  if (detailed.length > 0) {
    lines.push("### Einzelfälle", "");
    lines.push("| Datensatz | Art | Hinweis |");
    lines.push("| --- | --- | --- |");
    for (const issue of detailed) {
      lines.push(`| ${issue.legacyId} | ${issue.kind} | ${issue.detail} |`);
    }
    if (result.issues.length > detailed.length) {
      lines.push(
        "",
        `_… und ${result.issues.length - detailed.length} weitere. Vollständig im Feld \`report\` der Tabelle \`migration_run\`._`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## Prüfhinweise",
    "",
    "- Die Rohdaten liegen weiterhin im Schema `legacy` und wurden nicht verändert.",
    "- Bei den Providern wurde die Verschlüsselung aus dem Port abgeleitet (465 → SSL/TLS, sonst STARTTLS). Bitte einmal gegenprüfen.",
    "- SMTP-Passwörter werden bewusst **nicht** übernommen; sie sind unter Einstellungen → Mailkonten neu zu hinterlegen.",
    "",
  );

  return lines.join("\n");
}

export type LegacySource =
  | { kind: "dump"; dumpPath: string }
  | { kind: "direct"; connectionString: string; schema?: string };

export type LegacyImportOutcome = {
  result: TransformResult;
  report: string;
  runId: string;
};

/**
 * Fuehrt die Uebernahme aus. Im Trockenlauf wird gelesen und umgerechnet, aber
 * nichts geschrieben — der Bericht zeigt trotzdem, was passieren wuerde.
 */
export async function runLegacyImport(input: {
  db: PrismaClient;
  databaseUrl: string;
  source: LegacySource;
  dryRun: boolean;
  onProgress?: (message: string) => void;
}): Promise<LegacyImportOutcome> {
  const { db, source, dryRun } = input;
  const say = input.onProgress ?? (() => undefined);

  const run = await db.migrationRun.create({
    data: {
      source: source.kind === "dump" ? source.dumpPath : "direct",
      dryRun,
    },
  });

  try {
    let readFrom: { connectionString: string; schema: string };

    if (source.kind === "dump") {
      say("Lege das Schema „legacy“ an…");
      await ensureLegacySchema(db);
      // Reste frueherer Laeufe entfernen, sonst kollidieren die IDs des Dumps.
      await clearLegacyStaging(db);
      say("Spiele den Dump ein…");
      restoreDump(source.dumpPath, input.databaseUrl);
      readFrom = { connectionString: input.databaseUrl, schema: "legacy" };
    } else {
      readFrom = {
        connectionString: source.connectionString,
        schema: source.schema ?? "public",
      };
    }

    say("Lese den Altbestand…");
    const legacy = await readLegacy(readFrom);

    say("Rechne um…");
    const result = transform(legacy);

    if (!dryRun) {
      say("Schreibe…");
      await writeResult(db, result);
    }

    const report = buildReport(result, dryRun);

    await db.migrationRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        report: {
          stats: result.stats,
          issues: result.issues.map((issue) => ({ ...issue })),
        },
      },
    });

    return { result, report, runId: run.id };
  } catch (error) {
    await db.migrationRun
      .update({
        where: { id: run.id },
        data: { finishedAt: new Date(), error: (error as Error).message },
      })
      .catch(() => undefined);
    throw error;
  }
}
