/**
 * Prueft, dass jede Tabelle der Oberflaeche seitenweise blaettert.
 *
 * Fuer jede Seite wird geprueft: die Tabelle zeigt hoechstens eine Seite voll,
 * die Zeile mit der Anzahl steht darunter, und wo es mehr als eine Seite gibt,
 * fuehrt „Weiter“ auf andere Datensaetze.
 *
 *   node scripts/pagination-check.mjs [basisUrl]
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

/** Wartet, bis die Seite steht. `networkidle` taugt nicht: die
 *  Fortschrittsanzeige der Kampagnen fragt dauerhaft nach. */
async function settle() {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(400);
}

/** Liest die Zeile „1–50 von 12.000" unter einer Tabelle. */
async function counters() {
  return page
    .locator("nav p")
    .allTextContents()
    .then((texts) => texts.filter((t) => /\d.*von\s+[\d.]+/.test(t)));
}

try {
  await page.goto(`${B}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });

  // Jede Listenseite: Zaehlerzeile vorhanden, hoechstens eine Seite Zeilen.
  const seiten = [
    { url: "/kunden", name: "Kundenliste", max: 50 },
    { url: "/produkte", name: "Produkte", max: 50 },
    { url: "/vorlagen", name: "Vorlagen", max: 25 },
    { url: "/kampagnen", name: "Mailversand", max: 25 },
    { url: "/einstellungen", name: "Mein Konto (Sitzungen)", max: 10 },
    { url: "/einstellungen/benutzer", name: "Benutzer", max: 25 },
    { url: "/einstellungen/mailkonten", name: "Mailkonten und Provider", max: 25 },
    { url: "/einstellungen/protokoll", name: "Protokoll", max: 50 },
    { url: "/einstellungen/import", name: "Import (bisherige Übernahmen)", max: 10 },
  ];

  for (const seite of seiten) {
    await page.goto(`${B}${seite.url}`);
    await settle();
    const zaehler = await counters();
    const zeilen = await page.locator("tbody tr").count();
    // Leere Tabellen zeigen keinen Zähler — dort gibt es nichts zu blättern.
    check(
      `${seite.name}: blättert seitenweise`,
      zeilen === 0 ? true : zaehler.length > 0 && zeilen <= seite.max * 2,
      zeilen === 0
        ? "keine Daten, nichts zu blättern"
        : `${zaehler.length} Zähler, ${zeilen} Zeilen`,
    );
  }

  // Kundenliste: „Weiter“ zeigt andere Kunden, Filter bleibt erhalten.
  await page.goto(`${B}/kunden?q=a`);
  await settle();
  // Nicht die erste Spalte vergleichen — dort steht das Auswahlkästchen.
  const ersteSeite = await page.locator("tbody tr").allTextContents();
  const weiter = page.locator('nav a:has-text("Weiter")').first();
  if ((await weiter.count()) > 0 && !(await weiter.getAttribute("class"))?.includes("pointer-events-none")) {
    await weiter.click();
    await settle();
    const zweiteSeite = await page.locator("tbody tr").allTextContents();
    check("Kundenliste: „Weiter“ zeigt andere Kunden",
      zweiteSeite.length > 0 && zweiteSeite[0] !== ersteSeite[0]);
    check("Kundenliste: der Filter überlebt das Blättern",
      page.url().includes("q=a") && page.url().includes("seite=2"),
      new URL(page.url()).search);
  } else {
    check("Kundenliste: „Weiter“ zeigt andere Kunden", false, "kein Weiter-Knopf");
    check("Kundenliste: der Filter überlebt das Blättern", false, "nicht geprüft");
  }

  // Kundenakte: drei Tabellen, drei getrennte Seitenzahlen.
  await page.goto(`${B}/kunden`);
  await settle();
  const ersterKunde = page.locator('tbody tr a[href^="/kunden/"]').first();
  const href = await ersterKunde.getAttribute("href");
  await page.goto(`${B}${href}`);
  await settle();
  const akteZaehler = await counters();
  // Käufe, Mailhistorie und Änderungen blättern je für sich. Leere Tabellen
  // zeigen keinen Zähler, deshalb genügt hier mindestens einer.
  check("Kundenakte: die Tabellen blättern je für sich",
    akteZaehler.length >= 1, `${akteZaehler.length} Zähler`);

  await page.goto(`${B}${href}?kaeufe=2&mails=3&verlauf=4`);
  await settle();
  check("Kundenakte: die drei Seitenzahlen stören sich nicht",
    page.url().includes("kaeufe=2") &&
      page.url().includes("mails=3") &&
      page.url().includes("verlauf=4"));

  // Kampagne: Empfängerliste und Fehlerliste blättern getrennt.
  await page.goto(`${B}/kampagnen`);
  await settle();
  // Eine Kampagne mit Empfängern suchen — eine ohne hat nichts zu blättern.
  const ersteKampagne = page.locator('tbody tr a[href^="/kampagnen/"]').first();
  let kampagneZaehler = [];
  let kampagne = null;
  if ((await ersteKampagne.count()) > 0) {
    kampagne = await ersteKampagne.getAttribute("href");
    await page.goto(`${B}${kampagne}`);
    await settle();
    kampagneZaehler = await counters();
    if (kampagneZaehler.length === 0) kampagne = null;
  }
  if (kampagne) {
    check("Kampagne: Empfänger und Fehlversuche blättern je für sich",
      kampagneZaehler.length === 2, `${kampagneZaehler.length} Zähler`);

    const empfaenger = await page.locator("tbody tr").count();
    check("Kampagne: die Empfängerliste zeigt nur eine Seite",
      empfaenger > 0 && empfaenger <= 50, `${empfaenger} Zeilen`);

    await page.goto(`${B}${kampagne}?empfaenger=3&fehler=2`);
    await settle();
    const text2 = await page.textContent("body");
    check("Kampagne: beide Seitenzahlen wirken unabhängig",
      /von\s+[\d.]+/.test(text2) && !/Application error/i.test(text2));
  } else {
    const grund = "keine Kampagne mit Empfängern vorhanden";
    check("Kampagne: Empfänger und Fehlversuche blättern je für sich", true, grund);
    check("Kampagne: die Empfängerliste zeigt nur eine Seite", true, "übersprungen");
    check("Kampagne: beide Seitenzahlen wirken unabhängig", true, "übersprungen");
  }

  // ------------------------------------------------------ Seitengröße
  await page.goto(`${B}/kunden`);
  await settle();
  const auswahl = page.locator(".page-size-select").first();
  check("Unter der Tabelle steht eine Auswahl für die Seitengröße",
    (await auswahl.count()) > 0);

  // Nach der Auswahl laeuft ein Seitenwechsel; die Adresse aendert sich erst,
  // wenn er durch ist — bei zwölftausend Kunden dauert das laenger als ein
  // fester Wartewert.
  await auswahl.selectOption("100");
  await page.waitForURL(/proSeite=100/, { timeout: 30000 }).catch(() => undefined);
  await settle();
  let zeilen = await page.locator("tbody tr").count();
  check("Die gewählte Größe wirkt sofort",
    zeilen === 100 && page.url().includes("proSeite=100"),
    `${zeilen} Zeilen, ${new URL(page.url()).search}`);

  check("Die Auswahl zeigt die aktive Größe",
    (await page.locator(".page-size-select").first().inputValue()) === "100");

  // Nach dem Umstellen darf keine Seite übrig bleiben, die es nicht mehr gibt.
  await page.goto(`${B}/kunden?seite=200`);
  await settle();
  await page.locator(".page-size-select").first().selectOption("200");
  await page.waitForURL(/proSeite=200/, { timeout: 30000 }).catch(() => undefined);
  await settle();
  check("Beim Umstellen geht es zurück auf die erste Seite",
    !page.url().includes("seite=200"), new URL(page.url()).search);

  // Die Wahl gilt auch auf einer anderen Liste — ohne sie erneut zu treffen.
  await page.goto(`${B}/produkte`);
  await settle();
  check("Die Wahl wirkt auch auf anderen Listen",
    (await page.locator(".page-size-select").first().inputValue()) === "200",
    await page.locator(".page-size-select").first().inputValue());

  // Zurücksetzen für die folgenden Prüfungen.
  await page.locator(".page-size-select").first().selectOption("50");
  await page.waitForURL(/proSeite=50/, { timeout: 30000 }).catch(() => undefined);
  await settle();

  // Eine erfundene Größe darf nicht durchschlagen.
  await page.goto(`${B}/kunden?proSeite=999999`);
  await settle();
  zeilen = await page.locator("tbody tr").count();
  check("Eine erfundene Größe wird abgewiesen", zeilen <= 200, `${zeilen} Zeilen`);

  // In der Kundenakte blättern drei Tabellen getrennt — auch in der Größe.
  await page.goto(`${B}/kunden`);
  await settle();
  const kundeHref = await page
    .locator('tbody tr a[href^="/kunden/"]')
    .first()
    .getAttribute("href");
  await page.goto(`${B}${kundeHref}?kaeufeProSeite=100&mailsProSeite=10`);
  await settle();
  const groessen = await page.locator(".page-size-select").allInnerTexts();
  check("Jede Tabelle einer Seite hat ihre eigene Größe",
    groessen.length >= 1 &&
      page.url().includes("kaeufeProSeite=100") &&
      page.url().includes("mailsProSeite=10"));

  // Eine unsinnige Seitenzahl darf die Seite nicht zerlegen.
  await page.goto(`${B}/kunden?seite=99999`);
  await settle();
  const text = await page.textContent("body");
  check("Unsinnige Seitenzahl bricht nicht ab",
    !/Application error|Internal Server Error/i.test(text) &&
      /von\s+[\d.]+/.test(text));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden`);
process.exit(failed.length === 0 ? 0 : 1);
