"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { legacyImportAction, type LegacyState } from "./actions";

export function LegacyImportForm() {
  const [state, formAction, isPending] = useActionState<LegacyState, FormData>(
    legacyImportAction,
    {},
  );
  const [quelle, setQuelle] = useState<"dump" | "direkt">("dump");

  return (
    <Card
      title="Übernahme aus dem Altsystem"
      description="Liest Kunden, Produkte, Provider und Vorlagen aus der Vaadin-Anwendung. Der Lauf ist wiederholbar — bereits übernommene Datensätze werden aktualisiert, nicht verdoppelt."
    >
      <ActionForm action={formAction} className="dialog-body" style={{ padding: 0 }}>
        <Alert variant="info" title="Was dabei passiert">
          Im Altsystem war jeder Datensatz <em>ein Kunde mit genau einem
          Produkt</em>. Wer zweimal gekauft hat, stand zweimal in der Tabelle.
          Beim Import wird daraus <strong>ein Kunde mit mehreren Käufen</strong>:
          Zeilen mit gleicher E-Mail — oder gleichem Namen an gleicher Adresse —
          werden zusammengeführt, und jede Altzeile wird zu einem Kauf mit ihrem
          eigenen Produkt und Kaufdatum. Der Bericht listet jede
          Zusammenführung einzeln auf.
        </Alert>

        <Field label="Quelle" htmlFor="quelle">
          <Select
            id="quelle"
            name="quelle"
            value={quelle}
            onChange={(event) =>
              setQuelle(event.target.value as "dump" | "direkt")
            }
          >
            <option value="dump">Dump-Datei hochladen (empfohlen)</option>
            <option value="direkt">Direkt aus der alten Datenbank lesen</option>
          </Select>
        </Field>

        {quelle === "dump" ? (
          <Field
            label="Dump-Datei"
            htmlFor="dump"
            hint="Erzeugt mit: pg_dump -Fc --data-only --schema=public -t kunde -t product -t provider -t mail_template … (auch reines SQL wird gelesen, bis 50 MB)"
          >
            <Input id="dump" name="dump" type="file" accept=".dump,.sql,.backup" />
          </Field>
        ) : (
          <>
            <Field
              label="Verbindung zur alten Datenbank"
              htmlFor="connectionString"
              hint="Ein Lesezugriff genügt. Die Angabe wird nicht gespeichert."
            >
              <Input
                id="connectionString"
                name="connectionString"
                placeholder="postgresql://benutzer:passwort@host:5432/datenbank"
                autoComplete="off"
              />
            </Field>
            <Field label="Schema" htmlFor="schema">
              <Input id="schema" name="schema" defaultValue="public" />
            </Field>
          </>
        )}

        {state.error ? <Alert variant="error">{state.error}</Alert> : null}

        {state.stats ? (
          <Alert
            variant={state.dryRun ? "warning" : "success"}
            title={
              state.dryRun
                ? "Trockenlauf — es wurde nichts geschrieben"
                : "Übernahme abgeschlossen"
            }
          >
            <table className="grid" style={{ marginTop: "0.5rem" }}>
              <tbody>
                <tr>
                  <td>Zeilen im Altsystem</td>
                  <td>{state.stats.legacyKunden}</td>
                </tr>
                <tr>
                  <td>Daraus Kunden</td>
                  <td>{state.stats.customers}</td>
                </tr>
                <tr>
                  <td>Daraus Käufe</td>
                  <td>{state.stats.purchases}</td>
                </tr>
                <tr>
                  <td>Produkte</td>
                  <td>{state.stats.products}</td>
                </tr>
                <tr>
                  <td>Zusammengeführte Kunden</td>
                  <td>{state.stats.mergedCustomers}</td>
                </tr>
                <tr>
                  <td>Zusammengeführte Produkte</td>
                  <td>{state.stats.mergedProducts}</td>
                </tr>
              </tbody>
            </table>
          </Alert>
        ) : null}

        {state.report ? (
          <details>
            <summary style={{ cursor: "pointer", fontWeight: 500 }}>
              Vollständigen Bericht anzeigen
            </summary>
            <pre
              style={{
                maxHeight: "24rem",
                overflow: "auto",
                marginTop: "0.5rem",
                padding: "var(--lumo-space-s)",
                background: "var(--lumo-contrast-5pct)",
                borderRadius: "var(--lumo-border-radius-m)",
                fontSize: "var(--lumo-font-size-xs)",
                whiteSpace: "pre-wrap",
              }}
            >
              {state.report}
            </pre>
          </details>
        ) : null}

        <div className="toolbar">
          <Button
            type="submit"
            name="modus"
            value="trocken"
            disabled={isPending}
          >
            {isPending ? "Läuft…" : "Trockenlauf"}
          </Button>
          <Button
            type="submit"
            name="modus"
            value="import"
            variant="primary"
            disabled={isPending}
          >
            Übernahme ausführen
          </Button>
        </div>
      </ActionForm>
    </Card>
  );
}
