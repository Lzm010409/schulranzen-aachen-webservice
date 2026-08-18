/**
 * Erzeugt die Beispieldateien unter beispieldaten/.
 *
 *   npm run beispieldaten
 *
 * Die Dateien dienen zum Ausprobieren der Importfunktionen. Sie sind bewusst
 * unterschiedlich aufgebaut — sauber, unsauber, Excel, Altsystem —, damit jede
 * Stelle der Verarbeitung einmal angefasst wird.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";

const OUT = join(process.cwd(), "beispieldaten");
mkdirSync(OUT, { recursive: true });

const BOM = "﻿";

// --------------------------------------------------------------- 1. Standard

const STANDARD_HEADER = [
  "Anrede",
  "Vorname",
  "Nachname",
  "Adresse",
  "PLZ",
  "Stadt",
  "E-Mail",
  "Telefon",
  "Produkt",
  "Warengruppe",
  "Kaufdatum",
];

const STANDARD_ROWS = [
  ["Frau", "Anna", "Berger", "Pontstraße 14", "52062", "Aachen", "anna.berger@example.de", "0241 4011234", "Ergobag Cubo", "Schulranzen", "18.07.2023"],
  ["Frau", "Anna", "Berger", "Pontstraße 14", "52062", "Aachen", "anna.berger@example.de", "0241 4011234", "Sporttasche Größe M", "Zubehör", "02.08.2025"],
  ["Herr", "Bernd", "Claßen", "Markt 8", "52062", "Aachen", "b.classen@example.de", "+49 241 4022345", "Satch Pack", "Schulranzen", "05.08.2024"],
  ["Frau", "Christina", "Dahmen", "Adalbertsteinweg 92", "52070", "Aachen", "c.dahmen@example.de", "", "Scout Sunny", "Schulranzen", "11.08.2022"],
  ["Frau", "Christina", "Dahmen", "Adalbertsteinweg 92", "52070", "Aachen", "c.dahmen@example.de", "", "Federmäppchen Set", "Zubehör", "11.08.2022"],
  ["Herr", "Dennis", "Esser", "Vaalser Straße 5", "52074", "Aachen", "d.esser@example.de", "0241 4033456", "Step by Step Space", "Schulranzen", "22.07.2024"],
  ["Frau", "Elena", "Franzen", "Jülicher Straße 41", "52070", "Aachen", "e.franzen@example.de", "0241 4044567", "Satch Pack", "Schulranzen", "14.08.2025"],
  ["Frau", "Greta", "Hansen", "Hauptstraße 27", "52134", "Herzogenrath", "g.hansen@example.de", "02406 991234", "Ergobag Cubo", "Schulranzen", "01.08.2024"],
  ["Herr", "Hendrik", "Ibrahim", "Kirchstraße 12", "52249", "Eschweiler", "h.ibrahim@example.de", "02403 771234", "Step by Step Space", "Schulranzen", "08.08.2025"],
  ["Frau", "Ines", "Jansen", "Roermonder Straße 60", "52072", "Aachen", "i.jansen@example.de", "0241 4066789", "Sporttasche Größe M", "Zubehör", "03.09.2021"],
  ["Herr", "Jonas", "Königs", "Alsdorfer Straße 9", "52477", "Alsdorf", "j.koenigs@example.de", "", "", "", ""],
  ["Frau", "Katrin", "Lemmens", "Trierer Straße 118", "52078", "Aachen", "k.lemmens@example.de", "0241 4077890", "Scout Sunny", "Schulranzen", "19.08.2023"],
];

function csvCell(value: string, separator: string): string {
  return /["\n\r]|[;,\t]/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

function toCsv(
  header: string[],
  rows: string[][],
  separator = ";",
  withBom = true,
): string {
  const lines = [header, ...rows].map((row) =>
    row.map((cell) => csvCell(cell, separator)).join(separator),
  );
  return (withBom ? BOM : "") + lines.join("\r\n") + "\r\n";
}

writeFileSync(
  join(OUT, "kunden-standard.csv"),
  toCsv(STANDARD_HEADER, STANDARD_ROWS),
  "utf8",
);

// ------------------------------------------------------- 2. Problemfälle

/*
 * Diese Datei ist absichtlich unbequem:
 *   - Komma statt Semikolon, kein BOM
 *   - englische Ueberschriften, "E-Mail-Adresse" neben "Adresse"
 *   - Anfuehrungszeichen mit Trennzeichen darin
 *   - PLZ mit Laenderpraefix, Telefon in drei Schreibweisen
 *   - vier Datumsformate, darunter eine Excel-Serienzahl und Unsinn
 *   - eine kaputte Mailadresse, eine leere Zeile, eine Zeile ohne Namen
 *   - dieselbe Person zweimal, einmal mit und einmal ohne Mailadresse
 */
