import { describe, expect, it } from "vitest";
import { transform } from "../transform";
import type { LegacyData } from "../read-legacy";

function legacy(overrides: Partial<LegacyData> = {}): LegacyData {
  return {
    products: [],
    kunden: [],
    providers: [],
    templates: [],
    ...overrides,
  };
}

const kunde = (
  id: number,
  fields: Partial<LegacyData["kunden"][number]> = {},
) => ({
  id: BigInt(id),
  vorname: "Anna",
  nachname: "Muster",
  adresse: "Hauptstr. 1",
  plz: "52062",
  stadt: "Aachen",
  kaufdatum: new Date("2024-08-14"),
  mail: `anna${id}@example.de`,
  tel: "0241 123456",
  productId: 1n,
  ...fields,
});

const PRODUCTS = [
  { id: 1n, productName: "Ergobag Cubo" },
  { id: 2n, productName: "ergobag   cubo" },
  { id: 3n, productName: "Satch Pack" },
];

describe("ETL — Produkte", () => {
  it("führt gleichwertige Schreibweisen zusammen", () => {
    const result = transform(legacy({ products: PRODUCTS }));
    expect(result.products).toHaveLength(2);
    expect(result.stats.mergedProducts).toBe(1);
  });

  it("lässt namenlose Produkte aus und meldet das", () => {
    const result = transform(
      legacy({ products: [{ id: 9n, productName: null }] }),
    );
    expect(result.products).toHaveLength(0);
    expect(result.issues.some((i) => i.legacyId === "product:9")).toBe(true);
  });
});

describe("ETL — Kunden", () => {
  it("führt Datensätze mit gleicher E-Mail zu einem Kunden mit zwei Käufen zusammen", () => {
    const result = transform(
      legacy({
        products: PRODUCTS,
        kunden: [
          kunde(10, { mail: "Anna.Muster@Example.DE", productId: 1n }),
          kunde(11, { mail: "anna.muster@example.de", productId: 3n }),
        ],
      }),
    );
    expect(result.customers).toHaveLength(1);
    expect(result.customers[0].purchases).toHaveLength(2);
  });

  it("erkennt denselben Kunden auch, wenn eine Zeile keine E-Mail hat", () => {
    const result = transform(
      legacy({
        products: PRODUCTS,
        kunden: [
          kunde(10, { mail: "anna@example.de" }),
          kunde(11, { mail: null, productId: 3n }),
        ],
      }),
    );
    expect(result.customers).toHaveLength(1);
    expect(result.customers[0].email).toBe("anna@example.de");
    expect(result.customers[0].purchases).toHaveLength(2);
  });

  it("trennt gleichnamige Personen an unterschiedlichen Adressen", () => {
    const result = transform(
      legacy({
        products: PRODUCTS,
        kunden: [
          kunde(10, { mail: null, adresse: "Hauptstr. 1" }),
          kunde(11, { mail: null, adresse: "Nebenstr. 9" }),
        ],
      }),
    );
    expect(result.customers).toHaveLength(2);
  });

  it("verwirft eine zweite abweichende Adresse nicht, sondern notiert sie", () => {
    const result = transform(
      legacy({
        products: PRODUCTS,
        kunden: [
          kunde(10, { mail: "erste@example.de" }),
          kunde(11, { mail: "zweite@example.de", tel: null }),
        ],
      }),
    );
    expect(result.customers).toHaveLength(1);
    expect(result.customers[0].email).toBe("erste@example.de");
    expect(result.customers[0].notes).toContain("zweite@example.de");
  });

  it("normalisiert PLZ, Telefon und E-Mail", () => {
    const result = transform(
      legacy({
        products: PRODUCTS,
        kunden: [
          kunde(10, {
            plz: "D-52074",
            tel: " 0241  55 66 77 ",
            mail: "  MAX@Example.DE ",
          }),
        ],
      }),
    );
    const customer = result.customers[0];
    expect(customer.zip).toBe("52074");
    expect(customer.phone).toBe("+49241556677");
    expect(customer.email).toBe("max@example.de");
  });

  it("schiebt ungültige Adressen in die Notiz statt sie zu löschen", () => {
    const result = transform(
      legacy({
        products: PRODUCTS,
        kunden: [kunde(10, { mail: "clara(at)example.de" })],
      }),
    );
    expect(result.customers[0].email).toBeNull();
    expect(result.customers[0].notes).toContain("clara(at)example.de");
    expect(result.stats.invalidEmails).toBe(1);
  });

  it("lässt Zeilen ohne Namen aus", () => {
    const result = transform(
      legacy({
        products: PRODUCTS,
        kunden: [kunde(10, { vorname: null, nachname: null })],
      }),
    );
    expect(result.customers).toHaveLength(0);
    expect(result.stats.droppedRows).toBe(1);
  });

  it("liefert bei gleicher Eingabe dasselbe Ergebnis", () => {
    const data = legacy({
      products: PRODUCTS,
      kunden: [kunde(12), kunde(10), kunde(11, { mail: null })],
    });
    const a = transform(data);
    const b = transform(data);
    expect(a.customers.map((c) => c.legacyId)).toEqual(
      b.customers.map((c) => c.legacyId),
    );
  });
});

