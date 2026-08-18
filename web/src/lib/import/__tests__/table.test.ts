import { describe, expect, it } from "vitest";
import {
  detectDelimiter,
  guessMapping,
  parseCsv,
  parseImportDate,
} from "../table";

describe("CSV einlesen", () => {
  it("erkennt Semikolon als Trennzeichen", () => {
    expect(detectDelimiter("Vorname;Nachname;PLZ")).toBe(";");
  });

  it("erkennt Komma und Tabulator", () => {
    expect(detectDelimiter("Vorname,Nachname,PLZ")).toBe(",");
    expect(detectDelimiter("Vorname\tNachname\tPLZ")).toBe("\t");
  });

  it("zählt Trennzeichen innerhalb von Anführungszeichen nicht mit", () => {
    expect(detectDelimiter('"Nachname, Vorname";PLZ;Ort')).toBe(";");
  });

  it("entfernt das BOM aus Excel-Exporten", () => {
    const table = parseCsv("﻿Vorname;Nachname\nAnna;Muster");
    expect(table.headers[0]).toBe("Vorname");
  });

  it("liest Felder in Anführungszeichen samt Trennzeichen", () => {
    const table = parseCsv('Name;Ort\n"Müller; Anna";Aachen');
    expect(table.rows[0]).toEqual(["Müller; Anna", "Aachen"]);
  });

  it("löst verdoppelte Anführungszeichen auf", () => {
    const table = parseCsv('Name\n"Sie sagte ""hallo"""');
    expect(table.rows[0][0]).toBe('Sie sagte "hallo"');
  });

  it("kommt mit CRLF zurecht", () => {
    const table = parseCsv("A;B\r\n1;2\r\n3;4\r\n");
    expect(table.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("erhält Zeilenumbrüche innerhalb von Anführungszeichen", () => {
    const table = parseCsv('Notiz;Ort\n"Zeile 1\nZeile 2";Aachen');
    expect(table.rows[0][0]).toBe("Zeile 1\nZeile 2");
    expect(table.rows).toHaveLength(1);
  });

  it("verwirft Leerzeilen am Ende", () => {
    const table = parseCsv("A;B\n1;2\n\n");
    expect(table.rows).toHaveLength(1);
  });

  it("liefert bei leerer Eingabe nichts", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
  });
});

describe("Spalten zuordnen", () => {
  it("erkennt die deutschen Standardüberschriften", () => {
    const mapping = guessMapping([
      "Vorname",
      "Nachname",
      "Adresse",
      "Stadt",
      "PLZ",
      "Mail",
      "Telefon",
      "Produkt",
      "Kaufdatum",
    ]);
    expect(mapping.firstName).toBe(0);
    expect(mapping.lastName).toBe(1);
    expect(mapping.street).toBe(2);
    expect(mapping.city).toBe(3);
    expect(mapping.zip).toBe(4);
    expect(mapping.email).toBe(5);
    expect(mapping.phone).toBe(6);
    expect(mapping.product).toBe(7);
    expect(mapping.purchasedAt).toBe(8);
  });

  it("verwechselt Nachname nicht mit Vorname", () => {
    // "Name" ist ein Alias fuer Nachname und darf sich nicht die Spalte
    // "Vorname" greifen.
    const mapping = guessMapping(["Vorname", "Name"]);
    expect(mapping.firstName).toBe(0);
    expect(mapping.lastName).toBe(1);
  });

  it("kommt mit englischen und ungewöhnlichen Überschriften klar", () => {
    const mapping = guessMapping([
      "First Name",
      "Last Name",
      "E-Mail-Adresse",
      "Postleitzahl",
    ]);
    expect(mapping.firstName).toBe(0);
    expect(mapping.lastName).toBe(1);
    expect(mapping.email).toBe(2);
    expect(mapping.zip).toBe(3);
  });

  it("nimmt „E-Mail-Adresse“ nicht für die Adresse", () => {
    const mapping = guessMapping(["Vorname", "Nachname", "E-Mail-Adresse"]);
    expect(mapping.email).toBe(2);
    expect(mapping.street).toBe(-1);
  });

  it("meldet fehlende Spalten mit -1", () => {
    const mapping = guessMapping(["Vorname", "Nachname"]);
    expect(mapping.product).toBe(-1);
    expect(mapping.purchasedAt).toBe(-1);
  });

  it("ordnet eine Spalte nicht zweimal zu", () => {
    const mapping = guessMapping(["Name", "Ort"]);
    const used = Object.values(mapping).filter((i) => i !== -1);
    expect(new Set(used).size).toBe(used.length);
  });
});

describe("Datum deuten", () => {
  it("liest deutsches Format", () => {
    expect(parseImportDate("14.08.2024")?.toISOString().slice(0, 10)).toBe(
      "2024-08-14",
    );
  });

  it("liest ISO-Format", () => {
    expect(parseImportDate("2024-08-14")?.toISOString().slice(0, 10)).toBe(
      "2024-08-14",
    );
  });

  it("liest Schrägstriche und zweistellige Jahre", () => {
    expect(parseImportDate("14/08/2024")?.toISOString().slice(0, 10)).toBe(
      "2024-08-14",
    );
    expect(parseImportDate("14.08.24")?.toISOString().slice(0, 10)).toBe(
      "2024-08-14",
    );
  });

  it("liest Excel-Serienzahlen", () => {
    // 45518 = 14.08.2024
    expect(parseImportDate("45518")?.toISOString().slice(0, 10)).toBe(
      "2024-08-14",
    );
  });

  it("gibt bei Unsinn null zurück", () => {
    expect(parseImportDate("demnächst")).toBeNull();
    expect(parseImportDate("")).toBeNull();
    expect(parseImportDate("32.13.2024")).toBeNull();
  });
});
