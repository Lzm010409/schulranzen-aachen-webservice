/**
 * Datenuebernahme aus dem Vaadin-Altsystem.
 *
 * Zwei Wege:
 *
 *   A) Dump-basiert (empfohlen). Auf dem Altsystem:
 *        pg_dump -Fc --data-only --schema=public \
 *          -t kunde -t product -t provider -t mail_template \
 *          -U <benutzer> <datenbank> > legacy.dump
 *      Danach hier:
 *        npm run etl:import -- --dump legacy.dump
 *
 *   B) Direkt von Datenbank zu Datenbank (Lesezugriff genuegt):
 *        LEGACY_DATABASE_URL=postgresql://… npm run etl:import -- --direct
 *
 * Optionen:
 *   --dry-run     nichts schreiben, nur den Bericht ausgeben
 *   --report x.md Bericht zusaetzlich als Datei ablegen
 *
 * Der Lauf ist wiederholbar: jeder uebernommene Datensatz traegt seine alte
 * ID in `legacyId`, ein zweiter Durchlauf aktualisiert statt zu verdoppeln.
 * Geschrieben wird in einer einzigen Transaktion — bricht etwas ab, bleibt
 * die neue Datenbank unveraendert.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { readLegacy } from "./read-legacy.js";
import { transform, type TransformResult } from "./transform.js";

type Options = {
  mode: "dump" | "direct";
  dumpFile?: string;
  dryRun: boolean;
  reportFile?: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { mode: "direct", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dump") {
      options.mode = "dump";
      options.dumpFile = argv[++i];
    } else if (arg === "--direct") {
      options.mode = "direct";
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--report") {
      options.reportFile = argv[++i];
    }
  }
  return options;
}

const LEGACY_TABLES = ["kunde", "product", "provider", "mail_template"];

/**
 * Schreibt einen Dump so um, dass er im Schema `legacy` landet.
 *
 * Ein pg_dump des Altsystems referenziert seine Tabellen vollqualifiziert als
 * `public.kunde` usw. Wuerde man ihn unveraendert einspielen, zielte er auf
 * die gleichnamigen Tabellen der NEUEN Anwendung — ein `search_path` hilft
 * dagegen nicht. Deshalb werden die Verweise zeilenweise auf `legacy.`
 * umgebogen, und zwar nur ausserhalb der COPY-Nutzdaten, damit echte Inhalte
 * unangetastet bleiben.
 */
export function rewriteDumpSql(sql: string): string {
  const pattern = new RegExp(
    `\\bpublic\\.(${LEGACY_TABLES.join("|")})\\b`,
    "g",
  );
  const out: string[] = [];
  let inCopyData = false;

  for (const line of sql.split("\n")) {
    if (inCopyData) {
      // Nutzdaten unveraendert durchreichen; `\.` beendet den Block.
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

/** Spielt den Dump in das Schema `legacy` der Zieldatenbank ein. */
function restoreDump(dumpFile: string, databaseUrl: string): void {
  if (!existsSync(dumpFile)) {
    throw new Error(`Dump-Datei nicht gefunden: ${dumpFile}`);
  }

  console.log(`Spiele ${dumpFile} in das Schema "legacy" ein…`);

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

  const temp = join(tmpdir(), `legacy-import-${process.pid}.sql`);
  writeFileSync(temp, sql, "utf8");
  try {
    execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", temp], {
      stdio: "inherit",
    });
  } finally {
    rmSync(temp, { force: true });
  }
}

function buildReport(result: TransformResult, options: Options): string {
  const { stats } = result;
  const byKind = new Map<string, number>();
  for (const issue of result.issues) {
    byKind.set(issue.kind, (byKind.get(issue.kind) ?? 0) + 1);
  }

  const lines: string[] = [
    "# Übernahmebericht",
    "",
    options.dryRun
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
      lines.push("");
      lines.push(
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL ist nicht gesetzt.");

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  const run = await db.migrationRun.create({
    data: {
      source: options.mode === "dump" ? (options.dumpFile ?? "dump") : "direct",
      dryRun: options.dryRun,
    },
  });

  try {
    let source: { connectionString: string; schema: string };

    if (options.mode === "dump") {
      await db.$executeRawUnsafe("CREATE SCHEMA IF NOT EXISTS legacy");
      const { dirname } = await import("node:path");
      const { fileURLToPath } = await import("node:url");
      const here = dirname(fileURLToPath(import.meta.url));
      const ddl = readFileSync(join(here, "legacy-schema.sql"), "utf8");
      for (const statement of ddl.split(";").map((s) => s.trim())) {
        if (statement) await db.$executeRawUnsafe(statement);
      }
      restoreDump(options.dumpFile as string, databaseUrl);
      source = { connectionString: databaseUrl, schema: "legacy" };
    } else {
      const legacyUrl = process.env.LEGACY_DATABASE_URL;
      if (!legacyUrl) {
        throw new Error(
          "LEGACY_DATABASE_URL ist nicht gesetzt (wird für --direct benötigt).",
        );
      }
      source = {
        connectionString: legacyUrl,
        schema: process.env.LEGACY_SCHEMA ?? "public",
      };
    }

    console.log("Lese Altbestand…");
    const legacy = await readLegacy(source);
    console.log(
      `  ${legacy.kunden.length} Kunden, ${legacy.products.length} Produkte, ` +
        `${legacy.providers.length} Provider, ${legacy.templates.length} Vorlagen`,
    );

    console.log("Rechne um…");
    const result = transform(legacy);

    if (!options.dryRun) {
      console.log("Schreibe…");
      await writeResult(db, result);
    }

    const report = buildReport(result, options);
    console.log(`\n${report}`);

    if (options.reportFile) {
      writeFileSync(options.reportFile, report, "utf8");
      console.log(`Bericht gespeichert: ${options.reportFile}`);
    }

    await db.migrationRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        report: {
          stats: result.stats,
          issues: result.issues.map((i) => ({ ...i })),
        },
      },
    });
  } catch (error) {
    await db.migrationRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), error: (error as Error).message },
    });
    throw error;
  } finally {
    await db.$disconnect();
  }
}

/**
 * Schreibt das Ergebnis in einer Transaktion. `legacyId` macht den Lauf
 * wiederholbar: bereits uebernommene Datensaetze werden aktualisiert,
 * nicht ein zweites Mal angelegt.
 */
async function writeResult(
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
            update: { productId, purchasedAt: purchase.purchasedAt },
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

main().catch((error) => {
  console.error("\nÜbernahme fehlgeschlagen:", error.message);
  process.exit(1);
});
