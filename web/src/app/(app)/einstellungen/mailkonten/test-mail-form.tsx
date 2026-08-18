"use client";

import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";

/**
 * Schickt eine echte Testmail ueber das gewaehlte Konto. `verify()` prueft nur
 * die Anmeldung — erst eine zugestellte Nachricht zeigt, dass der Provider den
 * Absender akzeptiert.
 */
export function TestMailForm({
  accountId,
  defaultEmail,
  action,
}: {
  accountId: string;
  defaultEmail: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="tertiary" onClick={() => setOpen(true)}>
        Testmail senden
      </Button>
    );
  }

  return (
    <div className="overlay">
      <div className="dialog">
        <h2 className="dialog-title">Testmail senden</h2>
        <form action={action} className="dialog-body">
          <input type="hidden" name="id" value={accountId} />
          <Field
            label="Empfänger"
            htmlFor={`testEmail-${accountId}`}
            hint="Es geht genau eine Nachricht an diese Adresse — kein Kundenversand."
          >
            <Input
              id={`testEmail-${accountId}`}
              name="testEmail"
              type="email"
              defaultValue={defaultEmail}
              required
              autoFocus
            />
          </Field>
          <div className="dialog-actions">
            <Button type="button" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" variant="primary">
              Senden
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
