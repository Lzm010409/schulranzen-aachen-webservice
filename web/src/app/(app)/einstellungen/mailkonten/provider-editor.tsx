"use client";

import { useActionState, useEffect, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { saveProviderAction, type SettingsFormState } from "../actions";

type ProviderValues = {
  id: string;
  name: string;
  host: string;
  port: number;
  security: "SSL" | "STARTTLS";
};

/**
 * Presets mit den jeweils korrekten Kombinationen. Port 465 verlangt
 * durchgängiges SSL, Port 587 STARTTLS — im Altsystem war beides vermischt.
 */
const PRESETS: { label: string; host: string; port: number; security: "SSL" | "STARTTLS" }[] = [
  { label: "IONOS", host: "smtp.ionos.de", port: 465, security: "SSL" },
  { label: "Strato", host: "smtp.strato.de", port: 465, security: "SSL" },
  { label: "Vodafone", host: "smtp.vodafonemail.de", port: 465, security: "SSL" },
  { label: "1&1", host: "smtp.1und1.de", port: 465, security: "SSL" },
  { label: "Telekom", host: "securesmtp.t-online.de", port: 465, security: "SSL" },
  { label: "Gmail (App-Passwort)", host: "smtp.gmail.com", port: 465, security: "SSL" },
  { label: "Microsoft 365", host: "smtp.office365.com", port: 587, security: "STARTTLS" },
  { label: "GMX", host: "mail.gmx.net", port: 465, security: "SSL" },
  { label: "Web.de", host: "smtp.web.de", port: 587, security: "STARTTLS" },
];

export function ProviderEditor({
  provider,
  trigger,
}: {
  provider: ProviderValues | null;
  trigger: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<SettingsFormState, FormData>(
    saveProviderAction,
    {},
  );
  const [values, setValues] = useState({
    name: provider?.name ?? "",
    host: provider?.host ?? "",
    port: String(provider?.port ?? 465),
    security: provider?.security ?? "SSL",
  });

  useEffect(() => {
    if (state.message) setOpen(false);
  }, [state.message]);

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        {trigger}
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-base font-semibold">
          {provider ? "Provider bearbeiten" : "Provider anlegen"}
        </h2>

        {!provider ? (
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-slate-500">
              Preset übernehmen
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setValues({
                      name: preset.label,
                      host: preset.host,
                      port: String(preset.port),
                      security: preset.security,
                    })
                  }
                  className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <ActionForm action={formAction} className="space-y-4">
          {provider ? (
            <input type="hidden" name="id" value={provider.id} />
          ) : null}

          {state.errors?._ ? (
            <Alert variant="error">{state.errors._}</Alert>
          ) : null}

          <Field label="Name" htmlFor="providerName" error={state.errors?.name}>
            <Input
              id="providerName"
              name="name"
              value={values.name}
              onChange={(e) =>
                setValues((v) => ({ ...v, name: e.target.value }))
              }
              required
            />
          </Field>

          <Field label="SMTP-Host" htmlFor="host" error={state.errors?.host}>
            <Input
              id="host"
              name="host"
              value={values.host}
              onChange={(e) =>
                setValues((v) => ({ ...v, host: e.target.value }))
              }
              required
              placeholder="smtp.example.de"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Port" htmlFor="port" error={state.errors?.port}>
              <Input
                id="port"
                name="port"
                type="number"
                value={values.port}
                onChange={(e) =>
                  setValues((v) => ({ ...v, port: e.target.value }))
                }
                required
              />
            </Field>

            <Field
              label="Verschlüsselung"
              htmlFor="security"
              error={state.errors?.security}
            >
              <Select
                id="security"
                name="security"
                value={values.security}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    security: e.target.value as "SSL" | "STARTTLS",
                  }))
                }
              >
                <option value="SSL">SSL/TLS (Port 465)</option>
                <option value="STARTTLS">STARTTLS (Port 587/25)</option>
              </Select>
            </Field>
          </div>

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
