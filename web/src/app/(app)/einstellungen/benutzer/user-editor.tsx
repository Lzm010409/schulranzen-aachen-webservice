"use client";

import { useActionState, useEffect, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { saveUserAction, type SettingsFormState } from "../actions";

type UserValues = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MITARBEITER";
  active: boolean;
};

export function UserEditor({
  user,
  trigger,
  variant = "ghost",
}: {
  user: UserValues | null;
  trigger: string;
  variant?: "ghost" | "primary";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<SettingsFormState, FormData>(
    saveUserAction,
    {},
  );

  useEffect(() => {
    if (state.message) setOpen(false);
  }, [state.message]);

  if (!open) {
    return (
      <Button type="button" variant={variant} onClick={() => setOpen(true)}>
        {trigger}
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-base font-semibold">
          {user ? "Benutzer bearbeiten" : "Benutzer anlegen"}
        </h2>

        <ActionForm action={formAction} className="space-y-4">
          {user ? <input type="hidden" name="id" value={user.id} /> : null}

          {state.errors?._ ? (
            <Alert variant="error">{state.errors._}</Alert>
          ) : null}

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
              defaultValue={user?.role ?? "MITARBEITER"}
            >
              <option value="MITARBEITER">
                Mitarbeiter (Kunden, Vorlagen, Versand)
              </option>
              <option value="ADMIN">
                Administrator (zusätzlich Benutzerverwaltung)
              </option>
            </Select>
          </Field>

          <Field
            label={user ? "Neues Passwort (optional)" : "Passwort"}
            htmlFor="userPassword"
            error={state.errors?.password}
            hint={
              user
                ? "Leer lassen, um es unverändert zu lassen. Eine Änderung beendet alle Sitzungen."
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

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="active"
              defaultChecked={user?.active ?? true}
              className="size-4 rounded border-slate-300"
            />
            Konto ist aktiv
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" variant="primary">
              Speichern
            </Button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
