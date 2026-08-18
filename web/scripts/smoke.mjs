/**
 * End-to-End-Rauchtest gegen eine laufende Instanz.
 * Fährt den Weg ab, den auch ein Anwender geht: anmelden, Kunde anlegen,
 * filtern, exportieren, Kampagne erzeugen.
 *
 *   node scripts/smoke.mjs [basisUrl]
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const EMAIL = process.env.SMOKE_EMAIL ?? "lgollenstede@gollenstede-sachverstand.de";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "LokalerTest12345";
// Eindeutig je Lauf, damit wiederholte Durchlaeufe nicht an der
// Dublettenpruefung haengenbleiben.
const RUN = Date.now().toString(36).slice(-6);
const LASTNAME = `Rauchtest${RUN}`;
const MAIL = `anna.${RUN}@example.de`;

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  OK  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
}

// Playwright-Browser liegen unter PLAYWRIGHT_BROWSERS_PATH; die konkrete
// Build-Nummer wird zur Laufzeit gesucht, damit der Test Updates uebersteht.
function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  const dir = readdirSync(root).find((d) => d.startsWith("chromium-"));
  if (!dir) return undefined;
  const candidate = join(root, dir, "chrome-linux", "chrome");
  return existsSync(candidate) ? candidate : undefined;
}

const browser = await chromium.launch({ executablePath: findChromium() });
const context = await browser.newContext();
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") {
    const at = msg.location();
    consoleErrors.push(`${msg.text()} @ ${at.url || "?"}`);
  }
});
// Fehlerhafte Antworten mit URL festhalten — eine nackte Konsolenmeldung
// sagt nicht, welche Ressource gefehlt hat.
const badResponses = [];
page.on("response", (response) => {
  if (response.status() >= 400) {
    badResponses.push(`${response.status()} ${response.url()}`);
  }
});

try {
  // 1. Ohne Anmeldung wird umgeleitet
  await page.goto(`${BASE}/kunden`, { waitUntil: "domcontentloaded" });
  check("Zugriffsschutz leitet auf /login um", page.url().includes("/login"));

  // 2. Falsches Passwort wird abgewiesen
  await page.fill("#email", EMAIL);
  await page.fill("#password", "definitivFalsch");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1200);
  check(
    "Falsches Passwort wird abgewiesen",
    await page.locator("text=E-Mail oder Passwort ist falsch").isVisible(),
  );

  // 3. Anmeldung
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  // Nach dem Login geht es zurueck zur urspruenglich angeforderten Seite.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15000,
  });
  check(
    "Anmeldung funktioniert und fuehrt zum Ziel zurueck",
    page.url().endsWith("/kunden"),
    page.url(),
  );

  // 4. Kunde anlegen inklusive Kauf
  await page.goto(`${BASE}/kunden/neu`);
  await page.fill("#firstName", "Anna");
  await page.fill("#lastName", LASTNAME);
  await page.fill("#street", "Teststraße 7");
  await page.fill("#zip", "52062");
  await page.fill("#city", "Aachen");
  await page.fill("#email", `  Anna.${RUN.toUpperCase()}@Example.DE  `);
  await page.fill("#phone", "0241 123456");
  await page.fill("#purchaseProduct-0", "Ergobag Cubo");
  await page.fill("#purchaseDate-0", "2024-08-14");
  await page.click('button:has-text("Speichern")');
  await page.waitForURL(/\/kunden\/(?!neu)[a-z0-9]+/, { timeout: 15000 });
  check("Kunde wird angelegt", true, page.url().split("/").pop());

  // 5. Normalisierung greift
  const body = await page.textContent("body");
  check(
    "E-Mail wird normalisiert gespeichert",
    body.includes(MAIL),
  );
  check("Telefon wird nach E.164 normalisiert", body.includes("+49241123456"));
  check("Kauf ist verknüpft", body.includes("Ergobag Cubo"));

  // 6. Dublettenwarnung beim zweiten Anlegen
  await page.goto(`${BASE}/kunden/neu`);
  await page.fill("#firstName", "Anna");
  await page.fill("#lastName", LASTNAME);
  await page.fill("#street", "Teststraße 7");
  await page.fill("#zip", "52062");
  await page.fill("#city", "Aachen");
  await page.fill("#email", MAIL);
  await page.click('button:has-text("Speichern")');
  await page.waitForTimeout(1500);
  check(
    "Dublettenwarnung erscheint",
    await page.locator("text=Mögliche Dublette").isVisible(),
  );

  // 7. Kombinierter Filter (Stichwort UND Zeitraum gleichzeitig)
  await page.goto(`${BASE}/kunden?q=${LASTNAME}&from=2024-01-01&to=2024-12-31`);
  await page.waitForTimeout(600);
  check(
    "Stichwort und Zeitraum wirken gemeinsam",
    (await page.textContent("body")).includes(LASTNAME),
  );

  await page.goto(`${BASE}/kunden?q=${LASTNAME}&from=2030-01-01`);
  await page.waitForTimeout(600);
  check(
    "Zeitraum schließt korrekt aus",
    (await page.textContent("body")).includes("Keine Treffer"),
  );

  // 8. + 9. Export. Bewusst aus dem Seitenkontext heraus: das Sitzungscookie
  // traegt das Secure-Flag, und Playwrights API-Client sendet es ueber http
  // nicht mit — der Browser selbst tut es.
  const csvResult = await page.evaluate(async (url) => {
    const response = await fetch(url);
    const buffer = new Uint8Array(await response.arrayBuffer());
    return {
      status: response.status,
      type: response.headers.get("content-type"),
      firstBytes: [...buffer.slice(0, 4)],
      text: new TextDecoder("utf-8", { ignoreBOM: true }).decode(buffer),
    };
  }, `${BASE}/api/export/kunden?q=${LASTNAME}&format=csv`);

  check("CSV-Export antwortet", csvResult.status === 200, csvResult.type ?? "");
  check(
    "CSV hat UTF-8-BOM",
    csvResult.firstBytes[0] === 0xef &&
      csvResult.firstBytes[1] === 0xbb &&
      csvResult.firstBytes[2] === 0xbf,
  );
  check("CSV nutzt Semikolon", csvResult.text.includes("Vorname;Nachname"));
  check("CSV enthält den Datensatz", csvResult.text.includes(LASTNAME));
  check(
    "CSV enthält Telefonnummer entschärft",
    csvResult.text.includes("'+49241123456"),
  );

  const xlsxResult = await page.evaluate(async (url) => {
    const response = await fetch(url);
    const buffer = new Uint8Array(await response.arrayBuffer());
    return { status: response.status, firstBytes: [...buffer.slice(0, 2)] };
  }, `${BASE}/api/export/kunden?q=${LASTNAME}&format=xlsx`);

  check(
    "XLSX-Export liefert eine Arbeitsmappe",
    xlsxResult.status === 200 &&
      xlsxResult.firstBytes[0] === 0x50 &&
      xlsxResult.firstBytes[1] === 0x4b,
  );

  // 10. Produktseite
  await page.goto(`${BASE}/produkte`);
  check(
    "Produkt wurde automatisch angelegt",
    (await page.textContent("body")).includes("Ergobag Cubo"),
  );

  // 11. Vorlagenliste. Bewusst nicht an einen bestimmten Namen gebunden —
  // der Bestand haengt davon ab, was geseedet oder importiert wurde.
  await page.goto(`${BASE}/vorlagen`);
  const templateBody = await page.textContent("body");
  check(
    "Vorlagenseite zeigt Bestand oder Leerzustand",
    templateBody.includes("Betreff") || templateBody.includes("Noch keine Vorlage"),
  );

  // 12. Kampagne ohne Absenderkonto wird sauber abgefangen
  await page.goto(`${BASE}/kampagnen/neu?quelle=filter&q=${LASTNAME}`);
  const campaignBody = await page.textContent("body");
  const noAccount = campaignBody.includes("Kein Absenderkonto hinterlegt");
  check(
    noAccount
      ? "Fehlendes Absenderkonto wird erklärt"
      : "Kampagnenformular zeigt Empfängerzahl",
    noAccount || campaignBody.includes("werden angeschrieben"),
  );

  // 13. Protokoll hat die Aktionen erfasst
  await page.goto(`${BASE}/einstellungen/protokoll`);
  const auditBody = await page.textContent("body");
  check("Protokoll erfasst Anmeldung", auditBody.includes("Anmeldung"));
  check("Protokoll erfasst Export", auditBody.includes("Export"));

  // 14. Abmelden
  await page.click('header button:has-text("Abmelden")');
  await page.waitForURL(/\/login/, { timeout: 10000 });
  check("Abmelden beendet die Sitzung", page.url().includes("/login"));

  await page.goto(`${BASE}/kunden`, { waitUntil: "domcontentloaded" });
  check(
    "Nach Abmelden kein Zugriff mehr",
    page.url().includes("/login"),
  );

  check(
    "Keine fehlerhaften Antworten",
    badResponses.length === 0,
    badResponses.slice(0, 3).join(" | "),
  );
  check(
    "Keine Fehler in der Browser-Konsole",
    consoleErrors.length === 0,
    consoleErrors.slice(0, 2).join(" | "),
  );
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} Prüfungen bestanden`,
);
process.exit(failed.length === 0 ? 0 : 1);
