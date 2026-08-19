/**
 * Prueft das Protokoll am laufenden System.
 *
 * Zwei Fragen: sieht ein Administrator wirklich alles, was ein Benutzer
 * anlegt — und landen die Meldungen der Anwendung selbst irgendwo, wo sie
 * jemand findet.
 *
 *   node scripts/protokoll-check.mjs [basisUrl] [datenbankUrl]
 */
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const B = process.argv[2] ?? "http://127.0.0.1:3000";
const DB = process.argv[3];
const EMAIL = process.env.SMOKE_EMAIL ?? "lgollenstede@gollenstede-sachverstand.de";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "LokalerTest12345";
const RUN = Date.now().toString(36).slice(-6);

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "  OK  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const sql = (q) =>
  DB ? execFileSync("psql", [DB, "-tAc", q], { encoding: "utf8" }).trim() : "";

const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
const chromiumDir = readdirSync(root).find((d) => d.startsWith("chromium-"));
const browser = await chromium.launch({
  executablePath: join(root, chromiumDir, "chrome-linux", "chrome"),
});
const page = await browser.newPage();
page.setDefaultTimeout(30_000);

async function settle() {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(400);
}
const zeilen = () => page.locator("tbody tr").count();

try {
  await page.goto(`${B}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });

  // ------------------------------------------------- Etwas anlegen und ändern
  await page.goto(`${B}/kunden/neu`);
  await settle();
  await page.fill("#firstName", "Protokoll");
  await page.fill("#lastName", `Test${RUN}`);
  await page.fill("#street", "Teststr. 1");
  await page.fill("#zip", "52062");
  await page.fill("#city", "Aachen");
  await page.fill("#email", `protokoll.${RUN}@example.de`);
  await page.click('button:has-text("Speichern")');
  // Nicht auf /kunden/<id> mustern: „/kunden/neu" passt darauf ebenfalls und
  // die Bedingung waere sofort erfuellt — die Kennung waere dann „neu".
  await page.waitForURL(
    (u) => /^\/kunden\/[a-z0-9]{20,}$/.test(u.pathname),
    { timeout: 20000 },
  );
  const kundeUrl = page.url();
  const kundeId = kundeUrl.split("/").pop();

  // Ein Segment — das war bis eben nicht protokolliert.
  await page.goto(`${B}/kunden?q=Test${RUN}`);
  await settle();
  await page.click('button:has-text("Als Segment speichern")');
  await page.fill("#segmentName", `Segment ${RUN}`);
  await page.click('form button:has-text("Speichern")');
  await page.waitForTimeout(1200);

  // --------------------------------------------------------- Änderungen
  await page.goto(`${B}/einstellungen/protokoll`);
  await settle();
  check("Das Protokoll hat zwei Bereiche",
    (await page.locator('a:has-text("Änderungen")').count()) > 0 &&
      (await page.locator('a:has-text("Anwendung")').count()) > 0);

  // Sichtbaren Text lesen, nicht `textContent("body")`: darin steckt auch die
  // Nutzlast der Server-Komponenten, und die enthaelt naturgemaess die
  // englischen Klassennamen.
  const tabelle = await page.locator("table").first().innerText();
  check("Das Anlegen des Kunden steht im Protokoll",
    /Angelegt/.test(tabelle) && /Kunde/.test(tabelle));
  const arten = await page.locator("#f_entity option").allInnerTexts();
  check("Die Objektart steht auf Deutsch da",
    arten.length > 1 && !arten.some((a) => /^Mail[A-Z]/.test(a.trim())),
    arten.join(" / "));

  // Nach Objekt-Kennung filtern
  await page.goto(`${B}/einstellungen/protokoll?kennung=${kundeId}`);
  await settle();
  check("Filter nach Objekt-Kennung findet den Kunden", (await zeilen()) >= 1,
    `${await zeilen()} Zeilen`);

  // Nach Benutzer filtern — der Weg des Administrators
  await page.goto(`${B}/einstellungen/benutzer`);
  await settle();
  // In der Tabelle suchen — in der Navigationsleiste steht ebenfalls
  // „Protokoll", und die fuehrt ohne Benutzerfilter dorthin.
  const protokollLink = page.locator('tbody a:has-text("Protokoll")').first();
  check("Die Benutzerliste führt direkt zum Protokoll",
    (await protokollLink.count()) > 0);
  await protokollLink.click();
  await page.waitForURL(/benutzer=/, { timeout: 20000 });
  await settle();
  const nachBenutzer = await zeilen();
  check("Der Benutzerfilter zeigt Einträge", nachBenutzer >= 1, `${nachBenutzer} Zeilen`);

  // Nach Aktion filtern
  await page.goto(`${B}/einstellungen/protokoll?aktion=CREATE`);
  await settle();
  const nurAngelegt = await page.locator("tbody tr td:nth-child(3)").allTextContents();
  check("Der Aktionsfilter zeigt nur Angelegtes",
    nurAngelegt.length > 0 && nurAngelegt.every((t) => t.trim() === "Angelegt"),
    nurAngelegt.slice(0, 3).join(" / "));

  // Zeitraum: morgen beginnend darf nichts liefern
  const morgen = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await page.goto(`${B}/einstellungen/protokoll?von=${morgen}`);
  await settle();
  check("Ein Zeitraum in der Zukunft liefert nichts", (await zeilen()) === 0,
    `${await zeilen()} Zeilen`);

  // Zurücksetzen
  await page.goto(`${B}/einstellungen/protokoll?aktion=CREATE`);
  await settle();
  await page.locator('button:has-text("Filter zurücksetzen")').click();
  await page.waitForURL((u) => !u.search.includes("aktion="), { timeout: 20000 });
  check("„Filter zurücksetzen“ räumt die Adresse auf",
    !page.url().includes("aktion="), new URL(page.url()).search);

  // Segmente hatten bis eben keinen Protokolleintrag.
  await page.goto(`${B}/einstellungen/protokoll?entity=Segment`);
  await settle();
  check("Auch ein angelegtes Segment steht im Protokoll", (await zeilen()) >= 1,
    `${await zeilen()} Zeilen`);

  // --------------------------------------------------------- Anwendung
  await page.goto(`${B}/einstellungen/protokoll?bereich=anwendung`);
  await settle();
  check("Der Bereich Anwendung ist erreichbar",
    /Anwendungsprotokoll/.test(await page.locator("main").innerText()));

  // Ein Absenderkonto anlegen, das nicht erreichbar ist, und pruefen lassen.
  // Das ist der Fall, den der Administrator spaeter im Protokoll sucht, wenn
  // ein Versand nicht anlief.
  await page.goto(`${B}/einstellungen/mailkonten`);
  await settle();
  await page.click('button:has-text("Provider anlegen")');
  await page.waitForTimeout(400);
  await page.fill("#providerName", `Nicht erreichbar ${RUN}`);
  await page.fill("#host", "127.0.0.1");
  await page.fill("#port", "1");
  await page.locator('.fixed button:has-text("Speichern")').click();
  await page.waitForTimeout(1200);

  await page.click('button:has-text("Konto anlegen")');
  await page.waitForTimeout(400);
  await page.fill("#label", `Testkonto ${RUN}`);
  await page.selectOption("#providerId", { label: `Nicht erreichbar ${RUN}` });
  await page.fill("#username", `konto.${RUN}@example.de`);
  await page.fill("#accountPassword", "geheim12345");
  await page.fill("#fromName", "Test");
  await page.fill("#fromEmail", `konto.${RUN}@example.de`);
  await page.locator('.fixed button:has-text("Speichern")').click();
  await page.waitForTimeout(1500);

  await page
    .locator("tbody tr", { hasText: `Testkonto ${RUN}` })
    .locator('button:has-text("Verbindung prüfen")')
    .click();
  await page.waitForTimeout(6000);

  await page.goto(`${B}/einstellungen/protokoll?bereich=anwendung&quelle=mailer`);
  await settle();
  const mailerText = (await zeilen()) > 0 ? await page.locator("table").first().innerText() : "";
  check("Eine fehlgeschlagene Verbindungsprüfung landet im Anwendungsprotokoll",
    mailerText.includes(`konto.${RUN}@example.de`), `${await zeilen()} Zeilen`);

  // Und die Pruefung selbst gehoert ins Aenderungsprotokoll.
  await page.goto(`${B}/einstellungen/protokoll?entity=MailAccount`);
  await settle();
  check("Die Verbindungsprüfung steht im Änderungsprotokoll",
    /geprueft/.test(await page.locator("table").first().innerText()));

  if (DB) {
    // Einträge aller drei Ebenen legen, damit sich der Filter prüfen lässt.
    for (const ebene of ["INFO", "WARN", "ERROR"]) {
      sql(`INSERT INTO app_log (id, level, source, message, "createdAt")
           VALUES ('pruef-${RUN}-${ebene}', '${ebene}', 'pruefung', 'Testmeldung ${ebene} ${RUN}', now())`);
    }
    await page.goto(`${B}/einstellungen/protokoll?bereich=anwendung&ebene=ERROR&quelle=pruefung`);
    await settle();
    const ebenen = await page.locator("tbody tr td:nth-child(2)").allTextContents();
    check("Der Ebenenfilter zeigt nur Fehler",
      ebenen.length === 1 && ebenen[0].trim() === "Fehler", ebenen.join(" / "));

    await page.goto(`${B}/einstellungen/protokoll?bereich=anwendung&suche=Testmeldung%20WARN%20${RUN}`);
    await settle();
    check("Die Suche in der Meldung greift", (await zeilen()) === 1,
      `${await zeilen()} Zeilen`);

    sql(`DELETE FROM app_log WHERE source = 'pruefung' AND message LIKE '%${RUN}%'`);
  } else {
    check("Der Ebenenfilter zeigt nur Fehler", true, "ohne Datenbank übersprungen");
    check("Die Suche in der Meldung greift", true, "ohne Datenbank übersprungen");
  }

  // Aufräumen
  await page.goto(kundeUrl);
  await settle();
  const loeschen = page.locator('button:has-text("Löschen")').first();
  if ((await loeschen.count()) > 0) await loeschen.click();
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden`);
process.exit(failed.length === 0 ? 0 : 1);
