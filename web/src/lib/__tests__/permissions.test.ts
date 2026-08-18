import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_PRESETS,
  can,
  isPermission,
  sanitizePermissions,
  withImplied,
} from "../permissions";

const admin = { role: "ADMIN" as const, permissions: [] };
const mitarbeiter = (permissions: string[]) => ({
  role: "MITARBEITER" as const,
  permissions,
});

describe("Rechtekatalog", () => {
  it("hat eindeutige Schlüssel", () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });

  it("vergibt in jeder Vorlage nur bekannte Rechte", () => {
    for (const preset of PERMISSION_PRESETS) {
      for (const permission of preset.permissions) {
        expect(isPermission(permission)).toBe(true);
      }
    }
  });

  it("hält die Vorlagen in sich schlüssig", () => {
    for (const preset of PERMISSION_PRESETS) {
      // Eine Vorlage darf keine Rechte enthalten, deren Voraussetzungen fehlen.
      expect(withImplied(preset.permissions).sort()).toEqual(
        [...preset.permissions].sort(),
      );
    }
  });
});

describe("can()", () => {
  it("gibt Administratoren alles frei", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(can(admin, permission)).toBe(true);
    }
  });

  it("prüft bei Mitarbeitern die Liste", () => {
    const user = mitarbeiter(["kunden.ansehen"]);
    expect(can(user, "kunden.ansehen")).toBe(true);
    expect(can(user, "kunden.bearbeiten")).toBe(false);
    expect(can(user, "kampagnen.senden")).toBe(false);
  });

  it("verweigert alles ohne Benutzer", () => {
    expect(can(null, "kunden.ansehen")).toBe(false);
    expect(can(undefined, "kunden.ansehen")).toBe(false);
  });

  it("trennt Versand freigeben von Kampagne anlegen", () => {
    const vorbereiter = mitarbeiter(
      PERMISSION_PRESETS.find((p) => p.key === "sachbearbeitung")!.permissions,
    );
    expect(can(vorbereiter, "kampagnen.erstellen")).toBe(true);
    expect(can(vorbereiter, "kampagnen.senden")).toBe(false);

    const versender = mitarbeiter(
      PERMISSION_PRESETS.find((p) => p.key === "versand")!.permissions,
    );
    expect(can(versender, "kampagnen.senden")).toBe(true);
  });

  it("lässt „Nur Lesen“ nichts ändern", () => {
    const leser = mitarbeiter(
      PERMISSION_PRESETS.find((p) => p.key === "lesen")!.permissions,
    );
    expect(can(leser, "kunden.ansehen")).toBe(true);
    for (const permission of ALL_PERMISSIONS.filter((p) =>
      p.endsWith(".bearbeiten") || p.endsWith(".verwalten") || p.endsWith(".loeschen"),
    )) {
      expect(can(leser, permission)).toBe(false);
    }
  });
});

describe("sanitizePermissions()", () => {
  it("wirft unbekannte Werte weg", () => {
    expect(
      sanitizePermissions(["kunden.ansehen", "alles.duerfen", "<script>"]),
    ).toEqual(["kunden.ansehen"]);
  });

  it("entfernt Doppelungen", () => {
    expect(
      sanitizePermissions(["kunden.ansehen", "kunden.ansehen"]),
    ).toHaveLength(1);
  });
});

describe("withImplied()", () => {
  it("ergänzt das Ansehen beim Bearbeiten", () => {
    expect(withImplied(["kunden.bearbeiten"])).toContain("kunden.ansehen");
  });

  it("löst Ketten vollständig auf", () => {
    const result = withImplied(["kampagnen.senden"]);
    expect(result).toContain("kampagnen.erstellen");
    expect(result).toContain("kampagnen.ansehen");
    expect(result).toContain("kunden.ansehen");
  });

  it("ergänzt beim Löschen auch das Bearbeiten", () => {
    const result = withImplied(["kunden.loeschen"]);
    expect(result).toContain("kunden.bearbeiten");
    expect(result).toContain("kunden.ansehen");
  });

  it("ist idempotent", () => {
    const once = withImplied(["kunden.loeschen"]);
    expect(withImplied(once).sort()).toEqual([...once].sort());
  });

  it("lässt eine leere Auswahl leer", () => {
    expect(withImplied([])).toEqual([]);
  });
});

describe("Standardrechte", () => {
  it("erlauben das Arbeiten, aber keinen Versand", () => {
    const user = mitarbeiter(DEFAULT_PERMISSIONS);
    expect(can(user, "kunden.bearbeiten")).toBe(true);
    expect(can(user, "kampagnen.senden")).toBe(false);
    expect(can(user, "benutzer.verwalten")).toBe(false);
    expect(can(user, "mailkonten.verwalten")).toBe(false);
  });
});

describe("Katalogstruktur", () => {
  it("ordnet jedes Recht genau einer Gruppe zu", () => {
    const seen = new Set<string>();
    for (const group of PERMISSIONS) {
      for (const item of group.items) {
        expect(seen.has(item.key)).toBe(false);
        seen.add(item.key);
      }
    }
    expect(seen.size).toBe(ALL_PERMISSIONS.length);
  });
});
