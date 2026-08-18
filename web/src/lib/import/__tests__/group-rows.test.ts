import { describe, expect, it, vi } from "vitest";

// customers.ts zieht den Prisma-Client mit; groupRows selbst ist reine Logik.
vi.mock("../../db", () => ({ db: {} }));
vi.mock("../../customers", () => ({ findOrCreateProduct: vi.fn() }));

const { groupRows } = await import("../customers");

type Row = Parameters<typeof groupRows>[0][number];

function row(partial: Partial<Row>): Row {
  return {
    row: 2,
    salutation: "UNBEKANNT",
    firstName: "Lars",
    lastName: "Meurer",
    street: "Bergstraße 3",
    zip: "52064",
    city: "Aachen",
    email: null,
    phone: null,
    notes: null,
    product: null,
    category: null,
    modelYear: null,
    purchasedAt: null,
    season: null,
    matchesCustomerId: null,
    ...partial,
  };
}

describe("groupRows", () => {
  it("fasst dieselbe Mailadresse zusammen", () => {
    const groups = groupRows([
      row({ email: "lars@example.de" }),
      row({ email: "lars@example.de", street: "Anderswo 9" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it("fasst eine Zeile ohne Mailadresse über Name, PLZ und Straße dazu", () => {
    // Der haeufigste Fall in der Praxis: der zweite Kauf wurde ohne
    // Mailadresse erfasst. Daraus darf kein zweiter Kunde entstehen.
    const groups = groupRows([
      row({ email: "lars@example.de" }),
      row({ email: null }),
    ]);
    expect(groups).toHaveLength(1);
  });

  it("fasst auch in umgekehrter Reihenfolge zusammen", () => {
    const groups = groupRows([row({ email: null }), row({ email: "lars@example.de" })]);
    expect(groups).toHaveLength(1);
  });

  it("hält verschiedene Personen an derselben Anschrift auseinander", () => {
    const groups = groupRows([
      row({ firstName: "Lars" }),
      row({ firstName: "Petra" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("hält gleiche Namen an verschiedenen Anschriften auseinander", () => {
    const groups = groupRows([
      row({ zip: "52064" }),
      row({ zip: "52070", street: "Marktplatz 3" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("verbindet zwei Zeilen ohne Mail nicht über eine dritte mit Mail", () => {
    const groups = groupRows([
      row({ firstName: "Lars", email: "a@example.de" }),
      row({ firstName: "Petra", email: "b@example.de" }),
    ]);
    expect(groups).toHaveLength(2);
  });
});
