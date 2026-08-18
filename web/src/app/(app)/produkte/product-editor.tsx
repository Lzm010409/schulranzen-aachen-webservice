"use client";

import { useActionState, useEffect, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Alert, Button, Field, Input } from "@/components/ui";
import { saveProductAction, type ProductFormState } from "./actions";

type ProductValues = {
  id: string;
  name: string;
  category: string;
  season: string;
  active: boolean;
};

export function ProductEditor({
  product,
  trigger,
  variant = "tertiary",
}: {
  product: ProductValues | null;
  trigger: string;
  variant?: "tertiary" | "primary";
}) {
  const [open, setOpen] = useState(false);
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
            <Field label="Kategorie" htmlFor="category">
              <Input
                id="category"
                name="category"
                defaultValue={product?.category ?? ""}
                placeholder="z. B. Ranzen"
              />
            </Field>
            <Field label="Saison" htmlFor="season">
              <Input
                id="season"
                name="season"
                defaultValue={product?.season ?? ""}
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
