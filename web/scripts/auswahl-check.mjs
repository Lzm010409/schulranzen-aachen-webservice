/**
 * Prueft, dass die Kundenauswahl das Blaettern ueberlebt.
 *
 *   node scripts/auswahl-check.mjs [basisUrl]
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const B = process.argv[2] ?? "http://127.0.0.1:3000";
const EMAIL = process.env.SMOKE_EMAIL ?? "lgollenstede@gollenstede-sachverstand.de";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "LokalerTest12345";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "  OK  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
const chromiumDir = readdirSync(root).find((d) => d.startsWith("chromium-"));
const browser = await chromium.launch({
  executablePath: join(root, chromiumDir, "chrome-linux", "chrome"),
});
const page = await browser.newPage();
page.setDefaultTimeout(30_000);

const settle = async () => {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(500);
};

/**
 * Wartet, bis so viele Haken gesetzt sind wie erwartet.
 *
 * Bewusst als Schleife und nicht mit `waitForFunction`: solange die Navigation
 * noch laeuft, stirbt der Ausfuehrungskontext, die Funktion wirft — und ein
 * `catch` daneben laesst die Pruefung zu frueh weiterlaufen.
 */
async function wartenAufHaken(erwartet, ms = 15000) {
  const bis = Date.now() + ms;
  while (Date.now() < bis) {
    try {
      if ((await angehakt()) === erwartet) return;
    } catch {
      // Kontext gerade weggeraeumt — gleich noch einmal versuchen.
    }
    await page.waitForTimeout(250);
  }
}
const stand = async () => (await page.textContent("body")).match(/([\d.]+) ausgewählt/)?.[1] ?? "0";
const haken = () => page.locator('tbody input[name="selected"]');
// Der Zusatz gehoert an denselben Knoten: `.locator(":checked")` suchte
// innerhalb der Checkbox und fand naturgemaess nie etwas.
const angehakt = async () =>
  page.locator('tbody input[name="selected"]:checked').count();

try {
  await page.goto(`${B}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });

  await page.goto(`${B}/kunden?proSeite=25`);
  await settle();

  // Drei Kunden auf Seite 1 anhaken
  for (const i of [0, 1, 2]) await haken().nth(i).check();
  await page.waitForTimeout(400);
  check("Auswahl auf Seite 1 wird gezählt", (await stand()) === "3", await stand());

  // Blättern
  await page.locator('nav a:has-text("Weiter")').first().click();
  await page.waitForURL(/seite=2/, { timeout: 30000 });
  await settle();
  check("Nach dem Blättern ist die Auswahl noch da",
    (await stand()) === "3", await stand());
  check("Auf Seite 2 ist nichts fälschlich angehakt",
    (await angehakt()) === 0, `${await angehakt()} Haken`);

  // Auf Seite 2 zwei weitere
  for (const i of [0, 1]) await haken().nth(i).check();
  await page.waitForTimeout(400);
  check("Auswahl über zwei Seiten summiert sich",
    (await stand()) === "5", await stand());

  // Zurück auf Seite 1: die alten Haken müssen wieder stehen
  await page.locator('nav a:has-text("Zurück")').first().click();
  await page.waitForURL((u) => !u.searchParams.get("seite") || u.searchParams.get("seite") === "1", { timeout: 30000 });
  await settle();
  // Das Wiederherstellen der Haken läuft nach dem Hydrieren; darauf warten,
  // statt einen festen Wert zu raten.
  await wartenAufHaken(3);
  check("Zurück auf Seite 1 stehen die Haken wieder",
    (await angehakt()) === 3, `${await angehakt()} Haken`);
  check("Der Zähler bleibt bei fünf", (await stand()) === "5", await stand());

  // Seitengröße ändern darf die Auswahl nicht verwerfen
  await page.locator(".page-size-select").first().selectOption("50");
  await page.waitForURL(/proSeite=50/, { timeout: 30000 });
  await settle();
  check("Andere Seitengröße lässt die Auswahl stehen",
    (await stand()) === "5", await stand());

  // Auswahl aufheben
  await page.locator('button:has-text("Auswahl aufheben")').click();
  await page.waitForTimeout(400);
  check("„Auswahl aufheben“ setzt zurück", (await stand()) === "0", await stand());
  check("Danach ist kein Haken mehr gesetzt", (await angehakt()) === 0);

  // Ein anderer Filter beginnt eine neue Auswahl
  await page.goto(`${B}/kunden?proSeite=25`);
  await settle();
  for (const i of [0, 1]) await haken().nth(i).check();
  await page.waitForTimeout(400);
  check("Neue Auswahl angelegt", (await stand()) === "2", await stand());

  await page.goto(`${B}/kunden?proSeite=25&q=berger`);
  await settle();
  check("Ein anderer Filter beginnt von vorn", (await stand()) === "0", await stand());
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden`);
process.exit(failed.length === 0 ? 0 : 1);
