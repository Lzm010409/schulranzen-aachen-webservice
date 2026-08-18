import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderEmail } from "../template";

/**
 * Die mitgelieferte Vorlage muss durch dieselbe Strecke gehen wie jede andere:
 * Platzhalter fuellen, sanitisieren, Abmeldelink erzwingen. Eine Vorlage, die
 * die Sanitisierung nicht ueberlebt, faellt sonst erst beim Versand auf.
 */
const LAYOUT = readFileSync(
  join(process.cwd(), "vorlagen", "coocazoo-colour-up.html"),
  "utf8",
);

function layout(datei: string) {
  return readFileSync(join(process.cwd(), "vorlagen", datei), "utf8");
}

function render(body = "Wir freuen uns auf Sie!", vorlage = LAYOUT) {
  return renderEmail({
    body,
    templateBody: vorlage,
    templateIsHtml: true,
    vars: {
      anrede: "Hallo Anna Beispiel",
      vorname: "Anna",
      produkt: "Ergobag Cubo",
    },
    unsubscribeUrl: "https://schulranzen.example/abmelden/abc123",
  });
}

describe("Vorlage „coocazoo Colour Up“", () => {
  it("setzt den Kampagnentext an der Stelle {{content}} ein", () => {
    const { html } = render("Am 12. Oktober ist es so weit.");
    expect(html).toContain("Am 12. Oktober ist es so weit.");
    expect(html).not.toContain("{{content}}");
  });

  it("fuellt die Anrede", () => {
    const { html } = render();
    expect(html).toContain("Hallo Anna Beispiel");
    expect(html).not.toContain("{{anrede}}");
  });

  it("traegt den Abmeldelink selbst und bekommt keinen zweiten angehaengt", () => {
    const { html } = render();
    const treffer = html.split("https://schulranzen.example/abmelden/abc123").length - 1;
    expect(treffer).toBe(1);
    expect(html).not.toContain("Sie moechten keine weiteren E-Mails erhalten?");
  });

  it("behaelt Layout und Farben nach der Sanitisierung", () => {
    const { html } = render();
    // Tabellenlayout, Hintergrundfarben und Inline-Styles muessen stehen
    // bleiben — daran haengt das gesamte Erscheinungsbild.
    expect(html).toContain("<table");
    expect(html).toContain("#00A08F");
    expect(html).toContain("#E4002B");
    expect(html).toContain('bgcolor="#111111"');
    expect(html).toMatch(/style="[^"]*background:#00A08F/);
  });

  it("behaelt Bild und Aktionsknopf", () => {
    const { html } = render();
    expect(html).toContain("coocazoo-colour-up.jpg");
    expect(html).toContain("Jetzt Termin sichern");
    expect(html).toMatch(/alt="[^"]*Rucksack/);
  });

  it("entfernt die Hinweise aus den Kommentaren", () => {
    const { html } = render();
    expect(html).not.toContain("<!--");
    expect(html).not.toContain("Kampagnentext wird an der Stelle");
  });

  it("liefert eine brauchbare Textfassung", () => {
    const { text } = render("Am 12. Oktober ist es so weit.");
    expect(text).toContain("Am 12. Oktober ist es so weit.");
    expect(text).toContain("Kostenloses Graffiti");
    expect(text).not.toContain("<");
  });

  it("laesst keinen unbekannten Platzhalter stehen", () => {
    const { html } = render();
    expect(html).not.toMatch(/\{\{\s*[a-z]+\s*\}\}/i);
  });
});

/**
 * Die drei Standardentwuerfe gehen durch dieselbe Strecke. Geprueft wird, was
 * bei allen dreien gleich sein muss — der Rest ist Gestaltung.
 */
describe.each([
  ["Klassik", "standard-klassik.html"],
  ["Aktion", "standard-aktion.html"],
  ["Brief", "standard-brief.html"],
])("Standardvorlage „%s“", (_name, datei) => {
  const vorlage = layout(datei);

  it("nimmt den Kampagnentext auf", () => {
    const { html } = render("Am 12. Oktober ist es so weit.", vorlage);
    expect(html).toContain("Am 12. Oktober ist es so weit.");
    expect(html).not.toContain("{{content}}");
  });

  it("füllt die Anrede", () => {
    const { html } = render(undefined, vorlage);
    expect(html).toContain("Hallo Anna Beispiel");
  });

  it("trägt den Abmeldelink genau einmal", () => {
    const { html } = render(undefined, vorlage);
    const treffer =
      html.split("https://schulranzen.example/abmelden/abc123").length - 1;
    expect(treffer).toBe(1);
  });

  it("behält die Markenfarbe und das Tabellenlayout", () => {
    const { html } = render(undefined, vorlage);
    expect(html).toContain("#D7232A");
    expect(html).toContain("<table");
  });

  it("nennt die richtige Anschrift und Telefonnummer", () => {
    const { html } = render(undefined, vorlage);
    expect(html).toContain("Trierer Straße 785");
    expect(html).toContain("52078 Aachen");
    expect(html).toContain("0241 99030773");
  });

  it("lässt keinen Platzhalter und keinen Kommentar stehen", () => {
    const { html } = render(undefined, vorlage);
    expect(html).not.toMatch(/\{\{\s*[a-z]+\s*\}\}/i);
    expect(html).not.toContain("<!--");
  });
});
