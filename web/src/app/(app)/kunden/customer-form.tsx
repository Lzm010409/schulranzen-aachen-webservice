"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { saveCustomerAction, type CustomerFormState } from "./actions";

export type CustomerFormValues = {
  id?: string;
  salutation: string;
  firstName: string;
  lastName: string;
  street: string;
  zip: string;
  city: string;
  email: string;
  phone: string;
  notes: string;
  purchases: {
    id: string | null;
    productName: string;
    date: string;
    season: string;
  }[];
};

export function CustomerForm({
  values,
  products,
  cancelHref,
}: {
  values: CustomerFormValues;
  products: string[];
  cancelHref: string;
}) {
  const [state, formAction, isPending] = useActionState<
    CustomerFormState,
    FormData
  >(saveCustomerAction, {});
  const [purchases, setPurchases] = useState(
    values.purchases.length > 0
      ? values.purchases
      : [{ id: null, productName: "", date: "", season: "" }],
  );

  const errors = state.errors ?? {};
  const confirming = Boolean(state.duplicates?.length);

  return (
    <ActionForm action={formAction} className="space-y-6">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      {confirming ? (
        <input type="hidden" name="confirmDuplicate" value="1" />
      ) : null}

      {state.message ? (
        <Alert variant="warning" title="Mögliche Dublette">
          <p>{state.message}</p>
          {state.duplicates?.length ? (
            <ul className="mt-2 space-y-1">
              {state.duplicates.map((hit) => (
                <li key={hit.id}>
                  <a
                    href={`/kunden/${hit.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {hit.firstName} {hit.lastName}, {hit.zip} {hit.city}
                    {hit.email ? ` · ${hit.email}` : ""}
                  </a>{" "}
                  <span className="text-xs">(gleiche {hit.reason})</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      <Card title="Stammdaten">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Anrede"
            htmlFor="salutation"
            hint="Trägt die Anrede in Mails. Ohne Angabe bleibt sie neutral."
          >
            <Select
              id="salutation"
              name="salutation"
              defaultValue={values.salutation}
            >
              <option value="UNBEKANNT">keine Angabe</option>
              <option value="FRAU">Frau</option>
              <option value="HERR">Herr</option>
            </Select>
          </Field>
          <div />
          <Field label="Vorname" htmlFor="firstName" error={errors.firstName}>
            <Input
              id="firstName"
              name="firstName"
              defaultValue={values.firstName}
              required
              autoFocus
            />
          </Field>
          <Field label="Nachname" htmlFor="lastName" error={errors.lastName}>
            <Input
              id="lastName"
              name="lastName"
              defaultValue={values.lastName}
              required
            />
          </Field>
          <Field
            label="Adresse"
            htmlFor="street"
            error={errors.street}
            className="sm:col-span-2"
          >
            <Input
              id="street"
              name="street"
              defaultValue={values.street}
              required
              placeholder="Straße und Hausnummer"
            />
          </Field>
          <Field label="PLZ" htmlFor="zip" error={errors.zip}>
            <Input
              id="zip"
              name="zip"
              defaultValue={values.zip}
              required
              inputMode="numeric"
              maxLength={5}
            />
          </Field>
          <Field label="Stadt" htmlFor="city" error={errors.city}>
            <Input id="city" name="city" defaultValue={values.city} required />
          </Field>
          <Field
            label="E-Mail"
            htmlFor="email"
            error={errors.email}
            hint="Ohne Adresse kann der Kunde nicht angeschrieben werden."
          >
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={values.email}
            />
          </Field>
          <Field
            label="Telefon"
            htmlFor="phone"
            error={errors.phone}
            hint="Wird automatisch nach +49… normalisiert."
          >
            <Input id="phone" name="phone" defaultValue={values.phone} />
          </Field>
          <Field
            label="Notiz"
            htmlFor="notes"
            error={errors.notes}
            className="sm:col-span-2"
          >
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={values.notes}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Käufe"
        description="Ein Kunde kann mehrfach kaufen. Unbekannte Produkte werden beim Speichern angelegt."
      >
        <datalist id="produkte">
          {products.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <div className="space-y-3">
          {purchases.map((purchase, index) => (
            <div key={index} className="flex flex-wrap items-end gap-3">
              {purchase.id ? (
                <input type="hidden" name="purchaseId" value={purchase.id} />
              ) : (
                <input type="hidden" name="purchaseId" value="" />
              )}
              <Field
                label="Produkt"
                htmlFor={`purchaseProduct-${index}`}
                className="min-w-56 flex-1"
              >
                <Input
                  id={`purchaseProduct-${index}`}
                  name="purchaseProduct"
                  list="produkte"
                  defaultValue={purchase.productName}
                  placeholder="z. B. Ergobag Cubo"
                />
              </Field>
              <Field label="Kaufdatum" htmlFor={`purchaseDate-${index}`}>
                <Input
                  id={`purchaseDate-${index}`}
                  name="purchaseDate"
                  type="date"
                  defaultValue={purchase.date}
                />
              </Field>
              <Field
                label="Saison"
                htmlFor={`purchaseSeason-${index}`}
                hint="leer = aus dem Kaufdatum"
              >
                <Input
                  id={`purchaseSeason-${index}`}
                  name="purchaseSeason"
                  type="number"
                  min={1990}
                  max={2100}
                  className="w-28"
                  defaultValue={purchase.season}
                  placeholder="Jahrgang"
                />
              </Field>
              <Button
                type="button"
                variant="tertiary"
                onClick={() =>
                  setPurchases((rows) =>
                    rows.length === 1
                      ? [{ id: null, productName: "", date: "", season: "" }]
                      : rows.filter((_, i) => i !== index),
                  )
                }
              >
                Entfernen
              </Button>
            </div>
          ))}
        </div>

        <Button
          type="button"
          className="mt-3"
          onClick={() =>
            setPurchases((rows) => [
              ...rows,
              { id: null, productName: "", date: "", season: "" },
            ])
          }
        >
          Weiteren Kauf hinzufügen
        </Button>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending
            ? "Speichern…"
            : confirming
              ? "Trotzdem speichern"
              : "Speichern"}
        </Button>
        <a href={cancelHref} className="btn btn-secondary">
          Abbrechen
        </a>
      </div>
    </ActionForm>
  );
}
