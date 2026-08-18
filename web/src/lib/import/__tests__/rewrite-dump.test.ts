import { describe, expect, it } from "vitest";
import { rewriteDumpSql } from "../legacy-import";

describe("Dump-Umschreibung", () => {
  it("lenkt Tabellenverweise auf das Schema legacy", () => {
    const sql = [
      "COPY public.kunde (id, vorname) FROM stdin;",
      "1\tAnna",
      "\\.",
      "",
      "ALTER TABLE public.product OWNER TO postgres;",
    ].join("\n");

    const out = rewriteDumpSql(sql);
    expect(out).toContain("COPY legacy.kunde");
    expect(out).toContain("ALTER TABLE legacy.product");
    expect(out).not.toContain("public.kunde");
  });

  it("lässt Nutzdaten unangetastet, auch wenn sie wie ein Tabellenverweis aussehen", () => {
    const sql = [
      "COPY public.kunde (id, adresse) FROM stdin;",
      "1\tpublic.kunde ist keine Tabelle sondern Text",
      "\\.",
    ].join("\n");

    const out = rewriteDumpSql(sql);
    expect(out).toContain("COPY legacy.kunde");
    expect(out).toContain("public.kunde ist keine Tabelle sondern Text");
  });

  it("rührt fremde Tabellen nicht an", () => {
    const sql = "COPY public.bestellung (id) FROM stdin;\n\\.";
    expect(rewriteDumpSql(sql)).toContain("public.bestellung");
  });
});
