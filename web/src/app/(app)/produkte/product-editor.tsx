"use client";

import { useActionState, useEffect, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { saveProductAction, type ProductFormState } from "./actions";

type ProductValues = {
  id: string;
  name: string;
  categoryId: string;
  modelYear: string;
  active: boolean;
};

export type CategoryChoice = { id: string; name: string };

export function ProductEditor({
  product,
  categories,
  trigger,
  variant = "tertiary",
}: {
  product: ProductValues | null;
  categories: CategoryChoice[];
  trigger: string;
  variant?: "tertiary" | "primary";
}) {
  const [open, setOpen] = useState(false);
  // Eine neue Warengruppe soll sich anlegen lassen, ohne die Maske zu
  // verlassen — sonst tippt am Ende doch wieder jeder seine eigene.
  const [neueGruppe, setNeueGruppe] = useState(false);
  const [state, formAction] = useActionState<ProductFormState, FormData>(
    saveProductAction,
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
          {product ? "Produkt bearbeiten" : "Produkt anlegen"}
        </h2>

        <ActionForm action={formAction} className="space-y-4">
          {product ? (
            <input type="hidden" name="id" value={product.id} />
          ) : null}

          {state.errors?._ ? (
            <Alert variant="error">{state.errors._}</Alert>
          ) : null}

          <Field label="Name" htmlFor="name" error={state.errors?.name}>
            <Input
              id="name"
              name="name"
              defaultValue={product?.name ?? ""}
              required
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Warengruppe" htmlFor="categoryId">
              {neueGruppe ? (
                <Input
                  id="newCategory"
                  name="newCategory"
                  placeholder="z. B. Schulranzen"
                  autoFocus
                />
              ) : (
                <Select
                  id="categoryId"
                  name="categoryId"
                  defaultValue={product?.categoryId ?? ""}
                >
                  <option value="">— keine —</option>
                  {categories.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </Select>
              )}
              <button
                type="button"
                className="link-button"
                onClick={() => setNeueGruppe((offen) => !offen)}
              >
                {neueGruppe ? "aus der Liste wählen" : "neue Warengruppe"}
              </button>
            </Field>

            <Field
              label="Modelljahr"
              htmlFor="modelYear"
              error={state.errors?.modelYear}
              hint="Kollektion des Artikels, nicht der Einschulungsjahrgang."
            >
              <Input
                id="modelYear"
                name="modelYear"
                type="number"
                min={1990}
                max={2100}
                defaultValue={product?.modelYear ?? ""}
                placeholder="z. B. 2026"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="active"
              defaultChecked={product?.active ?? true}
              className="size-4 rounded border-slate-300"
            />
            Aktiv (erscheint in Auswahllisten)
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
