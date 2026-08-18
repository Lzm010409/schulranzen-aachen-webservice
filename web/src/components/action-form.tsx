"use client";

import { startTransition, type ComponentProps } from "react";

/**
 * Formular fuer Server Actions, das die Eingaben behaelt.
 *
 * Wird eine Action direkt an `<form action={…}>` gehaengt, setzt React das
 * Formular nach jedem Absenden zurueck. Kehrt die Action mit einem Fehler oder
 * einer Rueckfrage zurueck, stehen die Felder dann wieder leer da — der Nutzer
 * muesste alles erneut eintippen.
 *
 * Deshalb wird hier selbst abgesendet: FormData aus dem DOM lesen und die
 * Action in einer Transition aufrufen. Das Formular bleibt unangetastet.
 *
 * Achtung: `useFormStatus` funktioniert in diesem Aufbau nicht. Den
 * Ladezustand liefert `useActionState` als drittes Element (`isPending`).
 */
export function ActionForm({
  action,
  onSubmit,
  children,
  ...props
}: Omit<ComponentProps<"form">, "action"> & {
  action: (formData: FormData) => void;
}) {
  return (
    <form
      {...props}
      onSubmit={(event) => {
        onSubmit?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        // Der ausloesende Knopf muss mitgegeben werden: `new FormData(form)`
        // allein uebernimmt name/value des Submit-Buttons nicht, und genau
        // darueber unterscheiden Formulare mit mehreren Knoepfen ihre Aktion.
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const data = new FormData(
          event.currentTarget,
          submitter instanceof HTMLElement ? submitter : null,
        );
        startTransition(() => action(data));
      }}
    >
      {children}
    </form>
  );
}
