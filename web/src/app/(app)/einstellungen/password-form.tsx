"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Alert, Button, Field, Input } from "@/components/ui";
import { changeOwnPasswordAction, type SettingsFormState } from "./actions";

export function PasswordForm() {
  const [state, formAction] = useActionState<SettingsFormState, FormData>(
    changeOwnPasswordAction,
    {},
  );

  return (
    <ActionForm action={formAction} className="max-w-sm space-y-4">
      {state.message ? <Alert variant="success">{state.message}</Alert> : null}

      <Field
        label="Aktuelles Passwort"
        htmlFor="current"
        error={state.errors?.current}
      >
        <Input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Field
        label="Neues Passwort"
        htmlFor="next"
        error={state.errors?.next}
        hint="Mindestens 10 Zeichen."
      >
        <Input
          id="next"
          name="next"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
        />
      </Field>

      <Button type="submit" variant="primary">
        Passwort ändern
      </Button>
    </ActionForm>
  );
}