const SCHWIERIG_HEADER = [
  "Salutation",
  "First Name",
  "Last Name",
  "Adresse",
  "Postleitzahl",
  "Ort",
  "E-Mail-Adresse",
  "Telefonnummer",
  "Artikel",
  "Gekauft am",
  "Bemerkung",
];

const SCHWIERIG_ROWS = [
  ["Hr.", "  Lars ", " Meurer ", "Bergstraße 3, 2. OG", "D-52064", "Aachen", "  LARS.MEURER@Example.DE  ", "0241/40 88 901", "Ergobag Cubo", "2024-08-14", "Stammkunde"],
  ["", "Lars", "Meurer", "Bergstraße 3, 2. OG", "52064", "Aachen", "", "0241 4088901", "Federmäppchen Set", "45518", ""],
  ["Frau", "Miriam", "Nowak", "Am Hang 12", "52074", "Aachen", "miriam(at)example.de", "+49 241 4099012", "Satch Pack", "01/09/2023", "Mailadresse unklar"],
  ["Firma", "Norbert", "Oberst", '"Zum Hof" 7', "52070", "Aachen", "n.oberst@example.de", "0049 241 4010123", "Scout Sunny", "demnächst", ""],
  ["", "", "", "", "", "", "", "", "", "", ""],
  ["", "", "", "Unbekannt 1", "52062", "Aachen", "", "", "Ergobag Cubo", "01.01.2024", "Zeile ohne Namen"],
  ["Frau", "Petra", "Quirin", "Talstr. 8", "52078", "Aachen", "p.quirin@example.de", "0241 4021234", "Neuprodukt Wanderrucksack", "12.08.2025", "neues Produkt"],
];

writeFileSync(
  join(OUT, "kunden-problemfaelle.csv"),
  toCsv(SCHWIERIG_HEADER, SCHWIERIG_ROWS, ",", false),
  "utf8",
);

// ------------------------------------------------------------------ 3. Excel

async function writeXlsx() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Schulranzen-Aachen-Webservice";
  const sheet = workbook.addWorksheet("Kunden");

  sheet.addRow(STANDARD_HEADER);
  sheet.getRow(1).font = { bold: true };
  for (const row of STANDARD_ROWS) sheet.addRow(row);
  sheet.columns.forEach((column, index) => {
    column.width = Math.max(14, STANDARD_HEADER[index].length + 4);
  });

  await workbook.xlsx.writeFile(join(OUT, "kunden-standard.xlsx"));
}

// ------------------------------------------------------------- 4. Altsystem

/*
 * Ein Datenabzug im Schema der Vaadin-Anwendung — vollqualifiziert als
 * public.<tabelle>, genau wie pg_dump ihn schreibt. Damit laesst sich pruefen,
 * dass der Import ihn nach `legacy` umlenkt und nicht die Tabellen der neuen
 * Anwendung trifft.
 *
 * Inhalt: neun Kundenzeilen im alten Modell "ein Kunde, ein Produkt".
 * Zeile 12 und 10 sind dieselbe Person (gleiche Mail, zwei Produkte),
 * Zeile 13 und 11 ebenfalls (einmal ohne Mailadresse).
 * Produkt 4 und 5 sind Schreibvarianten von Produkt 1.
 */
