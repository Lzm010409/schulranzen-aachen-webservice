"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./ui";
import type { ComponentProps } from "react";

/**
 * Absendeknopf, der waehrend der Aktion sichtbar arbeitet.
 *
 * `useFormStatus` gilt fuer das umgebende `<form action={…}>` — genau die
 * Bauart, die hier fuer Loeschen, Wiederherstellen, Prüfen und Starten
 * verwendet wird. Der Knopf sperrt sich waehrenddessen selbst, was
 * Doppelklicks und damit doppelte Datensaetze verhindert.
 *
 * Nicht verwendbar in `ActionForm`: das sendet selbst ab, dort liefert
 * `useActionState` den Ladezustand als drittes Element (`isPending`).
 */
export function SubmitButton({
  children,
  busyLabel,
  disabled,
  ...props
}: ComponentProps<typeof Button> & { busyLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button {...props} type="submit" disabled={disabled || pending}>
      {pending ? (
        <>
          <span className="loading-spinner loading-spinner-inline" aria-hidden="true" />
          {busyLabel ?? "Bitte warten…"}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
