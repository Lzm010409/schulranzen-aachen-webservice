import { describe, expect, it } from "vitest";
import {
  customerIdentityKey,
  isValidEmail,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeZip,
  productSlug,
} from "../normalize";
import {
  buildSalutation,
  escapeHtml,
  renderEmail,
  renderPlaceholders,
  sanitizeEmailHtml,
  textToHtml,
  unknownPlaceholders,
} from "../template";
import { csvCell, csvRow, guardCsvValue } from "../export";

describe("Normalisierung", () => {
  it("trimmt und verdichtet Leerzeichen in Namen", () => {
    expect(normalizeName("  Anna   Maria ")).toBe("Anna Maria");
  });

  it("macht E-Mail-Adressen klein und liefert null bei leer", () => {
    expect(normalizeEmail("  Anna@Example.DE ")).toBe("anna@example.de");
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });

  it("erkennt gueltige und ungueltige Adressen", () => {
    expect(isValidEmail("anna@example.de")).toBe(true);
    expect(isValidEmail("anna@sub.example.co.uk")).toBe(true);
    expect(isValidEmail("anna@example")).toBe(false);
    expect(isValidEmail("anna example.de")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });

  it("bringt deutsche Telefonnummern auf E.164", () => {
    expect(normalizePhone("0241 123456")).toBe("+49241123456");
    expect(normalizePhone("(0241) 12-34-56")).toBe("+49241123456");
    expect(normalizePhone("+49 241 123456")).toBe("+49241123456");
    expect(normalizePhone("0049241123456")).toBe("+49241123456");
    expect(normalizePhone("")).toBeNull();
  });

  it("gibt unklare Nummern unveraendert zurueck, statt sie zu verwerfen", () => {
    expect(normalizePhone("Durchwahl 12")).toBe("Durchwahl 12");
  });

  it("reduziert PLZ auf fuenf Ziffern", () => {
    expect(normalizeZip("D-52062")).toBe("52062");
    expect(normalizeZip("52062 Aachen")).toBe("52062");
  });

  it("erzeugt fuer gleichwertige Produktnamen denselben Slug", () => {
    expect(productSlug("Ergobag Cubo")).toBe(productSlug("  ergobag   cubo "));
    expect(productSlug("Schulränzen Größe 1")).toBe("schulraenzen-groesse-1");
    expect(productSlug("Ranzen/XY")).toBe("ranzen-xy");
  });

  it("bildet einen stabilen Dublettenschluessel", () => {
    expect(
      customerIdentityKey({
        firstName: "Anna",
        lastName: "Müller",
        zip: "52062",
      }),
    ).toBe(
      customerIdentityKey({
        firstName: " anna ",
        lastName: "MÜLLER",
        zip: "D-52062",
      }),
    );
  });
});

describe("Platzhalter", () => {
  it("ersetzt bekannte Platzhalter und laesst unbekannte stehen", () => {
    const out = renderPlaceholders("{{vorname}} aus {{stadt}} und {{unbekannt}}", {
      vorname: "Anna",
      stadt: "Aachen",
    });
    expect(out).toBe("Anna aus Aachen und {{unbekannt}}");
  });

  it("ignoriert Gross-/Kleinschreibung und Leerzeichen", () => {
    expect(renderPlaceholders("{{ Vorname }}", { vorname: "Anna" })).toBe("Anna");
  });

  it("escaped eingesetzte Werte im HTML-Modus", () => {
    expect(
      renderPlaceholders("{{vorname}}", { vorname: '<script>x</script>' }),
    ).toBe("&lt;script&gt;x&lt;/script&gt;");
  });

  it("meldet unbekannte Platzhalter", () => {
    expect(unknownPlaceholders("{{vorname}} {{quatsch}} {{bloedsinn}}")).toEqual(
      ["quatsch", "bloedsinn"],
    );
  });

  it("baut eine Anrede", () => {
    // Ohne Angabe wird nicht geraten — neutrale Form mit Namen.
    expect(buildSalutation("Anna", "Beispiel")).toBe("Guten Tag Anna Beispiel");
    expect(buildSalutation("", "")).toBe("Guten Tag");
    expect(buildSalutation("Anna", "Müller", "FRAU")).toBe(
      "Sehr geehrte Frau Müller",
    );
    expect(buildSalutation("Bernd", "Schmitz", "HERR")).toBe(
      "Sehr geehrter Herr Schmitz",
    );
    // Ohne Nachnamen greift auch mit Geschlecht die neutrale Form: „Sehr
    // geehrte Frau" ohne Namen liest sich wie ein Fehler.
    expect(buildSalutation("Anna", "", "FRAU")).toBe("Guten Tag Anna");
  });
});

describe("HTML-Sicherheit", () => {
  it("escaped Sonderzeichen", () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;",
    );
  });

  it("wandelt Zeilenumbrueche in <br>", () => {
    expect(textToHtml("a\nb")).toBe("a<br>\nb");
  });

  it("entfernt Skripte und Event-Handler", () => {
    const dirty = '<p onclick="steal()">Hallo</p><script>alert(1)</script>';
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onclick");
    expect(clean).toContain("Hallo");
  });

  it("entfernt javascript:-Links", () => {
    const clean = sanitizeEmailHtml('<a href="javascript:alert(1)">x</a>');
    expect(clean).not.toContain("javascript:");
  });

  it("laesst Layout-Tabellen und Inline-Styles durch", () => {
    const clean = sanitizeEmailHtml(
      '<table><tr><td style="padding:8px">Zelle</td></tr></table>',
    );
    expect(clean).toContain("<table>");
    expect(clean).toContain("padding:8px");
  });

  it("entfernt ausfuehrbares CSS aus Inline-Styles", () => {
    const clean = sanitizeEmailHtml(
      '<td style="width:100%;background:expression(alert(1))">x</td>',
    );
    expect(clean).not.toContain("expression(");
    expect(clean).toContain("width:100%");
  });

  it("bleibt ueber mehrere Aufrufe hinweg stabil", () => {
    const dirty = '<p style="color:red;x:expression(1)">a</p>';
    const first = sanitizeEmailHtml(dirty);
    const second = sanitizeEmailHtml(dirty);
    expect(first).toBe(second);
    expect(first).not.toContain("expression(");
  });
});

