/**
 * Prueft den Import mit einem grossen Bestand am laufenden System.
 *   node scripts/gross-check.mjs <basisUrl> <datenbankUrl> <csv> <dump>
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const [B, DB, CSV, DUMP] = process.argv.slice(2);
const EMAIL = "lgollenstede@gollenstede-sachverstand.de";
const PASSWORD = "LokalerTest12345";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "  OK  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const sql = (q) => execFileSync("psql", [DB, "-tAc", q], { encoding: "utf8" }).trim();
const secs = (ms) => `${(ms / 1000).toFixed(1)} s`;

const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
const chromiumDir = readdirSync(root).find((d) => d.startsWith("chromium-"));
const browser = await chromium.launch({
  executablePath: join(root, chromiumDir, "chrome-linux", "chrome"),
});
const page = await browser.newPage();
page.setDefaultTimeout(120_000);

try {
  await page.goto(`${B}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });

  // ------------------------------------------------------------- CSV
  // Auf leerem Bestand beginnen, sonst zählt die Vorschau Bestandskunden.
  sql("TRUNCATE purchase, customer, product, mail_job CASCADE;");

  await page.goto(`${B}/einstellungen/import`);
  await page.setInputFiles("#datei", CSV);
  let t = Date.now();
  await page.click('button:has-text("Datei einlesen und prüfen")');
  await page.waitForSelector("text=es wurde noch nichts geschrieben", { timeout: 600_000 });
  const previewMs = Date.now() - t;
  let body = await page.textContent("body");
  check(`CSV-Vorschau für 12.600 Zeilen`, /12\.?000 Kunden werden neu angelegt|12000 Kunden werden neu angelegt/.test(body),
    `${secs(previewMs)}, ${body.match(/[\d.]+ Kunden werden neu angelegt/)?.[0]}`);
  check("CSV-Vorschau nennt die Käufe", /12\.?600 Käufe werden erfasst|12600 Käufe werden erfasst/.test(body),
    body.match(/[\d.]+ Käufe werden erfasst/)?.[0] ?? "?");

  await page.setInputFiles("#datei", CSV);
  t = Date.now();
  await page.click('button:has-text("Import ausführen")');
  await page.waitForSelector("text=Import abgeschlossen", { timeout: 600_000 });
  const importMs = Date.now() - t;
  body = await page.textContent("body");
  check("CSV-Import läuft durch", body.includes("Import abgeschlossen"),
    `${secs(importMs)} — ${body.match(/Import abgeschlossen:[^.]*\./)?.[0] ?? ""}`);
  check("12.000 Kunden in der Datenbank", sql("select count(*) from customer") === "12000", sql("select count(*) from customer"));
  check("12.600 Käufe in der Datenbank", sql("select count(*) from purchase") === "12600", sql("select count(*) from purchase"));
  check("Niemand ist doppelt angelegt",
    sql(`select count(*) from (select email from customer where email is not null group by email having count(*)>1) d`) === "0");
  check("Mehrfachkäufer haben zwei Käufe",
    sql(`select count(*) from (select "customerId" from purchase group by "customerId" having count(*)=2) d`) === "600",
    sql(`select count(*) from (select "customerId" from purchase group by "customerId" having count(*)=2) d`));

  // Zweiter Lauf: nichts darf sich verdoppeln. Der Knopf „Import ausführen"
  // ist bis zur Vorschau gesperrt, also erst einlesen.
  await page.goto(`${B}/einstellungen/import`);
  await page.setInputFiles("#datei", CSV);
  await page.click('button:has-text("Datei einlesen und prüfen")');
  await page.waitForSelector("text=es wurde noch nichts geschrieben", { timeout: 600_000 });
  await page.setInputFiles("#datei", CSV);
  t = Date.now();
  await page.click('button:has-text("Import ausführen")');
  await page.waitForSelector("text=Import abgeschlossen", { timeout: 600_000 });
  const wiederMs = Date.now() - t;
  check("Zweiter Lauf verdoppelt nichts",
    sql("select count(*) from customer") === "12000" && sql("select count(*) from purchase") === "12600",
    `${secs(wiederMs)} — ${sql("select count(*) from customer")}/${sql("select count(*) from purchase")}`);

  // -------------------------------------------------------- Altsystem
  sql("TRUNCATE purchase, customer, product, mail_job CASCADE;");
  await page.goto(`${B}/einstellungen/import`);
  await page.selectOption("#quelle", "dump");
  await page.setInputFiles("#dump", DUMP);
  t = Date.now();
  await page.click('button:has-text("Übernahme ausführen")');
  await page.waitForSelector("text=Übernahme abgeschlossen", { timeout: 900_000 });
  const legacyMs = Date.now() - t;
  check("Übernahme aus dem Altsystem läuft durch", true, secs(legacyMs));
  check("Altsystem: 12.000 Kunden mit 12.600 Käufen",
    sql("select count(*) from customer") === "12000" && sql("select count(*) from purchase") === "12600",
    `${sql("select count(*) from customer")}/${sql("select count(*) from purchase")}`);
  check("Altsystem: Rohbestand steht im Schema legacy",
    sql("select count(*) from legacy.kunde") === "12600");

  await page.goto(`${B}/einstellungen/import`);
  await page.selectOption("#quelle", "dump");
  await page.setInputFiles("#dump", DUMP);
  t = Date.now();
  await page.click('button:has-text("Übernahme ausführen")');
  await page.waitForSelector("text=Übernahme abgeschlossen", { timeout: 900_000 });
  check("Altsystem: zweiter Lauf verdoppelt nichts",
    sql("select count(*) from customer") === "12000" && sql("select count(*) from purchase") === "12600",
    `${secs(Date.now() - t)} — ${sql("select count(*) from customer")}/${sql("select count(*) from purchase")}`);

  // ------------------------------------------------ Oberfläche bleibt schnell
  t = Date.now();
  await page.goto(`${B}/kunden`);
  await page.waitForSelector("table");
  check("Kundenliste öffnet sich zügig", Date.now() - t < 8000, secs(Date.now() - t));
  body = await page.textContent("body");
  check("Kundenliste zeigt nur eine Seite", (await page.locator("tbody tr").count()) <= 50,
    `${await page.locator("tbody tr").count()} Zeilen`);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden`);
process.exit(failed.length === 0 ? 0 : 1);
