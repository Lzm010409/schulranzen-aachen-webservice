"use client";

import { useActionState, useEffect, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Alert, Button, Field, Input } from "@/components/ui";
import { saveCategoryAction, type CategoryFormState } from "./actions";

export type CategoryRow = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  products: number;
};

/**
 * Pflege der Warengruppen direkt am Katalog.
 *
 * Bewusst keine eigene Seite in den Einstellungen: es sind eine Handvoll
 * Einträge, und wer sie ändert, arbeitet ohnehin gerade an den Produkten.
 */
export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const [bearbeitet, setBearbeitet] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState<
    CategoryFormState,
    FormData
  >(saveCategoryAction, {});

  useEffect(() => {
    if (state.message) setBearbeitet(null);
  }, [state.message]);

  return (
    <div className="space-y-3">
      {state.errors?._ ? <Alert variant="error">{state.errors._}</Alert> : null}

      <ul className="category-list">
        {categories.map((entry) => (
          <li key={entry.id}>
            {bearbeitet === entry.id ? (
              <ActionForm action={formAction} className="category-form">
                <input type="hidden" name="id" value={entry.id} />
                <Input
                  name="name"
                  defaultValue={entry.name}
                  aria-label="Name der Warengruppe"
                  autoFocus
                />
                <Input
                  name="sortOrder"
                  type="number"
                  min={0}
                  max={999}
                  defaultValue={entry.sortOrder}
                  aria-label="Reihenfolge"
                  className="category-order"
                />
                <label className="category-active">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={entry.active}
                  />
                  aktiv
                </label>
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending ? "Speichert…" : "Speichern"}
                </Button>
                <Button type="button" onClick={() => setBearbeitet(null)}>
                  Abbrechen
                </Button>
              </ActionForm>
            ) : (
              <div className="category-row">
                <span className={entry.active ? "" : "muted"}>
                  {entry.name}
                  {entry.active ? "" : " (inaktiv)"}
                </span>
                <span className="muted">{entry.products} Produkte</span>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setBearbeitet(entry.id)}
                >
                  bearbeiten
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <ActionForm action={formAction} className="category-form">
        <Field label="Neue Warengruppe" htmlFor="newCategoryName" error={state.errors?.name}>
          <Input
            id="newCategoryName"
            name="name"
            placeholder="z. B. Schulranzen"
          />
        </Field>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Legt an…" : "Anlegen"}
        </Button>
      </ActionForm>
    </div>
  );
}
