/**
 * Prueft die Rechte am laufenden System: legt ein eingeschraenktes Konto an,
 * meldet sich damit an und kontrolliert, was sichtbar und was gesperrt ist.
 *
 *   node scripts/permissions-check.mjs [basisUrl]
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const B = process.argv[2] ?? "http://127.0.0.1:3000";
const ADMIN = process.env.SMOKE_EMAIL ?? "lgollenstede@gollenstede-sachverstand.de";
const ADMIN_PW = process.env.SMOKE_PASSWORD ?? "LokalerTest12345";
const RUN = Date.now().toString(36).slice(-6);
const STAFF = `leser.${RUN}@example.de`;
const STAFF_PW = "NurLesen12345678";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "  OK  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
const dir = readdirSync(root).find((d) => d.startsWith("chromium-"));
const browser = await chromium.launch({
  executablePath: join(root, dir, "chrome-linux", "chrome"),
});

async function login(page, email, password) {
  await page.goto(`${B}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
    timeout: 15000,
  });
}

try {
  // 1. Als Administrator ein Konto mit der Vorlage "Nur Lesen" anlegen
  const admin = await browser.newContext();
  const adminPage = await admin.newPage();
  await login(adminPage, ADMIN, ADMIN_PW);

  await adminPage.goto(`${B}/einstellungen/benutzer`);
  await adminPage.click('button:has-text("Benutzer anlegen")');
  await adminPage.fill("#userName", "Test Leser");
  await adminPage.fill("#userEmail", STAFF);
  await adminPage.fill("#userPassword", STAFF_PW);
  await adminPage.click('button:has-text("Nur Lesen")');
  await adminPage.waitForTimeout(300);
  await adminPage.click('button:has-text("Speichern")');
  await adminPage.waitForTimeout(2000);

  const listBody = await adminPage.textContent("body");
  check("Konto wurde angelegt", listBody.includes(STAFF));
  check(
    "Rechteanzahl wird angezeigt",
    /\d+ von \d+/.test(listBody),
  );

  // 2. Mit dem eingeschraenkten Konto anmelden
  const staff = await browser.newContext();
  const page = await staff.newPage();
  await login(page, STAFF, STAFF_PW);

  // Navigation: Einstellungen bleibt (eigenes Konto), Benutzerverwaltung nicht
  const nav = await page.textContent(".app-drawer");
  check("Navigation zeigt Kunden", nav.includes("Kunden"));
  check("Navigation zeigt Mail", nav.includes("Mail"));

  // 3. Lesen ist erlaubt
  await page.goto(`${B}/kunden`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  check("Kundenliste ist erreichbar", page.url().endsWith("/kunden"));

  const kundenBody = await page.textContent("body");
  check(
    "Knopf „Kunde anlegen“ ist ausgeblendet",
    !kundenBody.includes("Kunde anlegen"),
  );
  check(
    "Export-Knöpfe sind ausgeblendet",
    !kundenBody.includes("CSV exportieren"),
  );
  check(
    "Knopf „Mail an Auswahl“ ist ausgeblendet",
    !kundenBody.includes("Mail an Auswahl"),
  );

  // 4. Gesperrte Seiten leiten um
  for (const [path, label] of [
    ["/kunden/neu", "Kunde anlegen"],
    ["/kampagnen/neu", "Kampagne anlegen"],
    ["/vorlagen/neu", "Vorlage anlegen"],
    ["/einstellungen/mailkonten", "Mailkonten"],
  ]) {
    await page.goto(B + path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    check(`Gesperrt: ${label}`, !page.url().includes(path), page.url());
  }

  // 5. Protokoll bleibt verwehrt
  await page.goto(`${B}/einstellungen/protokoll`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(400);
  check(
    "Protokoll verweigert den Zugriff",
    (await page.textContent("body")).includes("fehlt Ihnen die Berechtigung"),
  );

  // 6. Benutzerverwaltung bleibt verwehrt
  await page.goto(`${B}/einstellungen/benutzer`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(400);
  check(
    "Benutzerverwaltung ist Administratoren vorbehalten",
    (await page.textContent("body")).includes("Administratoren vorbehalten"),
  );

  // 7. Der Export-Endpunkt weist auch direkt aufgerufen ab
  const exportStatus = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return response.status;
  }, `${B}/api/export/kunden?format=csv`);
  check("Export-Endpunkt antwortet mit 403", exportStatus === 403, String(exportStatus));

  // 8. Aufräumen
  await adminPage.goto(`${B}/einstellungen/benutzer`);
  await adminPage.waitForTimeout(300);
  const row = adminPage.locator("tr", { hasText: STAFF });
  await row.locator('button:has-text("Deaktivieren")').click();
  await adminPage.waitForTimeout(1000);
  check(
    "Konto lässt sich wieder deaktivieren",
    (await adminPage.textContent("body")).includes("deaktiviert"),
  );
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden`);
process.exit(failed.length === 0 ? 0 : 1);
