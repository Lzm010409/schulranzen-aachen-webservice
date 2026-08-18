/**
 * Prueft Warengruppen und Saison am laufenden System.
 *
 * Der Kern: die Saison entsteht aus dem Kaufdatum — auch beim Import aus dem
 * Altsystem, das sie gar nicht kannte —, und die Warengruppe bleibt eine
 * gepflegte Liste statt Freitext.
 *
 *   node scripts/kategorie-check.mjs <basisUrl> <datenbankUrl> [beispielordner]
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const B = process.argv[2] ?? "http://127.0.0.1:3000";
const DB = process.argv[3];
const DIR = process.argv[4] ?? "beispieldaten";
const EMAIL = process.env.SMOKE_EMAIL ?? "lgollenstede@gollenstede-sachverstand.de";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "LokalerTest12345";
const RUN = Date.now().toString(36).slice(-6);

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "  OK  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const sql = (q) => execFileSync("psql", [DB, "-tAc", q], { encoding: "utf8" }).trim();

const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
const chromiumDir = readdirSync(root).find((d) => d.startsWith("chromium-"));
const browser = await chromium.launch({
  executablePath: join(root, chromiumDir, "chrome-linux", "chrome"),
});
const page = await browser.newPage();
page.setDefaultTimeout(60_000);
async function settle() {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(400);
}

try {
  await page.goto(`${B}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });

  // ------------------------------------------------- CSV mit Warengruppe
  sql("TRUNCATE purchase, customer, product, product_category, mail_job CASCADE;");

  await page.goto(`${B}/einstellungen/import`);
  await settle();
  await page.setInputFiles("#datei", join(DIR, "kunden-standard.csv"));
  await page.click('button:has-text("Datei einlesen und prüfen")');
  await page.waitForSelector("text=es wurde noch nichts geschrieben", { timeout: 60000 });

  check("Die Spalte „Warengruppe“ wird erkannt",
    (await page.inputValue("#spalte_category")) === "9",
    `Spalte ${await page.inputValue("#spalte_category")}`);

  check("Die Spalte „Anrede“ wird erkannt",
    (await page.inputValue("#spalte_salutation")) === "0",
    `Spalte ${await page.inputValue("#spalte_salutation")}`);

  await page.setInputFiles("#datei", join(DIR, "kunden-standard.csv"));
  await page.click('button:has-text("Import ausführen")');
  await page.waitForSelector("text=Import abgeschlossen", { timeout: 60000 });

  check("Warengruppen wurden angelegt",
    sql("select count(*) from product_category") === "2",
    sql("select string_agg(name||' ('||slug||')', ', ' order by name) from product_category"));
  check("Jedes Produkt hängt an seiner Warengruppe",
    sql(`select count(*) from product where "categoryId" is null`) === "0",
    sql(`select string_agg(p.name||'→'||coalesce(c.name,'—'), ', ' order by p.name) from product p left join product_category c on c.id=p."categoryId"`));

  // Saison aus dem Kaufdatum
  check("Ein Kauf im Juli zählt zur Einschulung desselben Jahres",
    sql(`select season from purchase where "purchasedAt"='2023-07-18'`) === "2023");
  check("Ein Kauf im September zählt zur Einschulung des Folgejahres",
    sql(`select season from purchase where "purchasedAt"='2021-09-03'`) === "2022",
    sql(`select season from purchase where "purchasedAt"='2021-09-03'`));
  check("Jeder Kauf mit Datum hat eine Saison",
    sql(`select count(*) from purchase where "purchasedAt" is not null and season is null`) === "0");

  // Anrede aus der Datei
  check("Die Anrede wird übernommen",
    sql(`select salutation from customer where "lastName"='Berger'`) === "FRAU",
    sql(`select salutation from customer where "lastName"='Berger'`));
  check("Auch die männliche Anrede",
    sql(`select salutation from customer where "lastName"='Claßen'`) === "HERR");
  // Die Standarddatei nennt für jede Person eine Anrede — beide Formen müssen
  // ankommen. Der Fall „nicht deutbar“ steckt in den Problemfällen und wird
  // dort geprüft.
  check("Beide Anreden kommen an",
    sql(`select count(*) from customer where salutation='FRAU'`) === "6" &&
    sql(`select count(*) from customer where salutation='HERR'`) === "4",
    sql(`select salutation::text || ': ' || count(*)::text from customer group by salutation order by 1`).replace(/\n/g, ", "));

  // ------------------------------------------------------- Filter im UI
  await page.goto(`${B}/kunden`);
  await settle();
  const gruppeId = sql(`select id from product_category where slug='schulranzen'`);
  await page.goto(`${B}/kunden?categoryId=${gruppeId}`);
  await settle();
  let body = await page.textContent("body");
  check("Nach Warengruppe lässt sich filtern",
    /Warengruppe Schulranzen/.test(body) && !/Keine Treffer/.test(body),
    body.match(/\d+ Datensätze/)?.[0] ?? "");

  await page.goto(`${B}/kunden?season=2022`);
  await settle();
  body = await page.textContent("body");
  const treffer2022 = sql(
    `select count(distinct "customerId") from purchase where season=2022`,
  );
  check("Nach Saison lässt sich filtern",
    body.includes(`${treffer2022} Datensätze`) && /Saison 2022/.test(body),
    `erwartet ${treffer2022}, gezeigt ${body.match(/\d+ Datensätze/)?.[0]}`);

  // -------------------------------------------- Warengruppe im Katalog
  await page.goto(`${B}/produkte`);
  await settle();
  body = await page.textContent("body");
  check("Der Katalog zeigt Warengruppe und Modelljahr",
    body.includes("Warengruppe") && body.includes("Modelljahr"));

  await page.fill("#newCategoryName", `Testgruppe ${RUN}`);
  await page.click('button:text-is("Anlegen")');
  await page.waitForTimeout(2000);
  check("Eine Warengruppe lässt sich anlegen",
    sql(`select count(*) from product_category where name='Testgruppe ${RUN}'`) === "1");

  // Doppelte Schreibweise darf keinen zweiten Eintrag erzeugen.
  await page.goto(`${B}/produkte`);
  await settle();
  await page.fill("#newCategoryName", `  testgruppe ${RUN}  `);
  await page.click('button:text-is("Anlegen")');
  await page.waitForTimeout(2000);
  check("Eine abweichende Schreibweise legt nichts Zweites an",
    sql(`select count(*) from product_category where slug like 'testgruppe-${RUN}'`) === "1",
    sql(`select count(*) from product_category`));
  body = await page.textContent("body");
  check("Der Versuch wird erklärt", /gibt es bereits/i.test(body));

  // ------------------------------------------ Übernahme aus dem Altsystem
  sql("TRUNCATE purchase, customer, product, product_category, mail_job CASCADE; DROP SCHEMA IF EXISTS legacy CASCADE;");

  await page.goto(`${B}/einstellungen/import`);
  await settle();
  await page.selectOption("#quelle", "dump");
  await page.setInputFiles("#dump", join(DIR, "altsystem-export.sql"));
  await page.click('button:has-text("Übernahme ausführen")');
  await page.waitForSelector("text=Übernahme abgeschlossen", { timeout: 120000 });

  check("Auch Altdaten bekommen eine Saison",
    sql(`select count(*) from purchase where "purchasedAt" is not null and season is null`) === "0",
    sql(`select string_agg(distinct season::text, ', ' order by season::text) from purchase`));
  check("Die Saison der Altdaten stimmt",
    sql(`select season from purchase p join product pr on pr.id=p."productId" where p."purchasedAt"='2023-08-14'`) === "2023");
  check("Ohne Kaufdatum bleibt die Saison leer",
    sql(`select count(*) from purchase where "purchasedAt" is null and season is not null`) === "0");
  check("Das Altsystem kannte keine Warengruppen — es werden auch keine erfunden",
    sql("select count(*) from product_category") === "0");
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden`);
process.exit(failed.length === 0 ? 0 : 1);
