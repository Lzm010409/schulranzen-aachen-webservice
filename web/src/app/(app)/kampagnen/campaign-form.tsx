"use client";

import { useActionState, useMemo, useState } from "react";
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
import { PLACEHOLDERS } from "@/lib/template";
import type { CustomerFilter } from "@/lib/customer-filter";
import { createCampaignAction, type CampaignFormState } from "./actions";

type Account = {
  id: string;
  label: string;
  fromEmail: string;
  fromName: string;
  provider: string;
  verified: boolean;
  isDefault: boolean;
};

type Template = {
  id: string;
  name: string;
  subject: string;
  body: string;
  isHtml: boolean;
};

export function CampaignForm({
  source,
  ids,
  filter,
  filterDescription,
  recipients,
  accounts,
  templates,
  beispiel,
  beispielName,
}: {
  source: "auswahl" | "filter";
  ids: string[];
  /** Platzhalterwerte eines echten Empfängers für die Vorschau. */
  beispiel: Record<string, string>;
  /** Wessen Daten das sind; leer, wenn die Auswahl niemanden enthält. */
  beispielName: string;
  filter: CustomerFilter;
  filterDescription: string;
  recipients: {
    total: number;
    reachable: number;
    withoutEmail: number;
    unsubscribed: number;
    bounced: number;
  };
  accounts: Account[];
  templates: Template[];
}) {
  const [state, formAction, isPending] = useActionState<
    CampaignFormState,
    FormData
  >(createCampaignAction, {});
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const template = templates.find((t) => t.id === templateId) ?? null;

  const excluded = [
    recipients.withoutEmail > 0
      ? `${recipients.withoutEmail} ohne E-Mail-Adresse`
      : null,
    recipients.unsubscribed > 0 ? `${recipients.unsubscribed} abgemeldet` : null,
    recipients.bounced > 0 ? `${recipients.bounced} mit Zustellfehler` : null,
  ].filter(Boolean) as string[];

  const previewHtml = useMemo(() => {
    const sample: Record<string, string> = { ...beispiel, abmeldelink: "#" };
    const fill = (input: string) =>
      input.replace(
        /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
        (match, key: string) => sample[key.toLowerCase()] ?? match,
      );
    const content = fill(body)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/\n/g, "<br>");

    if (!template) {
      return `<div style="font-family:Arial,sans-serif;padding:24px">${content}</div>`;
    }
    const layout = fill(template.body);
    return layout.includes("{{content}}")
      ? layout.replace(/\{\{\s*content\s*\}\}/gi, content)
      : `${layout}<div style="padding:24px">${content}</div>`;
  }, [body, template, beispiel]);

  return (
    <ActionForm action={formAction} className="space-y-6">
      <input type="hidden" name="quelle" value={source} />
      {source === "auswahl" ? (
        <input type="hidden" name="ids" value={ids.join(",")} />
      ) : (
        Object.entries(filter).map(([key, value]) =>
          value ? (
            <input
              key={key}
              type="hidden"
              name={`f_${key}`}
              value={String(value)}
            />
          ) : null,
        )
      )}

      {state.errors?._ ? <Alert variant="error">{state.errors._}</Alert> : null}

      <Card title="Empfänger">
        <p className="text-sm text-slate-700">
          {source === "filter" ? (
            <>
              Alle Treffer des Filters (<em>{filterDescription}</em>)
            </>
          ) : (
            <>Manuell ausgewählte Kunden</>
          )}
          : <strong>{recipients.total.toLocaleString("de-DE")}</strong>{" "}
          Datensätze.
        </p>

        <p className="mt-2 text-sm">
          <strong className="text-emerald-700">
            {recipients.reachable.toLocaleString("de-DE")}
          </strong>{" "}
          werden angeschrieben.
          {excluded.length > 0 ? (
            <>
              {" "}
              <span className="text-slate-600">
                Ausgeschlossen: {excluded.join(", ")}.
              </span>
            </>
          ) : null}
        </p>

        {recipients.reachable === 0 ? (
          <div className="mt-3">
            <Alert variant="error">
              In dieser Auswahl ist niemand erreichbar. Bitte den Filter
              anpassen.
            </Alert>
          </div>
        ) : null}
      </Card>

      <Card title="Absender und Vorlage">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Absenderkonto"
            htmlFor="accountId"
            error={state.errors?.accountId}
          >
            <Select
              id="accountId"
              name="accountId"
              defaultValue={accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id}
              required
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label} · {account.fromName} &lt;{account.fromEmail}&gt;
                  {account.verified ? "" : " (nicht geprüft)"}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Vorlage" htmlFor="templateId">
            <Select
              id="templateId"
              name="templateId"
              value={templateId}
              onChange={(e) => {
                const next = e.target.value;
                setTemplateId(next);
                const picked = templates.find((t) => t.id === next);
                if (picked && !subject) setSubject(picked.subject);
              }}
            >
              <option value="">ohne Vorlage (Standardlayout)</option>
              {templates.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card title="Inhalt">
        <div className="space-y-4">
          <Field
            label="Kampagnenname (nur intern)"
            htmlFor="name"
            error={state.errors?.name}
          >
            <Input
              id="name"
              name="name"
              required
              placeholder="z. B. Sommeraktion 2026"
            />
          </Field>

          <Field label="Betreff" htmlFor="subject" error={state.errors?.subject}>
            <Input
              id="subject"
              name="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </Field>

          <Field
            label="Nachricht"
            htmlFor="body"
            hint={
              template
                ? `Wird an der Stelle {{content}} in „${template.name}“ eingesetzt.`
                : "Ohne Vorlage wird der Text in ein schlichtes Standardlayout gesetzt."
            }
          >
            <Textarea
              id="body"
              name="body"
              rows={12}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Guten Tag,&#10;&#10;…"
            />
          </Field>

          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-slate-500">Platzhalter:</span>
            {PLACEHOLDERS.filter((p) => p.key !== "content").map((p) => (
              <button
                key={p.key}
                type="button"
                title={p.label}
                onClick={() => setBody((v) => `${v}{{${p.key}}}`)}
                className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-brand-700 hover:bg-slate-200"
              >
                {`{{${p.key}}}`}
              </button>
            ))}
          </div>

          <Field
            label="Anhänge"
            htmlFor="attachments"
            error={state.errors?.attachments}
            hint="Mehrere Dateien möglich, zusammen bis 10 MB."
          >
            <Input
              id="attachments"
              name="attachments"
              type="file"
              multiple
              className="py-1.5"
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Vorschau"
        description={
          beispielName
            ? `Gefüllt mit den Daten von ${beispielName} — einem echten Empfänger dieser Auswahl.`
            : "Mit erfundenen Daten gefüllt — die Auswahl enthält noch keinen Kunden."
        }
      >
        <div className="flex justify-center overflow-x-auto bg-slate-100 p-4">
          <iframe
            title="Vorschau"
            sandbox=""
            srcDoc={previewHtml}
            className="h-[420px] w-full max-w-[700px] border border-slate-300 bg-white"
          />
        </div>
      </Card>

      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={isPending || recipients.reachable === 0}
        >
          {isPending ? "Wird vorbereitet…" : "Entwurf anlegen und prüfen"}
        </Button>
        <a href="/kunden" className="btn btn-secondary">
          Abbrechen
        </a>
      </div>
    </ActionForm>
  );
}
