import "server-only";
import ExcelJS from "exceljs";

/**
 * CSV-Erzeugung fuer deutsche Excel-Installationen:
 *  - Semikolon als Trennzeichen (Excel/DE erwartet das Listentrennzeichen)
 *  - UTF-8 mit BOM, sonst werden Umlaute zerlegt
 *  - Schutz gegen CSV-Injection
 */

const BOM = "﻿";
const SEPARATOR = ";";

/**
 * Zellen, die mit =, +, - oder @ beginnen, werden von Excel als Formel
 * ausgefuehrt. Ein vorangestelltes Apostroph entschaerft das, ohne den Wert
 * zu verfaelschen.
 */
export function guardCsvValue(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw =
    value instanceof Date
      ? value.toLocaleDateString("de-DE")
      : String(value);
  const guarded = guardCsvValue(raw);
  const needsQuotes = /[";\n\r]/.test(guarded);
  return needsQuotes ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(SEPARATOR) + "\r\n";
}

export type ExportColumn<T> = {
  header: string;
  value: (row: T) => unknown;
  width?: number;
};

/**
 * Streamt die Ausgabe zeilenweise. Die Datensaetze werden in Bloecken aus der
 * Datenbank geholt, es liegt also nie der gesamte Bestand im Speicher — anders
 * als im Altsystem, das erst eine Datei schrieb und sie dann komplett einlas.
 */
export function csvStream<T>(
  columns: ExportColumn<T>[],
  pages: AsyncIterable<T[]>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(BOM));
        controller.enqueue(encoder.encode(csvRow(columns.map((c) => c.header))));
        for await (const page of pages) {
          let chunk = "";
          for (const row of page) {
            chunk += csvRow(columns.map((c) => c.value(row)));
          }
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export async function xlsxBuffer<T>(
  columns: ExportColumn<T>[],
  pages: AsyncIterable<T[]>,
  sheetName = "Export",
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Schulranzen-Aachen-Webservice";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.header,
    width: c.width ?? Math.max(12, c.header.length + 4),
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for await (const page of pages) {
    for (const row of page) {
      sheet.addRow(
        columns.map((c) => {
          const value = c.value(row);
          if (value === null || value === undefined) return "";
          if (value instanceof Date || typeof value === "number") return value;
          return guardCsvValue(String(value));
        }),
      );
    }
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function exportFilename(base: string, extension: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${base}_${stamp}.${extension}`;
}
