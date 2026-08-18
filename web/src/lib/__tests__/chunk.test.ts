import { describe, expect, it } from "vitest";
import { chunk } from "../chunk";

describe("chunk", () => {
  it("zerlegt in volle und eine angebrochene Portion", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("liefert bei leerer Eingabe keine Portion", () => {
    expect(chunk([], 10)).toEqual([]);
  });

  it("liefert eine Portion, wenn alles hineinpasst", () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });

  it("verliert bei 10.000 Zeilen keine Zeile", () => {
    const rows = Array.from({ length: 10_000 }, (_, i) => i);
    const parts = chunk(rows, 250);
    expect(parts).toHaveLength(40);
    expect(parts.flat()).toEqual(rows);
  });

  it("weist eine unbrauchbare Portionsgröße zurück", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});
