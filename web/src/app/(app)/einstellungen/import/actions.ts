"use server";

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import {
  runLegacyImport,
  type LegacySource,
} from "@/lib/import/legacy-import";
import {
  applyImport,
  buildPreview,
  guessMapping,
  readTable,
  type ImportPreview,
} from "@/lib/import/customers";
import { IMPORT_FIELDS, type ImportField } from "@/lib/import/table";
import { flash } from "@/lib/flash";

const MAX_UPLOAD = 50 * 1024 * 1024;

// ------------------------------------------------- Übernahme aus dem Altsystem

export type LegacyState = {
  error?: string;
  report?: string;
  dryRun?: boolean;
  stats?: {
    legacyKunden: number;
    customers: number;
    purchases: number;
    products: number;
    mergedCustomers: number;
    mergedProducts: number;
  };
};

export async function legacyImportAction(
  _prev: LegacyState,
  formData: FormData,
): Promise<LegacyState> {
  const user = await requirePermission("daten.importieren");

  const dryRun = formData.get("modus") !== "import";
  const quelle = String(formData.get("quelle") ?? "dump");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return { error: "DATABASE_URL ist nicht gesetzt." };

  let source: LegacySource;
  let tempDir: string | null = null;

  try {
    if (quelle === "direkt") {
      const connectionString = String(formData.get("connectionString") ?? "").trim();
      if (!connectionString) {
        return { error: "Bitte die Verbindung zur alten Datenbank angeben." };
      }
      if (!/^postgres(ql)?:\/\//.test(connectionString)) {
        return {
          error:
            "Die Verbindung muss mit postgresql:// beginnen, z. B. postgresql://benutzer:passwort@host:5432/datenbank",
        };
      }
      source = {
        kind: "direct",
        connectionString,
        schema: String(formData.get("schema") ?? "public").trim() || "public",
      };
    } else {
      const file = formData.get("dump");
      if (!(file instanceof File) || file.size === 0) {
        return { error: "Bitte eine Dump-Datei auswählen." };
      }
      if (file.size > MAX_UPLOAD) {
        return {
          error: `Die Datei ist ${(file.size / 1024 / 1024).toFixed(1)} MB groß. Erlaubt sind 50 MB — größere Bestände bitte über die Direktverbindung oder die Kommandozeile übernehmen.`,
        };
      }
      tempDir = mkdtempSync(join(tmpdir(), "legacy-dump-"));
      const path = join(tempDir, "legacy.dump");
      writeFileSync(path, Buffer.from(await file.arrayBuffer()));
      source = { kind: "dump", dumpPath: path };
    }

    const { result, report } = await runLegacyImport({
      db,
      databaseUrl,
      source,
      dryRun,
    });

    if (!dryRun) {
      await recordAudit({
        userId: user.id,
        entity: "Customer",
        action: "CREATE",
        diff: {
          quelle: "Altsystem",
          kunden: result.stats.customers,
          kaeufe: result.stats.purchases,
        },
      });
      await flash.hinweis(
        "Übernahme abgeschlossen.",
        `${result.stats.customers} Kunden und ${result.stats.purchases} Käufe aus dem Altsystem.`,
      );
      revalidatePath("/kunden");
      revalidatePath("/produkte");
    }

    return {
      report,
      dryRun,
      stats: {
        legacyKunden: result.stats.legacyKunden,
        customers: result.stats.customers,
        purchases: result.stats.purchases,
        products: result.stats.products,
        mergedCustomers: result.stats.mergedCustomers,
        mergedProducts: result.stats.mergedProducts,
      },
    };
  } catch (error) {
    return { error: (error as Error).message };
  } finally {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  }
}

// ------------------------------------------------------- Import aus CSV/Excel

export type TableState = {
  error?: string;
  message?: string;
  headers?: string[];
  mapping?: Record<string, number>;
  preview?: ImportPreview;
  outcome?: {
    createdCustomers: number;
    updatedCustomers: number;
    createdPurchases: number;
    createdProducts: number;
  };
};

function readMapping(
  formData: FormData,
  headers: string[],
): Record<ImportField, number> {
  const mapping = {} as Record<ImportField, number>;
  let anySet = false;

  for (const field of IMPORT_FIELDS) {
    const raw = formData.get(`spalte_${field.key}`);
    if (raw === null) continue;
    anySet = true;
    const index = Number(raw);
    mapping[field.key] =
      Number.isInteger(index) && index >= 0 && index < headers.length
        ? index
        : -1;
  }

  // Beim ersten Aufruf gibt es noch keine Zuordnung — dann raten.
  return anySet ? mapping : guessMapping(headers);
}

export async function tableImportAction(
  _prev: TableState,
  formData: FormData,
): Promise<TableState> {
  const user = await requirePermission("daten.importieren");

  const file = formData.get("datei");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Bitte eine CSV- oder Excel-Datei auswählen." };
  }
  if (file.size > MAX_UPLOAD) {
    return { error: "Die Datei ist größer als 50 MB." };
  }

  try {
    const table = await readTable(
      file.name,
      Buffer.from(await file.arrayBuffer()),
    );

    if (table.headers.length === 0) {
      return { error: "Die Datei enthält keine Kopfzeile." };
    }
    if (table.rows.length === 0) {
      return {
        error: "Die Datei enthält außer der Kopfzeile keine Daten.",
        headers: table.headers,
      };
    }

    const mapping = readMapping(formData, table.headers);

    if (mapping.firstName === -1 && mapping.lastName === -1) {
      return {
        error:
          "Es wurde weder eine Spalte für den Vor- noch für den Nachnamen zugeordnet.",
        headers: table.headers,
        mapping,
      };
    }

    if (formData.get("modus") !== "import") {
      return {
        headers: table.headers,
        mapping,
        preview: await buildPreview(table, mapping),
      };
    }

    const outcome = await applyImport(table, mapping);

    await recordAudit({
      userId: user.id,
      entity: "Customer",
      action: "CREATE",
      diff: {
        quelle: `Datei ${file.name}`,
        neu: outcome.createdCustomers,
        aktualisiert: outcome.updatedCustomers,
        kaeufe: outcome.createdPurchases,
      },
    });

    await flash.hinweis(
      "Import abgeschlossen.",
      `${outcome.createdCustomers} neue Kunden, ${outcome.updatedCustomers} ergänzt, ${outcome.createdPurchases} Käufe.`,
    );
    revalidatePath("/kunden");
    revalidatePath("/produkte");

    return {
      headers: table.headers,
      mapping,
      message: `Import abgeschlossen: ${outcome.createdCustomers} neue Kunden, ${outcome.updatedCustomers} aktualisiert, ${outcome.createdPurchases} Käufe.`,
      outcome: {
        createdCustomers: outcome.createdCustomers,
        updatedCustomers: outcome.updatedCustomers,
        createdPurchases: outcome.createdPurchases,
        createdProducts: outcome.createdProducts,
      },
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
}
