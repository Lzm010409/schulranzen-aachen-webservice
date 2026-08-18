"use client";

import { useActionState, useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Textarea,
} from "@/components/ui";
import { PLACEHOLDERS } from "@/lib/template";
import { MAX_BODY_LENGTH, describeBodyLength } from "@/lib/validation";
import { pruefeMailtauglichkeit } from "@/lib/mail-check";
import { saveTemplateAction, type TemplateFormState } from "./actions";

export type TemplateValues = {
  id?: string;
  name: string;
  subject: string;
  body: string;
  isHtml: boolean;
  category: string;
};

const KNOWN = new Set<string>(PLACEHOLDERS.map((p) => p.key));

export function TemplateEditor({
  values,
  cancelHref,
  beispiel,
  beispielName,
}: {
  values: TemplateValues;
  cancelHref: string;
  /** Platzhalterwerte eines echten Kunden für die Vorschau. */
  beispiel: Record<string, string>;
  /** Wessen Daten das sind; leer, wenn es noch keinen Kunden gibt. */
  beispielName: string;
}) {
  const [state, formAction, isPending] = useActionState<
    TemplateFormState,
    FormData
  >(saveTemplateAction, {});
  const [body, setBody] = useState(values.body);
  const [isHtml, setIsHtml] = useState(values.isHtml);
  const [preview, setPreview] = useState<"desktop" | "mobil" | "aus">("aus");

  // Prüfung im Editor statt erst beim Versand.
  const check = useMemo(() => {
    const found = [...body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map(
      (m) => m[1],
    );
    return {
      unknown: [...new Set(found.filter((k) => !KNOWN.has(k.toLowerCase())))],
      hasContent: found.some((k) => k.toLowerCase() === "content"),
      hasUnsubscribe: found.some((k) => k.toLowerCase() === "abmeldelink"),
    };
  }, [body]);

  // Mailtauglichkeit laufend prüfen, nicht erst beim Versand.
  const befunde = useMemo(() => pruefeMailtauglichkeit(body), [body]);

  const previewHtml = useMemo(() => {
    const sample: Record<string, string> = {
      ...beispiel,
      abmeldelink: "#",
      content:
        "<p>Hier steht später der Text der Kampagne.</p><p>Er wird an dieser Stelle eingesetzt.</p>",
    };
    const filled = body.replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (match, key: string) => sample[key.toLowerCase()] ?? match,
    );
    return isHtml
      ? filled
      : `<pre style="white-space:pre-wrap;font-family:inherit">${filled
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")}</pre>`;
  }, [body, isHtml, beispiel]);

  return (
    <ActionForm action={formAction} className="space-y-6">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <Card title="Vorlage">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" error={state.errors?.name}>
            <Input
              id="name"
              name="name"
              defaultValue={values.name}
              required
              placeholder="z. B. Standard-Layout"
            />
          </Field>
          <Field label="Kategorie" htmlFor="category">
            <Input
              id="category"
              name="category"
              defaultValue={values.category}
              placeholder="z. B. Aktion"
            />
          </Field>
          <Field
            label="Betreff"
            htmlFor="subject"
            error={state.errors?.subject}
            className="sm:col-span-2"
            hint="Wird beim Auswählen der Vorlage in die Kampagne übernommen."
          >
            <Input
              id="subject"
              name="subject"
              defaultValue={values.subject}
              required
            />
          </Field>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="isHtml"
            checked={isHtml}
            onChange={(e) => setIsHtml(e.target.checked)}
            className="size-4 rounded border-slate-300"
          />
          HTML-Vorlage (sonst wird der Text als reiner Text behandelt)
        </label>
      </Card>

      <Card
        title="Inhalt"
        description="Verwendbare Platzhalter stehen rechts. {{content}} markiert die Stelle, an der der Kampagnentext eingefügt wird."
      >
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div>
            <Textarea
              name="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={22}
              required
              spellCheck={false}
              className="font-mono text-xs"
            />
            {/* Die Grenze sichtbar machen: eingebettete Bilder fressen sie
                schnell auf, und ohne Anzeige merkt man das erst beim
                Speichern. */}
            <p
              className={
                body.length > MAX_BODY_LENGTH
                  ? "mt-1 text-xs text-red-600"
                  : "mt-1 text-xs text-slate-500"
              }
            >
              {describeBodyLength(body.length)}
            </p>
            {state.errors?.body ? (
              <p className="mt-1 text-xs text-red-600">{state.errors.body}</p>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="rounded-md border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Platzhalter
              </p>
              <ul className="space-y-1.5 text-xs">
                {PLACEHOLDERS.map((placeholder) => (
                  <li key={placeholder.key}>
                    <button
                      type="button"
                      onClick={() => setBody((v) => `${v}{{${placeholder.key}}}`)}
                      className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-brand-700 hover:bg-slate-200"
                    >
                      {`{{${placeholder.key}}}`}
                    </button>
                    <span className="ml-1 text-slate-500">
                      {placeholder.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {check.unknown.length > 0 ? (
              <Alert variant="warning" title="Unbekannte Platzhalter">
                {check.unknown.map((key) => `{{${key}}}`).join(", ")} wird nicht
                ersetzt und erscheint so in der Mail.
              </Alert>
            ) : null}

            {isHtml && !check.hasContent ? (
              <Alert variant="warning" title="Kein {{content}} vorhanden">
                Der Kampagnentext wird unten angehängt statt eingebettet.
              </Alert>
            ) : null}

            {!check.hasUnsubscribe ? (
              <Alert variant="info" title="Kein Abmeldelink">
                Er wird beim Versand automatisch unten angefügt. Mit{" "}
                <code>{"{{abmeldelink}}"}</code> platzieren Sie ihn selbst.
              </Alert>
            ) : null}

            {/* Was im Browser gut aussieht, muss in einem Mailprogramm noch
                lange nicht ankommen. Diese Prüfung nennt die bekannten
                Stolperstellen, solange sich die Vorlage noch ändern lässt. */}
            {befunde.map((befund, index) => (
              <Alert
                key={index}
                variant={befund.schwere === "fehler" ? "error" : "warning"}
                title={befund.titel}
              >
                {befund.text}
              </Alert>
            ))}

            {befunde.length === 0 ? (
              <Alert variant="success" title="Für Mailprogramme geeignet">
                Keine der bekannten Stolperstellen gefunden — Größe, Bilder,
                Gestaltung.
              </Alert>
            ) : null}
          </div>
        </div>
      </Card>

      <Card
        title="Vorschau"
        description={
          beispielName
            ? `Gefüllt mit den Daten von ${beispielName}.`
            : "Mit erfundenen Daten gefüllt — es gibt noch keinen Kunden."
        }
        footer={
          <div className="flex gap-2">
            {(["aus", "desktop", "mobil"] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                variant={preview === mode ? "primary" : "secondary"}
                onClick={() => setPreview(mode)}
              >
                {mode === "aus" ? "Aus" : mode === "desktop" ? "Desktop" : "Mobil"}
              </Button>
            ))}
          </div>
        }
      >
        {preview === "aus" ? (
          <p className="text-sm text-slate-500">
            Vorschau ist ausgeschaltet.
          </p>
        ) : (
          <div className="flex justify-center overflow-x-auto bg-slate-100 p-4">
            <iframe
              title="Vorschau"
              sandbox=""
              srcDoc={previewHtml}
              className="h-[520px] border border-slate-300 bg-white"
              style={{ width: preview === "mobil" ? 390 : 700 }}
            />
          </div>
        )}
      </Card>

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Speichern…" : "Speichern"}
        </Button>
        <a href={cancelHref} className="btn btn-secondary">
          Abbrechen
        </a>
      </div>
    </ActionForm>
  );
}