describe("ETL — Provider und Vorlagen", () => {
  it("leitet die Verschlüsselung aus dem Port ab", () => {
    const result = transform(
      legacy({
        providers: [
          { id: 1n, providerName: "A", smtpHost: "a.de", smtpPort: "465" },
          { id: 2n, providerName: "B", smtpHost: "b.de", smtpPort: "587" },
        ],
      }),
    );
    expect(result.providers[0].security).toBe("SSL");
    expect(result.providers[1].security).toBe("STARTTLS");
  });

  it("schreibt den alten Platzhalter {Content} um", () => {
    const result = transform(
      legacy({
        templates: [
          {
            id: 1n,
            name: "A",
            subject: "S",
            body: "<p>oben</p>{Content}<p>unten</p>",
            html: true,
          },
        ],
      }),
    );
    expect(result.templates[0].body).toContain("{{content}}");
    expect(result.templates[0].body).not.toContain("{Content}");
  });
});

describe("ETL — Umstellung Produkt zu Kunde", () => {
  it("macht aus je einer Altzeile genau einen Kauf", () => {
    const result = transform(
      legacy({
        products: PRODUCTS,
        // Bewusst verschiedene Personen: gleicher Name an gleicher Adresse
        // gilt als dieselbe Person und wuerde zusammengefuehrt.
        kunden: [
          kunde(10, { mail: "a@example.de", productId: 1n }),
          kunde(11, {
            mail: "b@example.de",
            nachname: "Zweiter",
            adresse: "Nebenstr. 2",
            productId: 3n,
          }),
        ],
      }),
    );
    expect(result.customers).toHaveLength(2);
    expect(result.stats.purchases).toBe(2);
  });

  it("haengt beide Kaeufe an denselben Kunden, wenn es dieselbe Person ist", () => {
    const result = transform(
      legacy({
        products: PRODUCTS,
        kunden: [
          kunde(10, { mail: "anna@example.de", productId: 1n, kaufdatum: new Date("2023-08-14") }),
          kunde(11, { mail: "anna@example.de", productId: 3n, kaufdatum: new Date("2025-08-01") }),
        ],
      }),
    );
    expect(result.customers).toHaveLength(1);
    const [customer] = result.customers;
    expect(customer.purchases).toHaveLength(2);
    // Jeder Kauf behaelt die alte Zeilen-ID — daran haengt die Wiederholbarkeit.
    expect(customer.purchases.map((p) => p.legacyKundeId).sort()).toEqual([10n, 11n]);
    expect(customer.mergedLegacyIds.sort()).toEqual([10n, 11n]);
  });

  it("behaelt zwei Kaeufe desselben Produkts als zwei Kaeufe", () => {
    const result = transform(
      legacy({
        products: PRODUCTS,
        kunden: [
          kunde(10, { mail: "anna@example.de", productId: 1n, kaufdatum: new Date("2023-08-14") }),
          kunde(11, { mail: "anna@example.de", productId: 1n, kaufdatum: new Date("2024-08-14") }),
        ],
      }),
    );
    expect(result.customers).toHaveLength(1);
    expect(result.customers[0].purchases).toHaveLength(2);
  });

  it("uebernimmt das Kaufdatum je Kauf, nicht je Kunde", () => {
    const result = transform(
      legacy({
        products: PRODUCTS,
        kunden: [
          kunde(10, { mail: "anna@example.de", productId: 1n, kaufdatum: new Date("2023-08-14") }),
          kunde(11, { mail: "anna@example.de", productId: 3n, kaufdatum: new Date("2025-08-01") }),
        ],
      }),
    );
    const dates = result.customers[0].purchases
      .map((p) => p.purchasedAt?.toISOString().slice(0, 10))
      .sort();
    expect(dates).toEqual(["2023-08-14", "2025-08-01"]);
  });

  it("legt ohne Produkt und ohne Datum keinen Kauf an", () => {
    const result = transform(
      legacy({
        products: PRODUCTS,
        kunden: [kunde(10, { productId: null, kaufdatum: null })],
      }),
    );
    expect(result.customers).toHaveLength(1);
    expect(result.customers[0].purchases).toHaveLength(0);
  });

  it("zeigt die Umstellung im Mengengeruest", () => {
    const result = transform(
      legacy({
        products: PRODUCTS,
        kunden: [
          kunde(10, { mail: "anna@example.de", productId: 1n }),
          kunde(11, { mail: "anna@example.de", productId: 3n }),
          kunde(12, {
            mail: "bernd@example.de",
            vorname: "Bernd",
            nachname: "Schmitz",
            adresse: "Marktplatz 3",
            productId: 1n,
          }),
        ],
      }),
    );
    // Drei Altzeilen werden zu zwei Kunden mit zusammen drei Kaeufen.
    expect(result.stats.legacyKunden).toBe(3);
    expect(result.stats.customers).toBe(2);
    expect(result.stats.purchases).toBe(3);
    expect(result.stats.mergedCustomers).toBe(1);
  });
});
