import { describe, expect, it } from "vitest";

/**
 * Legt das Auslagern gegen eine echte Datenbank fest: dieselbe Datei darf nur
 * einmal liegen, und aus dem Vorlagentext muss der data:-Block verschwinden.
 *
 * Laeuft nur mit gesetzter DATABASE_URL; ohne Datenbank wird uebersprungen.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
process.env.SESSION_SECRET ??= "test-session-secret-mit-mindestens-32-zeichen";
process.env.ENCRYPTION_KEY ??= "ZGV2LW9ubHkta2V5LTMyLWJ5dGVzLWxvbmctMDAwMDA=";
process.env.APP_URL ??= "http://127.0.0.1:3000";

// Kleinstes gueltiges GIF — reicht, es geht um die Bytes, nicht um das Bild.
const GIF =
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

describe.skipIf(!hasDatabase)("Bildablage", () => {
  it("nimmt eingebettete Bilder aus dem HTML und verlinkt sie", async () => {
    const { lagereBilderAus } = await import("../mail-images");
    const { db } = await import("../db");

    const html = `<html><body><img src="data:image/gif;base64,${GIF}" alt="Bild" /></body></html>`;
    const ergebnis = await lagereBilderAus(html);

    expect(ergebnis.ausgelagert).toBe(1);
    expect(ergebnis.html).not.toContain("data:image");
    expect(ergebnis.html).toMatch(/src="http[^"]*\/bilder\/[a-z0-9]+\.gif"/);
    expect(ergebnis.gespart).toBeGreaterThan(0);

    const id = ergebnis.html.match(/\/bilder\/([a-z0-9]+)\.gif/)?.[1];
    const bild = await db.mailImage.findUniqueOrThrow({ where: { id } });
    expect(bild.mimeType).toBe("image/gif");
    expect(bild.size).toBe(Buffer.from(GIF, "base64").byteLength);
  });

  it("legt dasselbe Bild kein zweites Mal ab", async () => {
    const { lagereBilderAus } = await import("../mail-images");

    const html = `<img src="data:image/gif;base64,${GIF}"><img src="data:image/gif;base64,${GIF}">`;
    const ergebnis = await lagereBilderAus(html);

    // Zwei Verweise, aber nur ein Datensatz — und beide zeigen dorthin.
    expect(ergebnis.ausgelagert).toBe(1);
    const treffer = [...ergebnis.html.matchAll(/\/bilder\/([a-z0-9]+)\.gif/g)];
    expect(treffer).toHaveLength(2);
    expect(treffer[0][1]).toBe(treffer[1][1]);
  });

  it("lässt ein unbekanntes Format stehen und meldet es", async () => {
    const { lagereBilderAus } = await import("../mail-images");

    const html = `<img src="data:image/svg+xml;base64,PHN2Zy8+">`;
    const ergebnis = await lagereBilderAus(html);

    expect(ergebnis.ausgelagert).toBe(0);
    expect(ergebnis.html).toContain("data:image/svg+xml");
    expect(ergebnis.probleme[0]).toMatch(/nicht unterstützt/);
  });

  it("lässt HTML ohne eingebettete Bilder unverändert", async () => {
    const { lagereBilderAus } = await import("../mail-images");
    const html = `<img src="https://example.de/a.png" width="600" alt="a">`;
    const ergebnis = await lagereBilderAus(html);
    expect(ergebnis.html).toBe(html);
    expect(ergebnis.ausgelagert).toBe(0);
  });
});
