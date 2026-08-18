import { describe, expect, it, vi } from "vitest";
import { PLACEHOLDERS, renderEmail } from "../template";

vi.mock("../db", () => ({ db: {} }));

const { varsFromCustomer } = await import("../mail-vars");

const kunde = (teil: Partial<Parameters<typeof varsFromCustomer>[0]> = {}) => ({
  salutation: "FRAU" as const,
  firstName: "Anna",
  lastName: "Müller",
  city: "Aachen",
  zip: "52062",
  purchases: [
    {
      purchasedAt: new Date("2021-08-14T00:00:00Z"),
      season: 2021,
      product: { name: "Ergobag Cubo", category: { name: "Schulranzen" } },
    },
  ],
  ...teil,
});

describe("Platzhalter aus einem Kunden", () => {
  it("füllt jeden Platzhalter mit den Daten dieses Kunden", () => {
    const vars = varsFromCustomer(kunde());
    expect(vars).toMatchObject({
      vorname: "Anna",
      nachname: "Müller",
      anrede: "Sehr geehrte Frau Müller",
      anrede_kurz: "Hallo Anna",
      stadt: "Aachen",
      plz: "52062",
      produkt: "Ergobag Cubo",
      warengruppe: "Schulranzen",
      kaufdatum: "14.8.2021",
      saison: "2021/22",
    });
  });

  it("richtet die Anrede nach der Angabe am Kunden", () => {
    expect(varsFromCustomer(kunde({ salutation: "HERR", lastName: "Schmitz" })).anrede)
      .toBe("Sehr geehrter Herr Schmitz");
    expect(varsFromCustomer(kunde({ salutation: "UNBEKANNT" })).anrede)
      .toBe("Guten Tag Anna Müller");
  });

  it("lässt leer, was der Kunde nicht hergibt — statt zu erfinden", () => {
    const vars = varsFromCustomer(kunde({ purchases: [] }));
    expect(vars.produkt).toBe("");
    expect(vars.warengruppe).toBe("");
    expect(vars.kaufdatum).toBe("");
    expect(vars.saison).toBe("");
  });

  it("deckt jeden angebotenen Platzhalter ab", () => {
    const vars = varsFromCustomer(kunde());
    for (const { key } of PLACEHOLDERS) {
      // Diese beiden kommen nicht vom Kunden, sondern vom Versand.
      if (key === "abmeldelink" || key === "content") continue;
      expect(vars, `Platzhalter {{${key}}} fehlt`).toHaveProperty(key);
    }
  });
});

describe("renderEmail und fehlende Werte", () => {
  it("lässt keinen Platzhalter wörtlich in der Mail stehen", () => {
    // Genau das passierte, wenn ein Kunde zwischen Einreihen und Versand
    // gelöscht wurde: der Empfänger las „{{vorname}}“.
    const { html } = renderEmail({
      body: "Hallo {{vorname}} aus {{stadt}}, zuletzt: {{produkt}} ({{saison}}).",
      templateBody: "<html><body>{{content}} — {{plz}}</body></html>",
      vars: { anrede: "Guten Tag" },
      unsubscribeUrl: "https://example.de/abmelden/x",
    });
    expect(html).not.toMatch(/\{\{\s*[a-z_]+\s*\}\}/i);
  });

  it("setzt die gelieferten Werte ein", () => {
    const { html } = renderEmail({
      body: "{{anrede}} — {{produkt}}",
      templateBody: "<html><body>{{content}}</body></html>",
      vars: { anrede: "Sehr geehrte Frau Müller", produkt: "Satch Pack" },
      unsubscribeUrl: "https://example.de/abmelden/x",
    });
    expect(html).toContain("Sehr geehrte Frau Müller");
    expect(html).toContain("Satch Pack");
  });
});
