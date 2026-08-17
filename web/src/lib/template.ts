import sanitizeHtml from "sanitize-html";

/**
 * Platzhalter, die in Betreff und Text einer Kampagne ersetzt werden.
 * Der Editor zeigt genau diese Liste an, damit niemand raten muss.
 */
export const PLACEHOLDERS = [
  { key: "vorname", label: "Vorname des Kunden" },
  { key: "nachname", label: "Nachname des Kunden" },
  { key: "anrede", label: 'Anrede, z. B. "Hallo Anna Beispiel"' },
  { key: "stadt", label: "Wohnort" },
  { key: "plz", label: "Postleitzahl" },
  { key: "produkt", label: "Zuletzt gekauftes Produkt" },
  { key: "kaufdatum", label: "Datum des letzten Kaufs" },
  { key: "abmeldelink", label: "Persoenlicher Abmeldelink (Pflicht)" },
  { key: "content", label: "Nur in Vorlagen: Platz fuer den Kampagnentext" },
] as const;

export type PlaceholderKey = (typeof PLACEHOLDERS)[number]["key"];
export type TemplateVars = Partial<Record<PlaceholderKey, string>>;

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Ersetzt Platzhalter. `escape` steuert, ob die eingesetzten Werte HTML-sicher
 * gemacht werden — beim Betreff (reiner Text) ist das nicht noetig, im HTML-Body
 * schon.
 */
export function renderPlaceholders(
  input: string,
  vars: TemplateVars,
  options: { escape: boolean } = { escape: true },
): string {
  return input.replace(PLACEHOLDER_PATTERN, (match, rawKey: string) => {
    const key = rawKey.toLowerCase() as PlaceholderKey;
    const value = vars[key];
    if (value === undefined) return match;
    return options.escape ? escapeHtml(value) : value;
  });
}

/** Unbekannte Platzhalter — Grundlage der Warnung im Editor. */
export function unknownPlaceholders(input: string): string[] {
  const known = new Set<string>(PLACEHOLDERS.map((p) => p.key));
  const found = new Set<string>();
  for (const match of input.matchAll(PLACEHOLDER_PATTERN)) {
    const key = match[1].toLowerCase();
    if (!known.has(key)) found.add(match[1]);
  }
  return [...found];
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img",
    "style",
    "center",
    "font",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
    "h1",
    "h2",
    "body",
    "html",
    "head",
    "title",
    "meta",
  ],
  allowedAttributes: {
    "*": ["style", "class", "align", "width", "height", "bgcolor", "dir", "lang"],
    a: ["href", "name", "target", "rel", "style", "class"],
    img: ["src", "alt", "width", "height", "style", "class"],
    table: ["border", "cellpadding", "cellspacing", "role", "style", "class", "width"],
    td: ["colspan", "rowspan", "align", "valign", "style", "class", "width"],
    th: ["colspan", "rowspan", "align", "valign", "style", "class", "width"],
    meta: ["charset", "name", "content"],
  },
  // data: nur fuer Bilder, damit eingebettete Logos funktionieren.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "data", "cid"] },
  allowVulnerableTags: true,
  // Bewusst ohne `allowedStyles`: Mail-Layouts leben von beliebigem Inline-CSS,
  // und die Option kennt keine Wildcard fuer Eigenschaftsnamen — gesetzt wuerde
  // sie jedes Inline-Style entfernen und damit jede Vorlage zerstoeren.
  // Die gefaehrlichen CSS-Konstrukte werden stattdessen unten gezielt entfernt.
};

// url(javascript:…), expression(…) und Verwandte — die einzigen CSS-Konstrukte,
// ueber die sich in alten Clients Code ausfuehren liesse.
const DANGEROUS_CSS = /(?:javascript|vbscript|expression|behaviou?r|-moz-binding)\s*[:(]/gi;

/**
 * Entfernt Skripte, Event-Handler und javascript:-URLs aus dem Mail-HTML.
 * Inline-CSS bleibt erhalten, wird aber von ausfuehrbaren Konstrukten befreit.
 */
export function sanitizeEmailHtml(html: string): string {
  const cleaned = sanitizeHtml(html, SANITIZE_OPTIONS);
  // Nur ersetzen, nie testen: `DANGEROUS_CSS` traegt das g-Flag, und `.test()`
  // wuerde ueber `lastIndex` bei jedem zweiten Aufruf danebenliegen.
  return cleaned.replace(/style="([^"]*)"/gi, (match, css: string) => {
    const safe = css.replace(DANGEROUS_CSS, "");
    return safe === css ? match : `style="${safe}"`;
  });
}

export function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\r\n|\r|\n/g, "<br>\n");
}

export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const FALLBACK_LAYOUT = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px">
<tr><td style="padding:32px;font-size:15px;line-height:1.6">{{content}}</td></tr>
</table></td></tr></table>
</body></html>`;

/**
 * Baut die fertige Mail: Kampagnentext in die Vorlage einsetzen, Platzhalter
 * ersetzen, Ergebnis sanitisieren und den Abmeldeblock sicherstellen.
 */
export function renderEmail(input: {
  body: string;
  templateBody?: string | null;
  templateIsHtml?: boolean;
  vars: TemplateVars;
  unsubscribeUrl?: string;
}): { html: string; text: string } {
  const vars: TemplateVars = {
    ...input.vars,
    abmeldelink: input.unsubscribeUrl ?? input.vars.abmeldelink ?? "",
  };

  // 1. Kampagnentext: Platzhalter fuellen, dann in HTML ueberfuehren.
  const bodyFilled = renderPlaceholders(input.body ?? "", vars, {
    escape: false,
  });
  const contentHtml = textToHtml(bodyFilled);

  // 2. Vorlage als Geruest; ohne Vorlage greift das schlichte Standardlayout.
  const layout =
    input.templateBody && input.templateBody.trim().length > 0
      ? input.templateIsHtml === false
        ? textToHtml(input.templateBody)
        : input.templateBody
      : FALLBACK_LAYOUT;

  const withContent = layout.includes("{{content}}")
    ? layout.replace(/\{\{\s*content\s*\}\}/gi, contentHtml)
    : `${layout}\n${contentHtml}`;

  // 3. Restliche Platzhalter im Geruest fuellen und das Ganze sanitisieren.
  const filled = renderPlaceholders(withContent, vars, { escape: true });
  let html = sanitizeEmailHtml(filled);

  // 4. Abmeldelink ist Pflicht — fehlt er in der Vorlage, wird er angehaengt.
  if (input.unsubscribeUrl && !html.includes(input.unsubscribeUrl)) {
    const footer = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #ddd;font-size:12px;color:#666;font-family:Arial,Helvetica,sans-serif">
Sie moechten keine weiteren E-Mails erhalten?
<a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#666">Hier abmelden</a>.
</div>`;
    html = html.includes("</body>")
      ? html.replace("</body>", `${footer}</body>`)
      : html + footer;
  }

  return { html, text: htmlToText(html) };
}

/** Anrede aus Vor-/Nachname; leer bleibende Teile werden ausgelassen. */
export function buildSalutation(firstName: string, lastName: string): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name.length > 0 ? `Hallo ${name}` : "Hallo";
}
