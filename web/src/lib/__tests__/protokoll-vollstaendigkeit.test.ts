import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Jede Aktion, die etwas ändert, muss im Änderungsprotokoll landen.
 *
 * Der Anlass: mehrere Aktionen hatten keinen Eintrag — Segmente anlegen,
 * Kampagnen pausieren, Absenderkonten löschen. Auffallen konnte das niemandem,
 * weil ein fehlender Eintrag sich nicht bemerkbar macht. Diese Prüfung liest
 * deshalb den Quelltext: wer eine neue Aktion schreibt, muss sich entweder um
 * das Protokoll kümmern oder hier ausdrücklich begründen, warum nicht.
 */

const WURZEL = join(process.cwd(), "src", "app");

/**
 * Aktionen ohne Protokolleintrag — jede mit Grund. Wer hier etwas ergänzt,
 * soll kurz innehalten: „ändert nichts" ist der einzige gute Grund.
 */
const OHNE_EINTRAG: Record<string, string> = {
  // Reine Vorschau, schreibt nichts.
  checkPlaceholdersAction: "prüft nur Platzhalter, ändert nichts",
  // Anmeldung und Abmeldung protokolliert lib/auth.ts selbst, mit IP.
  loginAction: "wird in lib/auth.ts protokolliert (LOGIN / LOGIN_FAILED)",
  logoutAction: "wird in lib/auth.ts protokolliert (LOGOUT)",
  // Meldet einen Fehler ins Anwendungsprotokoll; niemand hat etwas geändert.
  meldeSeitenfehlerAction: "schreibt ins Anwendungsprotokoll, ändert nichts",
};

function dateien(verzeichnis: string): string[] {
  const treffer: string[] = [];
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) treffer.push(...dateien(pfad));
    else if (eintrag.name.endsWith(".ts") || eintrag.name.endsWith(".tsx")) {
      treffer.push(pfad);
    }
  }
  return treffer;
}

/** Zerlegt eine Datei in ihre exportierten Aktionen samt Rumpf. */
function aktionen(quelle: string): { name: string; rumpf: string }[] {
  const treffer = [
    ...quelle.matchAll(/export async function (\w+Action)\s*\(/g),
  ];
  return treffer.map((match, i) => ({
    name: match[1],
    rumpf: quelle.slice(
      match.index ?? 0,
      i + 1 < treffer.length ? treffer[i + 1].index : quelle.length,
    ),
  }));
}

const serverDateien = dateien(WURZEL).filter((pfad) =>
  readFileSync(pfad, "utf8").startsWith('"use server"'),
);

describe("Änderungsprotokoll", () => {
  it("findet überhaupt Server-Aktionen", () => {
    // Sonst prüft der Rest stillschweigend nichts.
    expect(serverDateien.length).toBeGreaterThan(5);
  });

  it.each(serverDateien.map((p) => [p.replace(`${process.cwd()}/`, ""), p]))(
    "%s protokolliert jede Änderung",
    (_name, pfad) => {
      const quelle = readFileSync(pfad, "utf8");
      const ohne = aktionen(quelle)
        .filter((a) => !a.rumpf.includes("recordAudit"))
        .map((a) => a.name)
        .filter((name) => !(name in OHNE_EINTRAG));

      expect(ohne, `ohne recordAudit: ${ohne.join(", ")}`).toEqual([]);
    },
  );

  it("führt keine Ausnahme, die es nicht mehr gibt", () => {
    const alle = serverDateien.flatMap((pfad) =>
      aktionen(readFileSync(pfad, "utf8")).map((a) => a.name),
    );
    for (const name of Object.keys(OHNE_EINTRAG)) {
      expect(alle, `${name} steht auf der Ausnahmeliste`).toContain(name);
    }
  });
});
