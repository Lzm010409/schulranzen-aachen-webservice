/**
 * Datenuebernahme aus dem Vaadin-Altsystem (Kommandozeile).
 *
 * Dieselbe Logik steht in der Oberflaeche unter Einstellungen → Import.
 * Die Arbeit macht src/lib/import/legacy-import.ts; hier steht nur die
 * Bedienung.
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
 */
import { writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  runLegacyImport,
  type LegacySource,
} from "../../src/lib/import/legacy-import";

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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL ist nicht gesetzt.");

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  let source: LegacySource;
  if (options.mode === "dump") {
    if (!options.dumpFile) throw new Error("--dump benötigt einen Dateinamen.");
    source = { kind: "dump", dumpPath: options.dumpFile };
  } else {
    const legacyUrl = process.env.LEGACY_DATABASE_URL;
    if (!legacyUrl) {
      throw new Error(
        "LEGACY_DATABASE_URL ist nicht gesetzt (wird für --direct benötigt).",
      );
    }
    source = {
      kind: "direct",
      connectionString: legacyUrl,
      schema: process.env.LEGACY_SCHEMA ?? "public",
    };
  }

  try {
    const { report } = await runLegacyImport({
      db,
      databaseUrl,
      source,
      dryRun: options.dryRun,
      onProgress: (message) => console.log(message),
    });

    console.log(`\n${report}`);

    if (options.reportFile) {
      writeFileSync(options.reportFile, report, "utf8");
      console.log(`Bericht gespeichert: ${options.reportFile}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("\nÜbernahme fehlgeschlagen:", error.message);
  process.exit(1);
});