describe("Mailaufbau", () => {
  it("setzt den Text in {{content}} der Vorlage ein", () => {
    const { html } = renderEmail({
      body: "Guten Tag",
      templateBody: "<div>oben{{content}}unten</div>",
      vars: {},
    });
    expect(html).toContain("oben");
    expect(html).toContain("Guten Tag");
    expect(html).toContain("unten");
  });

  it("haengt den Text an, wenn die Vorlage kein {{content}} hat", () => {
    const { html } = renderEmail({
      body: "Guten Tag",
      templateBody: "<div>nur Kopf</div>",
      vars: {},
    });
    expect(html).toContain("nur Kopf");
    expect(html).toContain("Guten Tag");
  });

  it("fuegt den Abmeldelink an, wenn die Vorlage ihn nicht enthaelt", () => {
    const { html } = renderEmail({
      body: "Text",
      templateBody: "<div>{{content}}</div>",
      vars: {},
      unsubscribeUrl: "https://example.de/abmelden/abc",
    });
    expect(html).toContain("https://example.de/abmelden/abc");
    expect(html).toContain("abmelden");
  });

  it("fuegt ihn nicht doppelt an, wenn die Vorlage ihn schon platziert", () => {
    const { html } = renderEmail({
      body: "Text",
      templateBody: '<div>{{content}}<a href="{{abmeldelink}}">weg</a></div>',
      vars: {},
      unsubscribeUrl: "https://example.de/abmelden/abc",
    });
    const matches = html.match(/example\.de\/abmelden\/abc/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("neutralisiert HTML aus dem Kampagnentext", () => {
    const { html } = renderEmail({
      body: "<script>alert(1)</script>",
      templateBody: "<div>{{content}}</div>",
      vars: {},
    });
    expect(html).not.toContain("<script>");
  });

  it("liefert eine Textfassung mit", () => {
    const { text } = renderEmail({
      body: "Guten Tag",
      templateBody: "<div>{{content}}</div>",
      vars: {},
    });
    expect(text).toContain("Guten Tag");
    expect(text).not.toContain("<div>");
  });
});

describe("CSV-Export", () => {
  it("entschaerft Formeln", () => {
    expect(guardCsvValue("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(guardCsvValue("+49241")).toBe("'+49241");
    expect(guardCsvValue("@user")).toBe("'@user");
    expect(guardCsvValue("Aachen")).toBe("Aachen");
  });

  it("maskiert Anfuehrungszeichen und Trennzeichen", () => {
    expect(csvCell('Meier; "Chef"')).toBe('"Meier; ""Chef"""');
  });

  it("nutzt Semikolon und CRLF", () => {
    expect(csvRow(["a", "b"])).toBe("a;b\r\n");
  });

  it("stellt leere Werte als leeres Feld dar", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});
