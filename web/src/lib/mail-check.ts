/**
 * Prueft eine Vorlage auf das, woran Mailprogramme scheitern.
 *
 * Ein Browser zeigt HTML so an, wie es dasteht. Ein Mailprogramm nicht: Gmail
 * wirft `<html>`, `<head>` und `<body>` weg und behaelt nur den Inhalt,
 * schneidet lange Nachrichten ab und zeigt eingebettete Bilder gar nicht.
 * Outlook rendert mit Word und kennt weder `border-radius` noch `overflow`.
 *
 * Die Regeln hier stehen bewusst als Daten und nicht als Fliesstext in einer
 * Anleitung: so faellt ein Problem im Editor auf und nicht erst, wenn die Mail
 * beim Kunden falsch aussieht.
 */

export type MailBefund = {
  /** `fehler` bricht die Darstellung, `hinweis` verschlechtert sie. */
  schwere: "fehler" | "hinweis";
  titel: string;
  text: string;
};

/**
 * Ab hier schneidet Gmail ab und zeigt „Nachricht gekuerzt".
 * Der Wert gilt fuer die gesamte Nachricht, nicht nur den sichtbaren Teil.
 */
export const GMAIL_LIMIT = 102_000;

/** Ab hier wird es eng — Kopfzeilen und Kodierung kommen noch dazu. */
const GMAIL_WARNUNG = 90_000;

export function pruefeMailtauglichkeit(html: string): MailBefund[] {
  const befunde: MailBefund[] = [];
  const groesse = Buffer.byteLength(html, "utf8");

  // ------------------------------------------------------------- Groesse
  if (groesse > GMAIL_LIMIT) {
    befunde.push({
      schwere: "fehler",
      titel: "Gmail schneidet diese Mail ab",
      text: `Die Nachricht ist ${(groesse / 1024).toFixed(0)} KB groß. Gmail zeigt ab etwa 102 KB „Nachricht gekürzt“ — alles danach fehlt, samt Abmeldelink. Bilder verlinken statt einbetten spart am meisten.`,
    });
  } else if (groesse > GMAIL_WARNUNG) {
    befunde.push({
      schwere: "hinweis",
      titel: "Nahe an Gmails Grenze",
      text: `Die Nachricht ist ${(groesse / 1024).toFixed(0)} KB groß. Ab etwa 102 KB kürzt Gmail.`,
    });
  }

  // ---------------------------------------------------- Eingebettete Bilder
  const eingebettet = html.match(/src="data:image/gi)?.length ?? 0;
  if (eingebettet > 0) {
    befunde.push({
      schwere: "fehler",
      titel: `${eingebettet} eingebettete${eingebettet === 1 ? "s" : ""} Bild${eingebettet === 1 ? "" : "er"}`,
      text: "Gmail zeigt Bilder als data:-URI nicht an — an der Stelle bleibt die Mail leer. Das Bild unter public/bilder/ ablegen und verlinken.",
    });
  }

  // ------------------------------------------------------- Gestaltung im Kopf
  if (/<style[\s>]/i.test(html)) {
    befunde.push({
      schwere: "hinweis",
      titel: "Gestaltung in einem <style>-Block",
      text: "Nicht jedes Mailprogramm wertet <style> aus; Outlook und die Gmail-App verwerfen Teile davon. Sicher ist nur das style-Attribut direkt am Element.",
    });
  }

  // Gmail wirft <body> weg. Steht die Schrift nur dort, faellt die ganze Mail
  // auf die Standardschrift des Programms zurueck. Beanstandet wird deshalb
  // nur, wenn sie sonst nirgends steht.
  const body = html.match(/<body[^>]*style="([^"]*)"/i)?.[1] ?? "";
  const ohneBody = html.replace(/<body[^>]*>/i, "<body>");
  if (/font-family\s*:/i.test(body) && !/font-family\s*:/i.test(ohneBody)) {
    befunde.push({
      schwere: "fehler",
      titel: "Schrift steht nur am <body>",
      text: "Gmail entfernt <body> und übernimmt die Angaben nicht — die Mail erscheint dann in der Standardschrift des Programms. Die Schrift gehört zusätzlich an die äußere Tabelle und an die Zellen mit Text.",
    });
  }
  const bodyHintergrund = /background\s*:/i.test(body);
  if (bodyHintergrund && !/<table[^>]*bgcolor=/i.test(html)) {
    befunde.push({
      schwere: "hinweis",
      titel: "Hintergrundfarbe steht nur am <body>",
      text: "Gmail entfernt <body>; die Fläche um den Inhalt bleibt weiß. Die Farbe gehört zusätzlich als bgcolor an die äußere Tabelle.",
    });
  }

  // ------------------------------------------------------ Nicht unterstuetzt
  for (const [muster, titel, text] of [
    [
      /position\s*:\s*(absolute|fixed)/i,
      "position: absolute/fixed",
      "Kein Mailprogramm setzt das um; die Elemente rutschen an den Anfang.",
    ],
    [
      /float\s*:\s*(left|right)/i,
      "float",
      "Outlook ignoriert es. Nebeneinander stellt man in Mails mit Tabellenzellen.",
    ],
    [
      /background-image\s*:/i,
      "background-image",
      "Outlook zeigt es ohne Zusatzaufwand nicht. Besser eine Farbfläche oder ein echtes <img>.",
    ],
    [
      /margin\s*:\s*-|margin-(top|left|right|bottom)\s*:\s*-/i,
      "negative Abstände",
      "Outlook und die Gmail-App setzen sie nicht um; das Layout verschiebt sich.",
    ],
  ] as const) {
    if (muster.test(html)) {
      befunde.push({ schwere: "hinweis", titel, text });
    }
  }

  // ----------------------------------------------------------------- Bilder
  const bilder = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const ohneBreite = bilder.filter((tag) => !/\swidth\s*=/i.test(tag)).length;
  if (ohneBreite > 0) {
    befunde.push({
      schwere: "hinweis",
      titel: `${ohneBreite} Bild${ohneBreite === 1 ? "" : "er"} ohne width-Attribut`,
      text: "Outlook braucht die Breite als Attribut, nicht nur im style. Ohne sie erscheint das Bild in Originalgröße.",
    });
  }
  const ohneAlt = bilder.filter((tag) => !/\salt\s*=/i.test(tag)).length;
  if (ohneAlt > 0) {
    befunde.push({
      schwere: "hinweis",
      titel: `${ohneAlt} Bild${ohneAlt === 1 ? "" : "er"} ohne Alternativtext`,
      text: "Bilder sind anfangs blockiert. Ohne alt-Text steht dort nichts, und der Leser sieht eine Lücke.",
    });
  }

  // --------------------------------------------------------- Farbige Flaechen
  // Ohne bgcolor faellt die Flaeche in Outlook auf Weiss zurueck.
  const flaechen = [...html.matchAll(/<t[dh]\b[^>]*>/gi)].filter((m) =>
    /style="[^"]*background\s*:\s*#/i.test(m[0]),
  );
  const ohneBgcolor = flaechen.filter((m) => !/bgcolor=/i.test(m[0])).length;
  if (ohneBgcolor > 0) {
    befunde.push({
      schwere: "hinweis",
      titel: `${ohneBgcolor} farbige Zelle${ohneBgcolor === 1 ? "" : "n"} ohne bgcolor`,
      text: "Outlook wertet bei Tabellenzellen bgcolor zuverlässiger aus als background im style. Beides setzen.",
    });
  }

  return befunde;
}
