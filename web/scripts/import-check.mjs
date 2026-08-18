/**
 * Prueft die Importfunktionen am laufenden System:
 *   1. Kundenimport aus CSV (Vorschau, dann Import)
 *   2. Uebernahme aus dem Altsystem per Dump-Datei (Trockenlauf, dann Import)
 *
 *   node scripts/import-check.mjs [basisUrl] [pfadZumDump]
 */
import { readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const B = process.argv[2] ?? "http://127.0.0.1:3000";
const DUMP = process.argv[3];
const EMAIL = process.env.SMOKE_EMAIL ?? "lgollenstede@gollenstede-sachverstand.de";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "LokalerTest12345";
const RUN = Date.now().toString(36).slice(-6);

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "  OK  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

// Testdatei mit bewusst unsauberen Faellen
const dir = mkdtempSync(join(tmpdir(), "import-check-"));
const csvPath = join(dir, "kunden.csv");
writeFileSync(
  csvPath,
  "﻿" +
    [
      "Vorname;Nachname;Adresse;PLZ;Stadt;E-Mail-Adresse;Telefon;Produkt;Kaufdatum",
      `Lisa;Import${RUN};Teststr. 1;D-52062;Aachen;  LISA.${RUN}@Example.DE ;0241 111222;Ergobag Cubo;14.08.2024`,
      `Lisa;Import${RUN};Teststr. 1;52062;Aachen;lisa.${RUN}@example.de;;Satch Pack;2025-08-01`,
      `Mark;Import${RUN};"Nebenstr. 2, Hinterhaus";52070;Aachen;mark.${RUN}@example.de;+49 241 333444;Scout Sunny;01/09/2023`,
      `;;;;;;;;`,
      `Ohne;Mail${RUN};Weg 9;52064;Aachen;;0241 555666;Neuprodukt ${RUN};nicht lesbar`,
    ].join("\n"),
  "utf8",
);

const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
const chromiumDir = readdirSync(root).find((d) => d.startsWith("chromium-"));
const browser = await chromium.launch({
  executablePath: join(root, chromiumDir, "chrome-linux", "chrome"),
});
const page = await browser.newPage();

try {
  await page.goto(`${B}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });

  // ---------------------------------------------------- CSV-Import
  await page.goto(`${B}/einstellungen/import`);
  check("Importseite ist erreichbar", page.url().includes("/einstellungen/import"));

  await page.setInputFiles("#datei", csvPath);
  await page.click('button:has-text("Datei einlesen und prüfen")');
  await page.waitForTimeout(2500);

  let body = await page.textContent("body");
  check("Vorschau erscheint", body.includes("es wurde noch nichts geschrieben"));
  check(
    "Spalten wurden zugeordnet",
    (await page.inputValue("#spalte_firstName")) === "0" &&
      (await page.inputValue("#spalte_lastName")) === "1",
  );
  check(
    "E-Mail-Adresse landet nicht in der Adresse",
    (await page.inputValue("#spalte_email")) === "5" &&
      (await page.inputValue("#spalte_street")) === "2",
  );
  check(
    "Zeilen derselben Person werden zusammengefasst",
    body.includes("3 Kunden werden neu angelegt") ||
      /3<\/strong> Kunden werden neu angelegt/.test(await page.content()),
    body.match(/\d+ Kunden werden neu angelegt/)?.[0] ?? "",
  );
  check("Käufe werden erkannt", /\d+ Käufe werden erfasst/.test(body));
  check("Unlesbares Datum wird gemeldet", body.includes("nicht lesbar"));

  // Datei erneut anhängen und importieren
  await page.setInputFiles("#datei", csvPath);
  await page.click('button:has-text("Import ausführen")');
  await page.waitForTimeout(3500);

  body = await page.textContent("body");
  check("Import meldet Erfolg", body.includes("Import abgeschlossen"), 
    body.match(/Import abgeschlossen:[^.]*\./)?.[0] ?? "");

  // Ergebnis in der Kundenliste prüfen
  await page.goto(`${B}/kunden?q=Import${RUN}`);
  await page.waitForTimeout(800);
  body = await page.textContent("body");
  check(
    "Importierte Kunden erscheinen in der Liste",
    !body.includes("Keine Treffer") && body.includes("Teststr. 1"),
  );
  check("E-Mail wurde normalisiert", body.includes(`lisa.${RUN}@example.de`));
  check("Telefon wurde normalisiert", body.includes("+49241111222"));
  check("PLZ wurde bereinigt", body.includes("52062"));
  check(
    "Lisa hat zwei Käufe",
    /Ergobag Cubo \+1|Satch Pack \+1/.test(body),
    body.match(/(Ergobag Cubo|Satch Pack)( \+\d)?/)?.[0] ?? "",
  );

  // Zweiter Import derselben Datei darf nichts verdoppeln
  await page.goto(`${B}/einstellungen/import`);
  await page.setInputFiles("#datei", csvPath);
  await page.click('button:has-text("Datei einlesen und prüfen")');
  await page.waitForTimeout(2500);
  body = await page.textContent("body");
  check(
    "Wiederholter Import erkennt die Kunden als vorhanden",
    /3 bestehende Kunden werden ergänzt/.test(body) ||
      /0 Kunden werden neu angelegt/.test(body),
    body.match(/\d+ bestehende Kunden werden ergänzt/)?.[0] ?? "",
  );

  // ---------------------------------------------- Übernahme aus dem Altsystem
  if (DUMP) {
    await page.goto(`${B}/einstellungen/import`);
    await page.selectOption("#quelle", "dump");
    await page.setInputFiles("#dump", DUMP);
    await page.click('button:has-text("Trockenlauf")');
    await page.waitForTimeout(6000);

    body = await page.textContent("body");
    check(
      "Trockenlauf läuft durch",
      body.includes("Trockenlauf — es wurde nichts geschrieben"),
    );
    check(
      "Mengengerüst zeigt Kunden und Käufe",
      body.includes("Daraus Kunden") && body.includes("Daraus Käufe"),
    );
    check(
      "Zusammenführungen werden ausgewiesen",
      body.includes("Zusammengeführte Kunden"),
    );

    await page.setInputFiles("#dump", DUMP);
    await page.click('button:has-text("Übernahme ausführen")');
    await page.waitForTimeout(8000);
    body = await page.textContent("body");
    check("Übernahme meldet Erfolg", body.includes("Übernahme abgeschlossen"));
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden`);
process.exit(failed.length === 0 ? 0 : 1);
