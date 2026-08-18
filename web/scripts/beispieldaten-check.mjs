/**
 * Prueft die Beispieldateien gegen die Zusagen in beispieldaten/README.md.
 * Jede Datei wird auf einem leeren Bestand eingelesen.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const B = process.argv[2] ?? "http://127.0.0.1:4200";
const DB = process.argv[3] ?? "postgresql://postgres@127.0.0.1:5433/schulranzen_beispiel";
const DIR = process.argv[4] ?? "beispieldaten";
const EMAIL = "lgollenstede@gollenstede-sachverstand.de";
const PASSWORD = "LokalerTest12345";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "  OK  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const sql = (q) => execFileSync("psql", [DB, "-tAc", q], { encoding: "utf8" }).trim();
const reset = () => sql("TRUNCATE purchase, customer, product, audit_log, migration_run RESTART IDENTITY CASCADE; DROP SCHEMA IF EXISTS legacy CASCADE;");

const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
const chromiumDir = readdirSync(root).find((d) => d.startsWith("chromium-"));
const browser = await chromium.launch({
  executablePath: join(root, chromiumDir, "chrome-linux", "chrome"),
});
const page = await browser.newPage();
const num = (body, re) => Number(body.match(re)?.[1] ?? -1);

try {
  await page.goto(`${B}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });

  // ================================================= kunden-standard.csv
  reset();
  await page.goto(`${B}/einstellungen/import`);
  await page.setInputFiles("#datei", join(DIR, "kunden-standard.csv"));
  await page.click('button:has-text("Datei einlesen und prüfen")');
  await page.waitForTimeout(2500);
  let body = await page.textContent("body");

  check("standard.csv: Semikolon und BOM werden erkannt",
    (await page.inputValue("#spalte_firstName")) === "0" &&
    (await page.inputValue("#spalte_lastName")) === "1" &&
    (await page.inputValue("#spalte_email")) === "5");
  check("standard.csv: 10 Kunden werden neu angelegt",
    num(body, /(\d+) Kunden werden neu angelegt/) === 10,
    body.match(/\d+ Kunden werden neu angelegt/)?.[0] ?? "?");
  check("standard.csv: 11 Käufe werden erfasst",
    num(body, /(\d+) Käufe werden erfasst/) === 11,
    body.match(/\d+ Käufe werden erfasst/)?.[0] ?? "?");

  await page.setInputFiles("#datei", join(DIR, "kunden-standard.csv"));
  await page.click('button:has-text("Import ausführen")');
  await page.waitForTimeout(3500);
  body = await page.textContent("body");
  check("standard.csv: Import meldet Erfolg", body.includes("Import abgeschlossen"));
  check("standard.csv: 10 Kunden in der Datenbank", sql("select count(*) from customer") === "10", sql("select count(*) from customer"));
  check("standard.csv: 11 Käufe in der Datenbank", sql("select count(*) from purchase") === "11", sql("select count(*) from purchase"));
  check("standard.csv: Anna Berger hat zwei Käufe",
    sql(`select count(*) from purchase p join customer c on c.id=p."customerId" where c."lastName"='Berger'`) === "2");
  check("standard.csv: Christina Dahmen hat zwei Käufe",
    sql(`select count(*) from purchase p join customer c on c.id=p."customerId" where c."lastName"='Dahmen'`) === "2");
  check("standard.csv: Jonas Königs ist Kunde ohne Kauf",
    sql(`select count(*) from purchase p join customer c on c.id=p."customerId" where c."lastName"='Königs'`) === "0" &&
    sql(`select count(*) from customer where "lastName"='Königs'`) === "1");
  check("standard.csv: Telefon nach E.164",
    sql(`select phone from customer where "lastName"='Berger'`) === "+492414011234",
    sql(`select phone from customer where "lastName"='Berger'`));

  // ================================================= kunden-standard.xlsx
  reset();
  await page.goto(`${B}/einstellungen/import`);
  await page.setInputFiles("#datei", join(DIR, "kunden-standard.xlsx"));
  await page.click('button:has-text("Datei einlesen und prüfen")');
  await page.waitForTimeout(2500);
  body = await page.textContent("body");
  check("standard.xlsx: gleiche Vorschau wie die CSV",
    num(body, /(\d+) Kunden werden neu angelegt/) === 10 &&
    num(body, /(\d+) Käufe werden erfasst/) === 11,
    `${body.match(/\d+ Kunden werden neu angelegt/)?.[0]}, ${body.match(/\d+ Käufe werden erfasst/)?.[0]}`);
  await page.setInputFiles("#datei", join(DIR, "kunden-standard.xlsx"));
  await page.click('button:has-text("Import ausführen")');
  await page.waitForTimeout(3500);
  check("standard.xlsx: Import ergibt 10 Kunden / 11 Käufe",
    sql("select count(*) from customer") === "10" && sql("select count(*) from purchase") === "11",
    `${sql("select count(*) from customer")}/${sql("select count(*) from purchase")}`);

  // ============================================ kunden-problemfaelle.csv
  reset();
  await page.goto(`${B}/einstellungen/import`);
  await page.setInputFiles("#datei", join(DIR, "kunden-problemfaelle.csv"));
  await page.click('button:has-text("Datei einlesen und prüfen")');
  await page.waitForTimeout(2500);
  body = await page.textContent("body");
  check("problemfaelle: Komma ohne BOM, englische Überschriften erkannt",
    (await page.inputValue("#spalte_firstName")) === "0" &&
    (await page.inputValue("#spalte_lastName")) === "1");
  check("problemfaelle: E-Mail-Adresse landet nicht in der Adresse",
    (await page.inputValue("#spalte_email")) === "5" &&
    (await page.inputValue("#spalte_street")) === "2",
    `email=${await page.inputValue("#spalte_email")}, street=${await page.inputValue("#spalte_street")}`);
  check("problemfaelle: 4 Kunden werden neu angelegt",
    num(body, /(\d+) Kunden werden neu angelegt/) === 4,
    body.match(/\d+ Kunden werden neu angelegt/)?.[0] ?? "?");
  check("problemfaelle: 5 Käufe werden erfasst",
    num(body, /(\d+) Käufe werden erfasst/) === 5,
    body.match(/\d+ Käufe werden erfasst/)?.[0] ?? "?");
  check("problemfaelle: Zeile ohne Namen wird gemeldet", /Weder Vor- noch Nachname/.test(body));
  check("problemfaelle: unlesbares Datum wird gemeldet", /demnächst/.test(body));
  check("problemfaelle: neues Produkt wird angekündigt", /Neuprodukt Wanderrucksack/.test(body));

  await page.setInputFiles("#datei", join(DIR, "kunden-problemfaelle.csv"));
  await page.click('button:has-text("Import ausführen")');
  await page.waitForTimeout(3500);
  check("problemfaelle: 4 Kunden / 5 Käufe in der Datenbank",
    sql("select count(*) from customer") === "4" && sql("select count(*) from purchase") === "5",
    `${sql("select count(*) from customer")}/${sql("select count(*) from purchase")}`);
  check("problemfaelle: Lars Meurer zusammengeführt, zwei Käufe",
    sql(`select count(*) from customer where "lastName"='Meurer'`) === "1" &&
    sql(`select count(*) from purchase p join customer c on c.id=p."customerId" where c."lastName"='Meurer'`) === "2");
  check("problemfaelle: Mail getrimmt und kleingeschrieben",
    sql(`select email from customer where "lastName"='Meurer'`) === "lars.meurer@example.de",
    sql(`select email from customer where "lastName"='Meurer'`));
  check("problemfaelle: PLZ D-52064 wurde bereinigt",
    sql(`select zip from customer where "lastName"='Meurer'`) === "52064",
    sql(`select zip from customer where "lastName"='Meurer'`));
  // Zeile 3 traegt das Datum als Excel-Serienzahl; erkennbar am Produkt.
  check("problemfaelle: Excel-Serienzahl 45518 als 14.08.2024 gelesen",
    sql(`select p."purchasedAt"::date::text from purchase p join product pr on pr.id=p."productId" join customer c on c.id=p."customerId" where c."lastName"='Meurer' and pr.name='Federmäppchen Set'`) === "2024-08-14",
    sql(`select string_agg(pr.name||'='||coalesce(p."purchasedAt"::date::text,'—'), ', ') from purchase p join product pr on pr.id=p."productId" join customer c on c.id=p."customerId" where c."lastName"='Meurer'`));
  check("problemfaelle: unklare Mailadresse steht in der Notiz",
    sql(`select coalesce(notes,'') from customer where "lastName"='Nowak'`).includes("miriam(at)example.de"),
    sql(`select coalesce(notes,'') from customer where "lastName"='Nowak'`));
  check("problemfaelle: Norbert Oberst ohne Kaufdatum übernommen",
    sql(`select count(*) from purchase p join customer c on c.id=p."customerId" where c."lastName"='Oberst' and p."purchasedAt" is null`) === "1");
  check("problemfaelle: Adresse mit Anführungszeichen bleibt erhalten",
    sql(`select street from customer where "lastName"='Oberst'`).includes('Zum Hof'),
    sql(`select street from customer where "lastName"='Oberst'`));
  check("problemfaelle: Adresse mit Komma bleibt eine Adresse",
    sql(`select street from customer where "lastName"='Meurer'`) === "Bergstraße 3, 2. OG",
    sql(`select street from customer where "lastName"='Meurer'`));
  check("problemfaelle: unbekanntes Produkt wurde angelegt",
    sql(`select count(*) from product where name='Neuprodukt Wanderrucksack'`) === "1");
  check("problemfaelle: Zeile ohne Namen wurde nicht angelegt",
    sql(`select count(*) from customer where street='Unbekannt 1'`) === "0");

  // ================================================ altsystem-export.sql
  reset();
  await page.goto(`${B}/einstellungen/import`);
  await page.selectOption("#quelle", "dump");
  await page.setInputFiles("#dump", join(DIR, "altsystem-export.sql"));
  await page.click('button:has-text("Trockenlauf")');
  await page.waitForTimeout(8000);
  body = await page.textContent("body");
  check("altsystem: Trockenlauf läuft durch",
    body.includes("Trockenlauf — es wurde nichts geschrieben"),
    body.match(/Fehl\w*[^.]{0,120}/)?.[0] ?? "");
  check("altsystem: Trockenlauf schreibt nichts",
    sql("select count(*) from customer") === "0");
  check("altsystem: Bericht nennt 6 Kunden und 8 Käufe",
    /Daraus Kunden\s*\|?\s*6/.test(body.replace(/\s+/g, " ")) &&
    /Daraus Käufe\s*\|?\s*8/.test(body.replace(/\s+/g, " ")),
    body.replace(/\s+/g, " ").match(/Daraus Kunden.{0,10}|Daraus Käufe.{0,10}/g)?.join(" / ") ?? "?");

  await page.setInputFiles("#dump", join(DIR, "altsystem-export.sql"));
  await page.click('button:has-text("Übernahme ausführen")');
  await page.waitForTimeout(10000);
  body = await page.textContent("body");
  check("altsystem: Übernahme meldet Erfolg", body.includes("Übernahme abgeschlossen"));
  check("altsystem: 6 Kunden mit 8 Käufen",
    sql("select count(*) from customer") === "6" && sql("select count(*) from purchase") === "8",
    `${sql("select count(*) from customer")}/${sql("select count(*) from purchase")}`);
  check("altsystem: Anna Müller hat zwei Käufe",
    sql(`select count(*) from purchase p join customer c on c.id=p."customerId" where c."lastName"='Müller'`) === "2");
  check("altsystem: Bernd Schmitz über Name+Anschrift zusammengeführt",
    sql(`select count(*) from customer where "lastName"='Schmitz'`) === "1" &&
    sql(`select count(*) from purchase p join customer c on c.id=p."customerId" where c."lastName"='Schmitz'`) === "2");
  check("altsystem: Schreibvarianten fallen zu einem Produkt zusammen",
    sql(`select count(*) from product where lower(name) like '%ergobag%'`) === "1",
    sql(`select string_agg(name,' | ') from product`));
  check("altsystem: Zeile 17 ohne Namen ausgelassen",
    sql(`select count(*) from customer where street='Unbekannt 1'`) === "0");
  check("altsystem: Clara Weiß' unklare Mail steht in der Notiz",
    sql(`select coalesce(notes,'') from customer where "lastName"='Weiß'`).includes("clara(at)example.de"),
    sql(`select coalesce(notes,'') from customer where "lastName"='Weiß'`));
  check("altsystem: PLZ D-52074 bereinigt",
    sql(`select zip from customer where "lastName"='Klein'`) === "52074");
  check("altsystem: Fritz Groß getrimmt und normalisiert",
    sql(`select "firstName"||'/'||"lastName"||'/'||email from customer where "lastName"='Groß'`) === "Fritz/Groß/fritz@example.de",
    sql(`select "firstName"||'/'||"lastName"||'/'||email from customer where "lastName"='Groß'`));
  check("altsystem: Rohbestand liegt im Schema legacy, nicht in public",
    sql("select count(*) from legacy.kunde") === "9",
    sql("select count(*) from legacy.kunde"));
  check("altsystem: Provider mit passender Verschlüsselung übernommen",
    sql(`select security from provider where "legacyId"=20`) === "SSL" &&
    sql(`select security from provider where "legacyId"=21`) === "STARTTLS",
    sql(`select string_agg(name||' '||port||' '||security,' | ') from provider where "legacyId" in (20,21)`));
  check("altsystem: Vorlage auf {{content}} umgestellt",
    sql(`select count(*) from mail_template where "legacyId"=30 and body like '%{{content}}%'`) === "1" &&
    sql(`select count(*) from mail_template where body like '%{Content}%'`) === "0",
    sql(`select string_agg(name||':'||"isHtml",' | ') from mail_template where "legacyId" in (30,31)`));

  // Wiederholbarkeit
  await page.goto(`${B}/einstellungen/import`);
  await page.selectOption("#quelle", "dump");
  await page.setInputFiles("#dump", join(DIR, "altsystem-export.sql"));
  await page.click('button:has-text("Übernahme ausführen")');
  await page.waitForTimeout(10000);
  check("altsystem: zweiter Lauf verdoppelt nichts",
    sql("select count(*) from customer") === "6" && sql("select count(*) from purchase") === "8",
    `${sql("select count(*) from customer")}/${sql("select count(*) from purchase")}`);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden`);
process.exit(failed.length === 0 ? 0 : 1);
