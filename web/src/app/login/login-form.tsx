"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Alert, Button, Field, Input } from "@/components/ui";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );
  // React setzt ein Formular nach dem Ausfuehren einer Server Action zurueck.
  // Die Adresse wird deshalb kontrolliert gehalten, damit nach einem Tippfehler
  // im Passwort nicht auch die E-Mail neu eingegeben werden muss.
  const [email, setEmail] = useState("");

  return (
    <ActionForm action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />

      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      <Field label="E-Mail" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.de"
        />
      </Field>

      <Field label="Passwort" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isPending}
      >
        {isPending ? "Anmelden…" : "Anmelden"}
      </Button>
    </ActionForm>
  );
}
