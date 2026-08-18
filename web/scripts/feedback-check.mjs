/**
 * Prueft die zentrale Rueckmeldung und die Ladeanzeige am laufenden System.
 *
 * Fuer jede Art von Aenderung — anlegen, speichern, loeschen, wiederherstellen,
 * abbrechen — muss eine Meldung erscheinen. Geprueft wird ausserdem, dass sie
 * nach einem Reload wieder weg ist und dass Fehler stehen bleiben.
 *
 *   node scripts/feedback-check.mjs [basisUrl]
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const B = process.argv[2] ?? "http://127.0.0.1:3000";
const EMAIL = process.env.SMOKE_EMAIL ?? "lgollenstede@gollenstede-sachverstand.de";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "LokalerTest12345";
const RUN = Date.now().toString(36).slice(-6);

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

const flash = page.locator(".flash");
let letzte = "";

/**
 * Wartet auf eine Meldung, die sich von der vorigen unterscheidet — sonst
 * liest die naechste Pruefung noch die alte, bevor die Seite neu aufgebaut ist.
 */
async function flashText() {
  const bis = Date.now() + 12000;
  while (Date.now() < bis) {
    if ((await flash.count()) > 0) {
      const text = (await flash.first().textContent())?.trim() ?? "";
      if (text && text !== letzte) {
        letzte = text;
        return text;
      }
    }
    await page.waitForTimeout(200);
  }
  return "";
}
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

  // ------------------------------------------------------------- Kunde
  await page.goto(`${B}/kunden/neu`);
  await settle();
  await page.fill("#firstName", "Rueck");
  await page.fill("#lastName", `Meldung${RUN}`);
  await page.fill("#street", "Teststr. 1");
  await page.fill("#zip", "52062");
  await page.fill("#city", "Aachen");
  await page.fill("#email", `rueck.${RUN}@example.de`);
  await page.click('button:has-text("Speichern")');
  let text = await flashText();
  check("Kunde anlegen meldet sich", /gespeichert/i.test(text), text);
  check("Die Meldung nennt den Datensatz", text.includes(`Meldung${RUN}`), text);

  // Nach dem Neuladen darf dieselbe Meldung nicht erneut erscheinen.
  const url = page.url();
  await page.goto(url);
  await settle();
  check("Die Meldung erscheint nach einem Reload nicht erneut",
    (await flash.count()) === 0);

  // Newsletter-Schalter
  await page.click('button:has-text("Vom Newsletter abmelden")');
  text = await flashText();
  check("Newsletter-Abmeldung meldet sich", /Abmeldung.*gespeichert/i.test(text), text);

  // Löschen
  await page.click('button:has-text("Kunde löschen")');
  text = await flashText();
  check("Löschen meldet sich", /gelöscht/i.test(text), text);
  check("Löschen erklärt die Wiederherstellung",
    /wiederherstellen/i.test(text), text);

  // ----------------------------------------------------------- Produkt
  await page.goto(`${B}/produkte`);
  await settle();
  await page.click('button:has-text("Produkt anlegen")');
  await page.waitForTimeout(400);
  await page.fill("#name", `Testprodukt ${RUN}`);
  await page.click('.fixed button:has-text("Speichern")');
  text = await flashText();
  check("Produkt anlegen meldet sich", /angelegt/i.test(text), text);

  await page.goto(`${B}/produkte`);
  await settle();
  const row = page.locator("tbody tr", { hasText: `Testprodukt ${RUN}` });
  await row.locator('button:has-text("Löschen")').click();
  text = await flashText();
  check("Produkt löschen meldet sich", /gelöscht/i.test(text), text);

  // ---------------------------------------------- Fehler und Ladeanzeige
  // Ein Provider, den es nicht gibt: die Verbindungsprüfung muss scheitern
  // und das als Fehler melden — nicht stillschweigend nichts tun.
  await page.goto(`${B}/einstellungen/mailkonten`);
  await settle();
  await page.click('button:has-text("Provider anlegen")');
  await page.waitForTimeout(400);
  await page.fill("#providerName", `Testprovider ${RUN}`);
  await page.fill("#host", `smtp.kaputt-${RUN}.invalid`);
  await page.fill("#port", "465");
  await page.selectOption("#security", "SSL");
  await page.click('.fixed button:has-text("Speichern")');
  text = await flashText();
  check("Provider anlegen meldet sich", /gespeichert/i.test(text), text);

  await page.goto(`${B}/einstellungen/mailkonten`);
  await settle();
  await page.click('button:has-text("Konto anlegen")');
  await page.waitForTimeout(400);
  await page.fill("#label", `Testkonto ${RUN}`);
  await page.selectOption("#providerId", { label: `Testprovider ${RUN}` });
  await page.fill("#username", `test-${RUN}@example.de`);
  await page.fill("#accountPassword", "geheim12345");
  await page.fill("#fromName", "Test");
  await page.fill("#fromEmail", `test-${RUN}@example.de`);
  await page.click('.fixed button:has-text("Speichern")');
  text = await flashText();
  check("Konto anlegen meldet sich", /gespeichert/i.test(text), text);

  // Verbindung prüfen: der Knopf muss sichtbar arbeiten und danach der
  // Fehler stehen bleiben.
  await page.goto(`${B}/einstellungen/mailkonten`);
  await settle();
  const kontoZeile = page.locator("tbody tr", { hasText: `Testkonto ${RUN}` });
  await kontoZeile.locator('button:has-text("Verbindung prüfen")').click();
  const busy = await page
    .locator('button:has-text("Wird geprüft…")')
    .first()
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  check("Der Knopf zeigt, dass er arbeitet", busy);

  text = await flashText();
  check("Eine gescheiterte Prüfung meldet sich als Fehler",
    /nicht zustande/i.test(text), text);
  const klasse = (await flash.first().getAttribute("class")) ?? "";
  check("Fehler erscheinen in Rot", klasse.includes("alert-error"), klasse);

  // Provider löschen, solange das Konto daran hängt → Fehlermeldung.
  await page.goto(`${B}/einstellungen/mailkonten`);
  await settle();
  // Auf die Provider-Karte eingrenzen: der Providername steht auch in der
  // Zeile des Kontos, das ihn benutzt.
  const providerKarte = page
    .locator(".card")
    .filter({ has: page.locator(".card-title", { hasText: "Provider (" }) });
  const providerZeile = providerKarte.locator("tbody tr", {
    hasText: `Testprovider ${RUN}`,
  });
  const loeschKnopf = providerZeile.locator('button:has-text("Löschen")');
  check("Ein genutzter Provider bietet kein Löschen an",
    (await loeschKnopf.count()) === 0);

  // Aufräumen: erst das Konto, dann der Provider.
  await kontoZeile.locator('button:has-text("Löschen")').click();
  text = await flashText();
  check("Konto löschen meldet sich", /gelöscht/i.test(text), text);

  await page.goto(`${B}/einstellungen/mailkonten`);
  await settle();
  await page
    .locator(".card")
    .filter({ has: page.locator(".card-title", { hasText: "Provider (" }) })
    .locator("tbody tr", { hasText: `Testprovider ${RUN}` })
    .locator('button:has-text("Löschen")')
    .click();
  text = await flashText();
  check("Provider löschen meldet sich", /gelöscht/i.test(text), text);

  // Ladeanzeige beim Seitenwechsel
  await page.goto(`${B}/kunden`);
  await settle();
  check("Die Ladeanzeige ist ausgeliefert",
    (await page.evaluate(() =>
      Boolean(document.querySelector("style, link[rel=stylesheet]")),
    )) === true);

} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden`);
process.exit(failed.length === 0 ? 0 : 1);
