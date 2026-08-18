import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderEmail } from "../template";
import { pruefeMailtauglichkeit } from "../mail-check";
import {
  MAX_BODY_LENGTH,
  describeBodyLength,
  templateSchema,
} from "../validation";

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
  ["Neutral", "standard-neutral.html"],
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

  it("trägt das Logo des Fachcenters", () => {
    const { html } = render(undefined, vorlage);
    // Absolute Adresse: relative Pfade laufen in einem Mailprogramm ins Leere.
    expect(html).toMatch(
      /<img[^>]+src="https:\/\/static\.wixstatic\.com\/media\/612e69_353af34ead3846579c00b4c1cd48363e~mv2\.png"/,
    );
  });

  it("lässt keinen Platzhalter und keinen Kommentar stehen", () => {
    const { html } = render(undefined, vorlage);
    expect(html).not.toMatch(/\{\{\s*[a-z]+\s*\}\}/i);
    expect(html).not.toContain("<!--");
  });
});

/**
 * „Neutral“ ist die Vorlage fuer alles, was kein Verkauf ist. Was sie nicht
 * enthaelt, ist hier genauso wichtig wie das, was sie enthaelt — deshalb steht
 * es als Pruefung da und nicht nur als Kommentar.
 */
describe("Standardvorlage „Neutral“", () => {
  const vorlage = layout("standard-neutral.html");

  it("wirbt nicht", () => {
    const { html } = render("Ihre Reparatur ist abholbereit.", vorlage);
    // Auf ganze Wörter prüfen, nicht auf Zeichenketten: „transparent“ enthält
    // „sparen“, und die Datenschutz-URL enthält ein Prozentzeichen.
    for (const werbung of [
      "rabatt",
      "angebot",
      "angebote",
      "aktion",
      "günstig",
      "sparen",
      "sonderpreis",
      "kaufen",
    ]) {
      expect(html.toLowerCase()).not.toMatch(
        new RegExp(`(^|[^a-zäöüß])${werbung}([^a-zäöüß]|$)`),
      );
    }
    // Ein nacktes Prozentzeichen taugt nicht als Merkmal: `width="55%"` gehört
    // zum Tabellenlayout, `%C3%A4` zur Datenschutz-URL. Gesucht ist der
    // Preisnachlass.
    expect(html).not.toMatch(/%\s*(rabatt|reduziert|nachlass)/i);
  });

  it("verspricht nichts über die eigene Leistung", () => {
    const { html } = render(undefined, vorlage);
    // Die Werbeaussagen der Website gehören hier nicht hinein.
    for (const aussage of [
      "Ausführliche Beratung",
      "Lange Garantie",
      "Top-Hersteller",
      "beste",
    ]) {
      expect(html).not.toContain(aussage);
    }
  });

  it("drängt zu nichts — kein Aktionsknopf", () => {
    const { html } = render(undefined, vorlage);
    // Telefonnummer und Adresse ja, aber als Angabe, nicht als Knopf.
    expect(html).not.toMatch(/Jetzt anrufen/i);
    expect(html).not.toMatch(/ansehen<\/a>/i);
    expect(html).not.toMatch(/padding:1[0-9]px 3[0-9]px/);
  });

  it("nennt trotzdem alles, was hineingehört", () => {
    const { html } = render(undefined, vorlage);
    expect(html).toContain("Trierer Straße 785");
    expect(html).toContain("0241 99030773");
    expect(html).toContain("fcbrand@web.de");
    expect(html).toContain("10:00 – 18:00 Uhr");
    expect(html).toContain("Impressum");
    expect(html).toContain("Datenschutzerklärung");
  });
});

/**
 * Eingebettete Bilder als data:-URI sind der Grund, warum die alte Grenze von
 * 200.000 Zeichen nicht reichte: Base64 macht rund ein Drittel Aufschlag, ein
 * einziges Logo sprengt sie damit.
 */
describe("Grenze für die Größe einer Vorlage", () => {
  it("lässt eine Vorlage mit eingebettetem Bild durch", () => {
    // Rund 300 KB Bild — als Base64 gut 400.000 Zeichen, doppelt so viel wie
    // die alte Grenze zuließ.
    const bild = "A".repeat(400_000);
    const vorlage = `<html><body><img src="data:image/png;base64,${bild}" alt="Logo">{{content}}</body></html>`;
    expect(templateSchema.safeParse({
      name: "Mit Bild",
      subject: "Betreff",
      body: vorlage,
      isHtml: "on",
      category: "",
    }).success).toBe(true);
  });

  it("weist etwas zurück, das jedes Maß sprengt", () => {
    const ergebnis = templateSchema.safeParse({
      name: "Zu groß",
      subject: "Betreff",
      body: "A".repeat(MAX_BODY_LENGTH + 1),
      isHtml: "on",
      category: "",
    });
    expect(ergebnis.success).toBe(false);
    if (!ergebnis.success) {
      // Die Meldung muss sagen, was zu tun ist — „Too big" half niemandem.
      const text = ergebnis.error.issues.map((i) => i.message).join(" ");
      expect(text).toMatch(/zu lang/i);
      expect(text).toMatch(/public\/bilder/);
    }
  });

  it("behält eingebettete Bilder durch die Sanitisierung", () => {
    const punkt =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const { html } = render(
      "Text",
      `<html><body><img src="${punkt}" alt="Punkt">{{content}}</body></html>`,
    );
    expect(html).toContain(punkt);
  });

  it("zählt lesbar", () => {
    expect(describeBodyLength(1234)).toBe("1.234 von 5.000.000 Zeichen");
  });
});

/**
 * Jede mitgelieferte Vorlage muss die Mailtauglichkeitspruefung bestehen.
 * Sonst faellt eine Verschlechterung erst auf, wenn ein Kunde die Mail vor
 * sich hat.
 */
describe.each([
  ["coocazoo Colour Up", "coocazoo-colour-up.html"],
  ["Neutral", "standard-neutral.html"],
  ["Klassik", "standard-klassik.html"],
  ["Aktion", "standard-aktion.html"],
  ["Brief", "standard-brief.html"],
])("Mailtauglichkeit der Vorlage „%s“", (_name, datei) => {
  const vorlage = layout(datei);

  it("hat keinen Befund", () => {
    const befunde = pruefeMailtauglichkeit(vorlage);
    expect(
      befunde.map((b) => `${b.schwere}: ${b.titel}`),
      "Befunde der Mailtauglichkeitsprüfung",
    ).toEqual([]);
  });

  it("bleibt weit unter Gmails Grenze", () => {
    // Auch mit Kampagnentext und Platzhaltern muss Luft bleiben.
    const { html } = render("Ein Absatz Text.", vorlage);
    expect(Buffer.byteLength(html, "utf8")).toBeLessThan(60_000);
  });

  it("trägt die Schrift auch außerhalb von <body>", () => {
    // Gmail entfernt <body>; ohne diese Angabe käme die Mail in der
    // Standardschrift des Programms an.
    const ohneBody = vorlage.replace(/<body[^>]*>/i, "<body>");
    expect(ohneBody).toMatch(/font-family/);
  });
});
