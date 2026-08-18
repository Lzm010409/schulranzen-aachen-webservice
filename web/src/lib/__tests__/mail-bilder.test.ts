import { describe, expect, it } from "vitest";
import { zaehleEingebetteteBilder, bildPfad } from "../mail-images";

/**
 * Das Erkennen und Ersetzen laesst sich ohne Datenbank pruefen; das Ablegen
 * selbst deckt die Strecke in mail-pipeline.test.ts ab.
 */
describe("Bildablage", () => {
  it("erkennt eingebettete Bilder in beiden Anführungsarten", () => {
    const html = `<img src="data:image/png;base64,AAA"><img src='data:image/jpeg;base64,BBB'>`;
    expect(zaehleEingebetteteBilder(html)).toBe(2);
  });

  it("hält verlinkte Bilder für unauffällig", () => {
    expect(
      zaehleEingebetteteBilder('<img src="https://example.de/a.png">'),
    ).toBe(0);
  });

  it("übersieht kein Bild mit weiteren Attributen davor", () => {
    const html = `<img width="600" alt="x" src="data:image/gif;base64,CCC" />`;
    expect(zaehleEingebetteteBilder(html)).toBe(1);
  });

  it("hängt die passende Endung an den Pfad", () => {
    expect(bildPfad("abc", "image/jpeg")).toBe("/bilder/abc.jpg");
    expect(bildPfad("abc", "image/png")).toBe("/bilder/abc.png");
  });
});
