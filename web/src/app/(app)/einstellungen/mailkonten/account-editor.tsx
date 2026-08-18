"use client";

import { useActionState, useEffect, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { saveMailAccountAction, type SettingsFormState } from "../actions";

type AccountValues = {
  id: string;
  label: string;
  providerId: string;
  username: string;
  fromEmail: string;
  fromName: string;
  isDefault: boolean;
};

export function AccountEditor({
  account,
  providers,
  trigger,
  variant = "tertiary",
}: {
  account: AccountValues | null;
  providers: { id: string; name: string }[];
  trigger: string;
  variant?: "tertiary" | "primary";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<SettingsFormState, FormData>(
    saveMailAccountAction,
    {},
  );

  useEffect(() => {
    if (state.message) setOpen(false);
  }, [state.message]);

  if (!open) {
    return (
      <Button
        type="button"
        variant={variant}
        onClick={() => setOpen(true)}
        disabled={providers.length === 0}
        title={
          providers.length === 0 ? "Zuerst einen Provider anlegen" : undefined
        }
      >
        {trigger}
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-base font-semibold">
          {account ? "Konto bearbeiten" : "Absenderkonto anlegen"}
        </h2>

        <ActionForm action={formAction} className="space-y-4">
          {account ? <input type="hidden" name="id" value={account.id} /> : null}

          {state.errors?._ ? (
            <Alert variant="error">{state.errors._}</Alert>
          ) : null}

          <Field
            label="Bezeichnung"
            htmlFor="label"
            error={state.errors?.label}
            hint="Nur intern, z. B. „Info-Postfach“."
          >
            <Input
              id="label"
              name="label"
              defaultValue={account?.label ?? ""}
              required
              autoFocus
            />
          </Field>

          <Field
            label="Provider"
            htmlFor="providerId"
            error={state.errors?.providerId}
          >
            <Select
              id="providerId"
              name="providerId"
              defaultValue={account?.providerId ?? providers[0]?.id}
              required
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Benutzername"
            htmlFor="username"
            error={state.errors?.username}
            hint="Meist die vollständige E-Mail-Adresse."
          >
            <Input
              id="username"
              name="username"
              defaultValue={account?.username ?? ""}
              required
              autoComplete="off"
            />
          </Field>

          <Field
            label={account ? "Passwort (optional)" : "Passwort"}
            htmlFor="accountPassword"
            error={state.errors?.password}
            hint={
              account
                ? "Leer lassen, um das gespeicherte Passwort beizubehalten."
                : "Bei Google und Microsoft wird ein App-Passwort benötigt."
            }
          >
            <Input
              id="accountPassword"
              name="password"
              type="password"
              autoComplete="new-password"
              required={!account}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Absendername"
              htmlFor="fromName"
              error={state.errors?.fromName}
            >
              <Input
                id="fromName"
                name="fromName"
                defaultValue={account?.fromName ?? ""}
                required
                placeholder="Schulranzen-Aachen"
              />
            </Field>
            <Field
              label="Absenderadresse"
              htmlFor="fromEmail"
              error={state.errors?.fromEmail}
            >
              <Input
                id="fromEmail"
                name="fromEmail"
                type="email"
                defaultValue={account?.fromEmail ?? ""}
                required
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isDefault"
              defaultChecked={account?.isDefault ?? false}
              className="size-4 rounded border-slate-300"
            />
            Als Standardkonto verwenden
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
