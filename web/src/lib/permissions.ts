/**
 * Rechteverwaltung.
 *
 * Jeder Benutzer traegt eine Liste von Einzelrechten. Administratoren haben
 * unabhaengig davon immer alle Rechte — damit kann sich niemand versehentlich
 * aus der Benutzerverwaltung aussperren.
 *
 * Die Rechte werden an zwei Stellen durchgesetzt:
 *   - serverseitig in jeder Server Action und auf jeder Seite (verbindlich)
 *   - in der Oberflaeche, die nicht anzeigt, was ohnehin nicht erlaubt ist
 * Die Oberflaeche ist reine Bequemlichkeit; verlassen wird sich auf den Server.
 */

export const PERMISSIONS = [
  {
    group: "Kunden",
    items: [
      { key: "kunden.ansehen", label: "Ansehen", hint: "Kundenliste und Detailseiten" },
      { key: "kunden.bearbeiten", label: "Anlegen und bearbeiten" },
      { key: "kunden.loeschen", label: "Löschen und wiederherstellen" },
      { key: "kunden.exportieren", label: "Exportieren", hint: "CSV und Excel" },
    ],
  },
  {
    group: "Produkte",
    items: [
      { key: "produkte.ansehen", label: "Ansehen" },
      { key: "produkte.verwalten", label: "Anlegen, bearbeiten, zusammenführen" },
    ],
  },
  {
    group: "Vorlagen",
    items: [
      { key: "vorlagen.ansehen", label: "Ansehen" },
      { key: "vorlagen.verwalten", label: "Anlegen und bearbeiten" },
    ],
  },
  {
    group: "Mailversand",
    items: [
      { key: "kampagnen.ansehen", label: "Ansehen", hint: "Kampagnen und Versandprotokoll" },
      { key: "kampagnen.erstellen", label: "Entwürfe anlegen und testen" },
      {
        key: "kampagnen.senden",
        label: "Versand freigeben",
        hint: "Erst damit gehen Mails tatsächlich raus",
      },
    ],
  },
  {
    group: "Verwaltung",
    items: [
      {
        key: "mailkonten.verwalten",
        label: "Mailkonten und Provider",
        hint: "Zugriff auf die hinterlegten SMTP-Zugänge",
      },
      {
        key: "daten.importieren",
        label: "Daten importieren",
        hint: "Übernahme aus dem Altsystem und Import aus CSV/Excel",
      },
      { key: "protokoll.ansehen", label: "Protokoll einsehen" },
      {
        key: "benutzer.verwalten",
        label: "Benutzer verwalten",
        hint: "Nur für Administratoren sinnvoll",
      },
    ],
  },
] as const;

export type Permission =
  (typeof PERMISSIONS)[number]["items"][number]["key"];

export const ALL_PERMISSIONS: Permission[] = PERMISSIONS.flatMap((g) =>
  g.items.map((i) => i.key),
);

const PERMISSION_SET = new Set<string>(ALL_PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

export function permissionLabel(key: string): string {
  for (const group of PERMISSIONS) {
    for (const item of group.items) {
      if (item.key === key) return `${group.group}: ${item.label}`;
    }
  }
  return key;
}

/** Vorlagen fuer die Benutzerverwaltung — fuellen die Auswahl vor. */
export const PERMISSION_PRESETS: {
  key: string;
  label: string;
  hint: string;
  permissions: Permission[];
}[] = [
  {
    key: "voll",
    label: "Vollzugriff (ohne Benutzerverwaltung)",
    hint: "Darf alles bearbeiten und Mails freigeben.",
    permissions: ALL_PERMISSIONS.filter((p) => p !== "benutzer.verwalten"),
  },
  {
    key: "sachbearbeitung",
    label: "Sachbearbeitung",
    hint: "Pflegt Kunden, Produkte und Vorlagen, bereitet Mails vor — gibt den Versand aber nicht frei.",
    permissions: [
      "kunden.ansehen",
      "kunden.bearbeiten",
      "kunden.exportieren",
      "produkte.ansehen",
      "produkte.verwalten",
      "vorlagen.ansehen",
      "vorlagen.verwalten",
      "kampagnen.ansehen",
      "kampagnen.erstellen",
    ],
  },
  {
    key: "versand",
    label: "Versand",
    hint: "Wie Sachbearbeitung, darf zusätzlich den Versand freigeben.",
    permissions: [
      "kunden.ansehen",
      "kunden.bearbeiten",
      "kunden.exportieren",
      "produkte.ansehen",
      "vorlagen.ansehen",
      "vorlagen.verwalten",
      "kampagnen.ansehen",
      "kampagnen.erstellen",
      "kampagnen.senden",
    ],
  },
  {
    key: "lesen",
    label: "Nur Lesen",
    hint: "Darf nichts ändern.",
    permissions: [
      "kunden.ansehen",
      "produkte.ansehen",
      "vorlagen.ansehen",
      "kampagnen.ansehen",
    ],
  },
];

export const DEFAULT_PERMISSIONS: Permission[] =
  PERMISSION_PRESETS.find((p) => p.key === "sachbearbeitung")!.permissions;

export type PermissionHolder = {
  role: "ADMIN" | "MITARBEITER";
  permissions: string[];
};

/** Administratoren duerfen alles; sonst entscheidet die Liste. */
export function can(
  user: PermissionHolder | null | undefined,
  permission: Permission,
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return user.permissions.includes(permission);
}

export function canAny(
  user: PermissionHolder | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => can(user, p));
}

/** Filtert eine Eingabe auf gueltige Rechte — Schutz vor manipulierten Formularen. */
export function sanitizePermissions(values: string[]): Permission[] {
  const unique = new Set<Permission>();
  for (const value of values) {
    if (isPermission(value)) unique.add(value);
  }
  return [...unique];
}

/**
 * Rechte, die ein Recht implizit voraussetzt. Wer bearbeiten darf, muss auch
 * ansehen duerfen — sonst entstehen Konten, die eine Seite oeffnen koennen,
 * aber nichts sehen.
 */
const IMPLIED: Partial<Record<Permission, Permission[]>> = {
  "kunden.bearbeiten": ["kunden.ansehen"],
  "kunden.loeschen": ["kunden.ansehen", "kunden.bearbeiten"],
  "kunden.exportieren": ["kunden.ansehen"],
  "produkte.verwalten": ["produkte.ansehen"],
  "vorlagen.verwalten": ["vorlagen.ansehen"],
  "kampagnen.erstellen": ["kampagnen.ansehen", "kunden.ansehen"],
  "daten.importieren": ["kunden.ansehen", "kunden.bearbeiten", "produkte.ansehen"],
  "kampagnen.senden": ["kampagnen.ansehen", "kampagnen.erstellen", "kunden.ansehen"],
};

export function withImplied(permissions: Permission[]): Permission[] {
  const result = new Set<Permission>(permissions);
  let changed = true;
  while (changed) {
    changed = false;
    for (const permission of [...result]) {
      for (const implied of IMPLIED[permission] ?? []) {
        if (!result.has(implied)) {
          result.add(implied);
          changed = true;
        }
      }
    }
  }
  return [...result];
}

export function impliedBy(permission: Permission): Permission[] {
  return IMPLIED[permission] ?? [];
}