const ALTSYSTEM_SQL = `--
-- Beispielabzug aus dem Vaadin-Altsystem (nur Daten).
-- Entspricht dem, was folgender Befehl auf dem Altsystem erzeugt:
--
--   pg_dump --data-only --schema=public \\
--     -t kunde -t product -t provider -t mail_template \\
--     -U <benutzer> <datenbank> > altsystem-export.sql
--
SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

COPY public.product (id, product_name) FROM stdin;
1	Ergobag Cubo
2	Satch Pack
3	Scout Sunny
4	ergobag cubo
5	  Ergobag   Cubo  
6	Sporttasche Größe M
7	\\N
\\.

COPY public.kunde (id, vorname, nachname, adresse, plz, stadt, kaufdatum, mail, tel, product_id) FROM stdin;
10	Anna	Müller	Hauptstr. 1	52062	Aachen	2023-08-14	Anna.Mueller@Example.DE	0241 123456	1
11	Bernd	Schmitz	Marktplatz 3	52070	Aachen	2024-07-02	b.schmitz@example.de	+49 241 654321	2
12	Anna	Müller	Hauptstr. 1	52062	Aachen	2025-08-01	anna.mueller@example.de	0241 123456	3
13	Bernd	Schmitz	Marktplatz 3	52070	Aachen	2025-06-11	\\N	0241654321	4
14	Clara	Weiß	Ringstr. 9	52064	Aachen	2024-09-20	clara(at)example.de	0170/1234567	2
15	Dieter	Klein	Am Hang 12	D-52074	Aachen	2022-03-15	d.klein@example.de	0049 241 99887	5
16	Eva	Lang	Bergweg 4	52066	Aachen	\\N	eva.lang@example.de	\\N	6
17	\\N	\\N	Unbekannt 1	52062	Aachen	2024-01-01	\\N	\\N	1
18	  Fritz 	 Groß 	 Talstr.  8 	52078	Aachen	2021-11-30	  FRITZ@EXAMPLE.DE  	 0241  55 66 77 	3
\\.

COPY public.provider (id, provider_name, smtp_host, smtp_port) FROM stdin;
20	Vodafone	smtp.vodafonemail.de	465
21	IONOS	smtp.ionos.de	587
\\.

COPY public.mail_template (id, name, subject, body, html) FROM stdin;
30	Aktion	Unser Angebot für Sie	<html><body><h1>Hallo</h1>{Content}<p>Ihr Team</p></body></html>	t
31	Kurzinfo	Kurze Info	Reiner Text ohne Platzhalter	f
\\.
`;

writeFileSync(join(OUT, "altsystem-export.sql"), ALTSYSTEM_SQL, "utf8");

// ------------------------------------------------------------- 5. Wegweiser

