import { describe, expect, it, vi } from "vitest";
import { PAGE_SIZES, sizeParamFor } from "../pagination.shared";

// readPaging greift auf `cookies()` zu; hier wird der Cookie-Speicher gestellt.
let cookieWert: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "seitengroesse" && cookieWert !== undefined
        ? { value: cookieWert }
        : undefined,
  }),
}));

const { readPaging } = await import("../pagination");

describe("sizeParamFor", () => {
  it("nennt den Parameter der Hauptliste „proSeite“", () => {
    expect(sizeParamFor("seite")).toBe("proSeite");
  });

  it("gibt jeder weiteren Tabelle einen eigenen Parameter", () => {
    // Sonst stellte die Kundenakte mit einer Auswahl alle drei Tabellen um.
    expect(sizeParamFor("kaeufe")).toBe("kaeufeProSeite");
    expect(sizeParamFor("mails")).toBe("mailsProSeite");
    expect(sizeParamFor("kaeufe")).not.toBe(sizeParamFor("mails"));
  });
});

describe("readPaging", () => {
  it("nimmt die Vorgabe, wenn nichts gewählt wurde", async () => {
    cookieWert = undefined;
    const p = await readPaging({}, { fallbackSize: 50 });
    expect(p.pageSize).toBe(50);
    expect(p.page).toBe(1);
    expect(p.skip).toBe(0);
    expect(p.take).toBe(50);
  });

  it("nimmt die Größe aus der Adresse", async () => {
    cookieWert = undefined;
    const p = await readPaging({ proSeite: "100" }, { fallbackSize: 50 });
    expect(p.pageSize).toBe(100);
  });

  it("nimmt die gemerkte Wahl, wenn die Adresse nichts sagt", async () => {
    cookieWert = "200";
    const p = await readPaging({}, { fallbackSize: 50 });
    expect(p.pageSize).toBe(200);
  });

  it("lässt die Adresse über die gemerkte Wahl stechen", async () => {
    cookieWert = "200";
    const p = await readPaging({ proSeite: "10" }, { fallbackSize: 50 });
    expect(p.pageSize).toBe(10);
  });

  it("weist Größen ab, die nicht zur Auswahl stehen", async () => {
    // Sonst holte `?proSeite=999999` den gesamten Bestand auf einmal.
    cookieWert = undefined;
    for (const unsinn of ["999999", "0", "-10", "abc", "12.5"]) {
      const p = await readPaging({ proSeite: unsinn }, { fallbackSize: 25 });
      expect(p.pageSize).toBe(25);
    }
  });

  it("weist auch einen manipulierten Cookie ab", async () => {
    cookieWert = "999999";
    const p = await readPaging({}, { fallbackSize: 25 });
    expect(p.pageSize).toBe(25);
  });

  it("rechnet skip aus Seite und Größe", async () => {
    cookieWert = undefined;
    const p = await readPaging(
      { seite: "3", proSeite: "100" },
      { fallbackSize: 25 },
    );
    expect(p.skip).toBe(200);
    expect(p.take).toBe(100);
  });

  it("liest die Größe der richtigen Tabelle", async () => {
    cookieWert = undefined;
    const params = { kaeufeProSeite: "100", mailsProSeite: "10" };
    const kaeufe = await readPaging(params, {
      pageParam: "kaeufe",
      fallbackSize: 25,
    });
    const mails = await readPaging(params, {
      pageParam: "mails",
      fallbackSize: 25,
    });
    expect(kaeufe.pageSize).toBe(100);
    expect(mails.pageSize).toBe(10);
  });

  it("verkraftet unsinnige Seitenzahlen", async () => {
    cookieWert = undefined;
    for (const unsinn of ["0", "-5", "abc"]) {
      const p = await readPaging({ seite: unsinn }, { fallbackSize: 25 });
      expect(p.page).toBe(1);
      expect(p.skip).toBe(0);
    }
  });

  it("bietet nur aufsteigende, sinnvolle Größen an", () => {
    expect([...PAGE_SIZES]).toEqual([...PAGE_SIZES].sort((a, b) => a - b));
    expect(PAGE_SIZES[0]).toBeGreaterThan(0);
    expect(PAGE_SIZES[PAGE_SIZES.length - 1]).toBeLessThanOrEqual(200);
  });
});
