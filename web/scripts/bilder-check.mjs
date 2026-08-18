/**
 * Prueft die Bildablage am laufenden System.
 *
 * Der Anlass: eine Vorlage mit einem eingebetteten Bild (`data:`-URI) kommt
 * bei Gmail leer an und wird ab etwa 102 KB abgeschnitten. Beim Speichern
 * muss das Bild deshalb in der Ablage landen und in der Vorlage nur noch als
 * Adresse stehen — abrufbar ohne Anmeldung, denn das Mailprogramm des
 * Empfaengers hat keine Sitzung.
 *
 *   node scripts/bilder-check.mjs [basisUrl]
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

// Kleinstes gueltiges GIF; es geht um den Weg, nicht um das Motiv.
const GIF = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

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

try {
  await page.goto(`${B}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });

  // ------------------------------------------------- Vorlage wie vom Nutzer
  // Genau der Aufbau, der bei Gmail scheitert: Bild eingebettet, Platzhalter
  // hinter </body>.
  await page.goto(`${B}/vorlagen/neu`);
  await settle();
  await page.fill("#name", `Bildablage ${RUN}`);
  await page.fill("#subject", "Bildablage");
  const body = `<html><body><img src="data:image/gif;base64,${GIF}" alt="Image" /></body>{{anrede}},{{content}}</html>`;
  await page.fill('textarea[name="body"]', body);

  const warnungen = await page.locator(".alert, [role=alert]").allTextContents();
  const gesamt = warnungen.join(" ");
  check("Der Editor meldet das eingebettete Bild", /data:/i.test(gesamt), gesamt.slice(0, 80));
  check("Der Editor meldet Text hinter </body>", /hinter <\/body>/i.test(gesamt));

  await page.click('button:has-text("Speichern")');
  await page.waitForURL(/\/vorlagen\/[a-z0-9]+$/, { timeout: 20000 });
  await settle();

  const meldung = (await page.locator(".flash").first().textContent())?.trim() ?? "";
  check("Das Speichern meldet die Auslagerung", /ausgelagert/i.test(meldung), meldung);

  // ----------------------------------------------- Vorlage nach dem Speichern
  const gespeichert = await page.content();
  check("Die Vorlage enthält kein data:-Bild mehr", !/data:image/i.test(gespeichert));
  const treffer = gespeichert.match(/\/bilder\/([a-z0-9]+)\.gif/);
  check("Die Vorlage verweist auf die Bildablage", Boolean(treffer), treffer?.[0] ?? "");

  if (treffer) {
    // Absolut, sonst zeigt der Verweis im Mailprogramm ins Leere.
    check("Der Verweis ist absolut", /https?:\/\/[^"']*\/bilder\//.test(gespeichert));

    const url = `${B}${treffer[0]}`;
    const antwort = await page.request.get(url);
    check("Das Bild wird ausgeliefert", antwort.status() === 200, String(antwort.status()));
    check("Der Inhaltstyp stimmt",
      (antwort.headers()["content-type"] ?? "").startsWith("image/gif"),
      antwort.headers()["content-type"]);
    check("Das Bild darf zwischengespeichert werden",
      /max-age=\d{5,}/.test(antwort.headers()["cache-control"] ?? ""),
      antwort.headers()["cache-control"]);

    // Ohne Anmeldung erreichbar — der Empfaenger hat keine Sitzung.
    const anonym = await browser.newContext();
    const anonymeAntwort = await anonym.request.get(url);
    check("Das Bild ist ohne Anmeldung erreichbar", anonymeAntwort.status() === 200,
      String(anonymeAntwort.status()));
    await anonym.close();

    // Eine erfundene Kennung darf nichts ausliefern.
    const unbekannt = await page.request.get(`${B}/bilder/gibtesnicht.gif`);
    check("Unbekannte Bilder ergeben 404", unbekannt.status() === 404,
      String(unbekannt.status()));
  }

  // ------------------------------------------------------ Dasselbe Bild erneut
  await page.goto(`${B}/vorlagen/neu`);
  await settle();
  await page.fill("#name", `Bildablage zwei ${RUN}`);
  await page.fill("#subject", "Bildablage");
  await page.fill('textarea[name="body"]',
    `<table role="presentation"><tr><td style="font-family:Arial"><img src="data:image/gif;base64,${GIF}" width="600" alt="Bild" />{{content}}</td></tr></table>`);
  await page.click('button:has-text("Speichern")');
  await page.waitForURL(/\/vorlagen\/[a-z0-9]+$/, { timeout: 20000 });
  await settle();
  const zweite = (await page.content()).match(/\/bilder\/([a-z0-9]+)\.gif/);
  check("Dasselbe Bild bekommt dieselbe Adresse",
    Boolean(zweite) && zweite[1] === treffer?.[1], `${zweite?.[1]} vs ${treffer?.[1]}`);

  // ------------------------------------------------------------- Kampagne
  // Auch der Kampagnentext geht durch dieselbe Behandlung.
  await page.goto(`${B}/vorlagen`);
  await settle();
  check("Die Vorlagenliste zeigt die neue Vorlage",
    (await page.locator(`text=Bildablage ${RUN}`).count()) > 0);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden`);
process.exit(failed.length === 0 ? 0 : 1);
