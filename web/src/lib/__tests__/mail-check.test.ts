import { describe, expect, it } from "vitest";
import { GMAIL_LIMIT, pruefeMailtauglichkeit } from "../mail-check";

const sauber = `<table role="presentation" width="600" style="background:#ffffff">
  <tr><td bgcolor="#D7232A" style="background:#D7232A;font-family:Arial">
    <img src="https://example.de/logo.png" alt="Logo" width="60" height="60">
    Text
  </td></tr>
</table>`;

const titel = (html: string) => pruefeMailtauglichkeit(html).map((b) => b.titel);

describe("Mailtauglichkeit", () => {
  it("findet an einer sauberen Vorlage nichts", () => {
    expect(pruefeMailtauglichkeit(sauber)).toEqual([]);
  });

  it("meldet eingebettete Bilder als Fehler", () => {
    const html = `<img src="data:image/png;base64,AAAA" alt="x" width="10">`;
    const befund = pruefeMailtauglichkeit(html).find((b) =>
      b.titel.includes("eingebettete"),
    );
    expect(befund?.schwere).toBe("fehler");
    expect(befund?.text).toMatch(/Gmail/);
  });

  it("meldet, wenn Gmail abschneiden würde", () => {
    const html = sauber + "<p>" + "x".repeat(GMAIL_LIMIT) + "</p>";
    const befund = pruefeMailtauglichkeit(html).find((b) =>
      b.titel.includes("schneidet"),
    );
    expect(befund?.schwere).toBe("fehler");
  });

  it("warnt schon vor der Grenze", () => {
    const html = sauber + "<p>" + "x".repeat(95_000) + "</p>";
    expect(titel(html)).toContain("Nahe an Gmails Grenze");
  });

  it("meldet Schrift, die nur am body steht", () => {
    // Gmail wirft <body> weg — die Mail käme in der Standardschrift an.
    const html = `<body style="font-family:Arial"><table><tr><td>x</td></tr></table></body>`;
    expect(titel(html)).toContain("Schrift steht nur am <body>");
  });

  it("meldet nichts, wenn die Schrift auch an der Tabelle steht", () => {
    const html = `<body style="font-family:Arial">${sauber}</body>`;
    expect(titel(html)).not.toContain("Schrift steht nur am <body>");
  });

  it("meldet eine Hintergrundfarbe, die nur am body steht", () => {
    const html = `<body style="background:#eee"><table><tr><td>x</td></tr></table></body>`;
    expect(titel(html)).toContain("Hintergrundfarbe steht nur am <body>");
  });

  it("meldet einen style-Block", () => {
    expect(titel(`<style>.a{color:red}</style>${sauber}`)).toContain(
      "Gestaltung in einem <style>-Block",
    );
  });

  it("meldet, was Mailprogramme nicht umsetzen", () => {
    expect(titel(`<div style="position:absolute">x</div>`)).toContain(
      "position: absolute/fixed",
    );
    expect(titel(`<div style="float:left">x</div>`)).toContain("float");
    expect(titel(`<td style="background-image:url(a.png)">x</td>`)).toContain(
      "background-image",
    );
    expect(titel(`<div style="margin-top:-8px">x</div>`)).toContain(
      "negative Abstände",
    );
  });

  it("meldet Bilder ohne Breite und ohne Alternativtext", () => {
    const html = `<img src="https://example.de/a.png">`;
    expect(titel(html)).toContain("1 Bild ohne width-Attribut");
    expect(titel(html)).toContain("1 Bild ohne Alternativtext");
  });

  it("meldet farbige Zellen ohne bgcolor", () => {
    const html = `<table><tr><td style="background:#00A08F">x</td></tr></table>`;
    expect(titel(html)).toContain("1 farbige Zelle ohne bgcolor");
  });

  it("zählt eine Zelle mit bgcolor nicht mit", () => {
    const html = `<table><tr><td bgcolor="#00A08F" style="background:#00A08F">x</td></tr></table>`;
    expect(titel(html)).not.toContain("1 farbige Zelle ohne bgcolor");
  });
});
