"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import {
  PERMISSIONS,
  PERMISSION_PRESETS,
  impliedBy,
  withImplied,
  type Permission,
} from "@/lib/permissions";
import { saveUserAction, type SettingsFormState } from "../actions";

type UserValues = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MITARBEITER";
  active: boolean;
  permissions: string[];
};

export function UserEditor({
  user,
  trigger,
  variant = "tertiary",
}: {
  user: UserValues | null;
  trigger: string;
  variant?: "tertiary" | "primary";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<
    SettingsFormState,
    FormData
  >(saveUserAction, {});

  const [role, setRole] = useState<"ADMIN" | "MITARBEITER">(
    user?.role ?? "MITARBEITER",
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(user?.permissions ?? []),
  );

  useEffect(() => {
    if (state.message) setOpen(false);
  }, [state.message]);

  // Administratoren haben immer alle Rechte — die Auswahl ist dann gegenstandslos.
  const isAdmin = role === "ADMIN";

  function toggle(key: Permission, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        // Abhaengige Rechte gleich mitnehmen, sonst entsteht ein Konto, das
        // bearbeiten darf, die Seite aber nicht öffnen kann.
        for (const implied of withImplied([key])) next.add(implied);
      } else {
        next.delete(key);
        // Rechte, die dieses hier voraussetzen, fallen mit weg.
        for (const group of PERMISSIONS) {
          for (const item of group.items) {
            if (impliedBy(item.key).includes(key)) next.delete(item.key);
          }
        }
      }
      return next;
    });
  }

  const selectedCount = useMemo(() => selected.size, [selected]);

  if (!open) {
    return (
      <Button type="button" variant={variant} onClick={() => setOpen(true)}>
        {trigger}
      </Button>
    );
  }

  return (
    <div className="overlay">
      <div className="dialog dialog-wide">
        <h2 className="dialog-title">
          {user ? "Benutzer bearbeiten" : "Benutzer anlegen"}
        </h2>

        <ActionForm action={formAction} className="dialog-body">
          {user ? <input type="hidden" name="id" value={user.id} /> : null}

          {state.errors?._ ? (
            <Alert variant="error">{state.errors._}</Alert>
          ) : null}

          <div className="form-grid">
            <Field label="Name" htmlFor="userName" error={state.errors?.name}>
              <Input
                id="userName"
                name="name"
                defaultValue={user?.name ?? ""}
                required
                autoFocus
              />
            </Field>

            <Field label="E-Mail" htmlFor="userEmail" error={state.errors?.email}>
              <Input
                id="userEmail"
                name="email"
                type="email"
                defaultValue={user?.email ?? ""}
                required
              />
            </Field>

            <Field label="Rolle" htmlFor="userRole" error={state.errors?.role}>
              <Select
                id="userRole"
                name="role"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as "ADMIN" | "MITARBEITER")
                }
              >
                <option value="MITARBEITER">Mitarbeiter</option>
                <option value="ADMIN">Administrator</option>
              </Select>
            </Field>

            <Field
              label={user ? "Neues Passwort (optional)" : "Passwort"}
              htmlFor="userPassword"
              error={state.errors?.password}
              hint={
                user
                  ? "Leer lassen lässt es unverändert. Eine Änderung beendet alle Sitzungen."
                  : "Mindestens 10 Zeichen."
              }
            >
              <Input
                id="userPassword"
                name="password"
                type="password"
                autoComplete="new-password"
                required={!user}
                minLength={user ? undefined : 10}
              />
            </Field>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              name="active"
              defaultChecked={user?.active ?? true}
            />
            <span>Konto ist aktiv</span>
          </label>

          <fieldset className="permissions">
            <legend>Rechte</legend>

            {isAdmin ? (
              <Alert variant="info">
                Administratoren haben immer alle Rechte, einschließlich der
                Benutzerverwaltung. Die Auswahl unten wird für dieses Konto
                nicht ausgewertet.
              </Alert>
            ) : (
              <>
                <div className="preset-row">
                  <span className="preset-label">Vorlage übernehmen:</span>
                  {PERMISSION_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      title={preset.hint}
                      className="preset-button"
                      onClick={() => setSelected(new Set(preset.permissions))}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="preset-button"
                    onClick={() => setSelected(new Set())}
                  >
                    Alle abwählen
                  </button>
                </div>

                <p className="permission-count">
                  {selectedCount === 0
                    ? "Kein Recht ausgewählt — dieses Konto kann sich anmelden, sieht aber nichts."
                    : `${selectedCount} Rechte ausgewählt`}
                </p>
              </>
            )}

            <div className="permission-groups">
              {PERMISSIONS.map((group) => (
                <div key={group.group} className="permission-group">
                  <h3>{group.group}</h3>
                  {group.items.map((item) => (
                    <label key={item.key} className="checkbox-row">
                      <input
                        type="checkbox"
                        name="permissions"
                        value={item.key}
                        checked={isAdmin || selected.has(item.key)}
                        disabled={isAdmin}
                        onChange={(e) => toggle(item.key, e.target.checked)}
                      />
                      <span>
                        {item.label}
                        {"hint" in item && item.hint ? (
                          <em className="permission-hint">{item.hint}</em>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </fieldset>

          <div className="dialog-actions">
            <Button type="button" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
