/**
 * Zeigt, wie eine Vorlage beim Versand tatsaechlich aussieht.
 *
 *   npm run vorlage:vorschau -- vorlagen/coocazoo-colour-up.html [ziel.html]
 *
 * Die Datei laeuft durch dieselbe Strecke wie eine echte Mail: Platzhalter
 * fuellen, sanitisieren, Abmeldelink pruefen. Was hier herauskommt, ist genau
 * das, was der Empfaenger bekommt — inklusive allem, was die Sanitisierung
 * entfernt hat.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { renderEmail } from "../src/lib/template.js";

const [quelle, ziel] = process.argv.slice(2);
if (!quelle) {
  console.error("Bitte eine Vorlagendatei angeben.");
  process.exit(1);
}

const BEISPIELTEXT = [
  "am Samstag, den 12. Oktober, ist der Graffiti-Künstler von MOLOTOW bei uns",
  "im Laden. Er sprüht den Namen Ihres Kindes auf einen Rucksack-Anhänger und",
  "gestaltet dazu einen Patch — beides kostenlos und zum Mitnehmen.",
  "",
  "Die Plätze sind auf 30 Minuten je Kind getaktet und schnell vergeben.",
  "Ihr letzter Einkauf bei uns: {{produkt}}.",
].join("\n");

const { html, text } = renderEmail({
  body: BEISPIELTEXT,
  templateBody: readFileSync(quelle, "utf8"),
  templateIsHtml: true,
  vars: {
    anrede: "Hallo Familie Beispiel",
    vorname: "Anna",
    nachname: "Beispiel",
    stadt: "Aachen",
    plz: "52062",
    produkt: "Ergobag Cubo",
    kaufdatum: "14.08.2024",
  },
  unsubscribeUrl: "https://schulranzen.gollenstede.app/abmelden/beispiel",
});

if (ziel) {
  writeFileSync(ziel, html, "utf8");
  console.log(`Vorschau geschrieben: ${ziel}`);
} else {
  console.log(html);
}

console.log(`\n--- Textfassung (${text.length} Zeichen) ---\n`);
console.log(text.slice(0, 600));
