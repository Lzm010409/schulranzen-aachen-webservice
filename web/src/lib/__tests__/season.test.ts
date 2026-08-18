import { describe, expect, it } from "vitest";
import { parseSeason, seasonLabel, seasonOf } from "../season";

const am = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("seasonOf", () => {
  it("ordnet einen Kauf im Sommer der Einschulung desselben Jahres zu", () => {
    // Mitte August gekauft — das Kind wird in wenigen Tagen eingeschult.
    expect(seasonOf(am("2024-08-14"))).toBe(2024);
  });

  it("ordnet einen Kauf im Frühjahr derselben Einschulung zu", () => {
    expect(seasonOf(am("2024-03-02"))).toBe(2024);
  });

  it("ordnet einen Kauf im Herbst der nächsten Einschulung zu", () => {
    // Im Oktober kauft niemand mehr für die Einschulung, die schon war.
    expect(seasonOf(am("2024-10-05"))).toBe(2025);
  });

  it("nimmt den 1. September als erste Zeile der neuen Saison", () => {
    expect(seasonOf(am("2024-08-31"))).toBe(2024);
    expect(seasonOf(am("2024-09-01"))).toBe(2025);
  });

  it("liefert nichts ohne Kaufdatum", () => {
    expect(seasonOf(null)).toBeNull();
    expect(seasonOf(undefined)).toBeNull();
  });

  it("weist unsinnige Jahre ab", () => {
    expect(seasonOf(am("1901-05-05"))).toBeNull();
  });
});

describe("parseSeason", () => {
  it("liest eine Jahreszahl", () => {
    expect(parseSeason("2025")).toBe(2025);
  });

  it("liest die Schuljahrsschreibweise", () => {
    expect(parseSeason("2025/26")).toBe(2025);
    expect(parseSeason("2025/2026")).toBe(2025);
  });

  it("versteht leere Eingaben als „nicht gesetzt“", () => {
    expect(parseSeason("")).toBeNull();
    expect(parseSeason("   ")).toBeNull();
    expect(parseSeason(null)).toBeNull();
  });

  it("weist Unsinn ab, statt eine Zahl zu erfinden", () => {
    expect(parseSeason("demnächst")).toBeNull();
    expect(parseSeason("25")).toBeNull();
    // „12025“ ergibt über die ersten vier Ziffern 1202 — weit vor jeder
    // denkbaren Saison und damit kein Wert, den man raten sollte.
    expect(parseSeason("12025")).toBeNull();
  });
});

describe("seasonLabel", () => {
  it("schreibt das Schuljahr aus", () => {
    expect(seasonLabel(2025)).toBe("2025/26");
    expect(seasonLabel(2099)).toBe("2099/00");
  });

  it("zeigt einen Strich, wenn nichts bekannt ist", () => {
    expect(seasonLabel(null)).toBe("—");
  });
});