const README = `# Beispieldateien

Zum Ausprobieren der Importfunktionen unter **Einstellungen → Import**.
Erzeugt mit \`npm run beispieldaten\`.

| Datei | Wofür |
| --- | --- |
| \`kunden-standard.csv\` | Der Normalfall: deutsche Überschriften, Semikolon, UTF-8 mit BOM — so schreibt Excel. 12 Zeilen, davon zwei Paare derselben Person mit je zwei Käufen. |
| \`kunden-standard.xlsx\` | Dieselben Daten als Excel-Mappe. |
| \`kunden-problemfaelle.csv\` | Absichtlich unbequem — siehe unten. |
| \`altsystem-export.sql\` | Datenabzug im Schema der alten Vaadin-Anwendung, für die Übernahme aus dem Altsystem. |

## kunden-standard.csv

12 Zeilen, 10 Personen. Anna Berger und Christina Dahmen stehen je zweimal
drin — daraus werden **zwei Kunden mit je zwei Käufen**, nicht vier Kunden.
Jonas Königs hat kein Produkt und kein Kaufdatum: ein Interessent ohne Kauf.

Die Spalte **Warengruppe** wird beim Import mit angelegt; Käufe bekommen ihre
**Saison** (Einschulungsjahrgang) automatisch aus dem Kaufdatum. Ein Kauf im
September oder später zählt zur Einschulung des Folgejahres — deshalb landet
Ines Jansen mit dem 03.09.2021 in der Saison 2022.

## kunden-problemfaelle.csv

Deckt die Fälle ab, an denen ein Import sonst stolpert:

| Zeile | Besonderheit | Erwartetes Verhalten |
| --- | --- | --- |
| 2 | Leerzeichen um Namen und Mail, Mail in Großbuchstaben, PLZ \`D-52064\` | wird getrimmt, kleingeschrieben, PLZ zu \`52064\` |
| 2, 3 | dieselbe Person, einmal mit und einmal ohne Mailadresse | ein Kunde mit zwei Käufen |
| 3 | Kaufdatum \`45518\` (Excel-Serienzahl) | wird als 14.08.2024 gelesen |
| 4 | \`miriam(at)example.de\` | keine gültige Adresse — wandert in die Notiz, Zeile bleibt erhalten |
| 5 | Kaufdatum \`demnächst\`, Adresse mit Anführungszeichen | Kauf ohne Datum, Hinweis im Bericht |
| 6 | komplett leere Zeile | wird still übersprungen |
| 7 | keine Namen | wird ausgelassen und im Bericht genannt |
| 8 | unbekanntes Produkt | wird neu angelegt |
| 2 | Anrede \`Hr.\` | wird als „Herr“ gelesen |
| 5 | Anrede \`Firma\` | lässt sich nicht zuordnen — bleibt ohne Angabe, statt zu raten |

Außerdem: **Komma** statt Semikolon, **kein BOM**, **englische Überschriften**
und eine Spalte \`E-Mail-Adresse\` direkt neben \`Adresse\` — die Spaltenerkennung
darf die beiden nicht verwechseln.

## altsystem-export.sql

Neun Zeilen im alten Modell „ein Kunde hat genau ein Produkt“. Daraus werden
**sechs Kunden mit acht Käufen**:

- Zeile 10 und 12 sind Anna Müller (gleiche Mail, zwei Produkte)
- Zeile 11 und 13 sind Bernd Schmitz — die zweite ohne Mailadresse, erkannt
  über Name und Anschrift
- Zeile 17 hat keinen Namen und wird ausgelassen
- Produkt 1, 4 und 5 sind Schreibvarianten desselben Artikels und fallen
  zu einem Produkt zusammen
- die Saison wird aus dem Kaufdatum abgeleitet; das Altsystem kannte sie nicht

Der Abzug ist bewusst vollqualifiziert (\`public.kunde\`), damit sich prüfen
lässt, dass der Import ihn in das Schema \`legacy\` umlenkt und die Tabellen
der neuen Anwendung nicht anfasst.

> Zum Ausprobieren am besten **erst den Trockenlauf** — er schreibt nichts und
> zeigt im Bericht, was passieren würde.

## Nachgeprüft

Alles, was oben steht, prüft \`node scripts/beispieldaten-check.mjs\` gegen eine
laufende Instanz nach — jede Datei auf leerem Bestand, danach der Abgleich in
der Datenbank.

## Aufräumen

Die eingespielten Beispielkunden lassen sich in der Kundenliste über den
Filter finden und einzeln löschen. Für einen sauberen Neuanfang in einer
Testumgebung:

\`\`\`bash
npm run testdaten -- --weg   # entfernt nur die Datensätze aus npm run testdaten
\`\`\`
`;

writeFileSync(join(OUT, "README.md"), README, "utf8");

await writeXlsx();

console.log(`Beispieldateien geschrieben nach ${OUT}:`);
for (const name of [
  "kunden-standard.csv",
  "kunden-standard.xlsx",
  "kunden-problemfaelle.csv",
  "altsystem-export.sql",
  "README.md",
]) {
  console.log(`  • ${name}`);
}
