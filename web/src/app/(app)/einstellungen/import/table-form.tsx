"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { IMPORT_FIELDS } from "@/lib/import/table";
import { tableImportAction, type TableState } from "./actions";

/**
 * Zweistufig: erst Vorschau, dann Import. Die Datei bleibt dabei im
 * Dateifeld — sie wird beim zweiten Absenden erneut mitgeschickt, damit auf
 * dem Server nichts zwischengelagert werden muss.
 */
export function TableImportForm() {
  const [state, formAction, isPending] = useActionState<TableState, FormData>(
    tableImportAction,
    {},
  );

  const headers = state.headers ?? [];
  const preview = state.preview;

  return (
    <Card
      title="Kunden aus CSV oder Excel importieren"
      description="Eine Zeile beschreibt einen Kunden und optional einen Kauf. Mehrere Zeilen derselben Person werden zu einem Kunden mit mehreren Käufen zusammengefasst."
    >
      <ActionForm action={formAction} className="dialog-body" style={{ padding: 0 }}>
        <Field
          label="Datei"
          htmlFor="datei"
          hint="CSV (Semikolon, Komma oder Tabulator, mit oder ohne BOM) oder Excel (.xlsx). Die erste Zeile muss die Spaltenüberschriften enthalten."
        >
          <Input
            id="datei"
            name="datei"
            type="file"
            accept=".csv,.txt,.xlsx,.xlsm"
            required
          />
        </Field>

        {state.error ? <Alert variant="error">{state.error}</Alert> : null}
        {state.message ? (
          <Alert variant="success" title="Import abgeschlossen">
            {state.message}
            {state.outcome && state.outcome.createdProducts > 0
              ? ` ${state.outcome.createdProducts} Produkte wurden neu angelegt.`
              : ""}
          </Alert>
        ) : null}

        {headers.length > 0 ? (
          <fieldset className="permissions">
            <legend>Spalten zuordnen</legend>
            <p className="permission-count">
              Die Zuordnung wurde aus den Überschriften geraten. Bitte prüfen und
              bei Bedarf korrigieren.
            </p>
            <div className="form-grid" style={{ marginTop: "0.5rem" }}>
              {IMPORT_FIELDS.map((field) => (
                <Field
                  key={field.key}
                  label={field.label + (field.required ? " *" : "")}
                  htmlFor={`spalte_${field.key}`}
                >
                  <Select
                    id={`spalte_${field.key}`}
                    name={`spalte_${field.key}`}
                    defaultValue={String(state.mapping?.[field.key] ?? -1)}
                  >
                    <option value="-1">— nicht importieren —</option>
                    {headers.map((header, index) => (
                      <option key={index} value={index}>
                        {header || `Spalte ${index + 1}`}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
          </fieldset>
        ) : null}

        {preview ? (
          <>
            <Alert
              variant={preview.invalid > 0 ? "warning" : "info"}
              title="Vorschau — es wurde noch nichts geschrieben"
            >
              <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem" }}>
                <li>
                  <strong>{preview.newCustomers}</strong> Kunden werden neu
                  angelegt
                </li>
                <li>
                  <strong>{preview.updatedCustomers}</strong> bestehende Kunden
                  werden ergänzt
                </li>
                <li>
                  <strong>{preview.purchases}</strong> Käufe werden erfasst
                </li>
                {preview.newProducts.length > 0 ? (
                  <li>
                    <strong>{preview.newProducts.length}</strong> neue Produkte:{" "}
                    {preview.newProducts.slice(0, 8).join(", ")}
                    {preview.newProducts.length > 8 ? " …" : ""}
                  </li>
                ) : null}
                {preview.invalid > 0 ? (
                  <li>
                    <strong>{preview.invalid}</strong> Zeilen werden ausgelassen
                  </li>
                ) : null}
              </ul>
            </Alert>

            {preview.issues.length > 0 ? (
              <details>
                <summary style={{ cursor: "pointer", fontWeight: 500 }}>
                  {preview.issues.length} Auffälligkeiten anzeigen
                </summary>
                <Table>
                  <thead>
                    <tr>
                      <Th>Zeile</Th>
                      <Th>Feld</Th>
                      <Th>Hinweis</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.issues.slice(0, 100).map((issue, index) => (
                      <tr key={index}>
                        <Td>{issue.row}</Td>
                        <Td className="muted">{issue.field ?? "—"}</Td>
                        <Td
                          className={
                            issue.severity === "fehler" ? "" : "muted"
                          }
                        >
                          {issue.message}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </details>
            ) : null}

            {preview.sample.length > 0 ? (
              <details open>
                <summary style={{ cursor: "pointer", fontWeight: 500 }}>
                  Die ersten {preview.sample.length} Zeilen so, wie sie
                  gespeichert würden
                </summary>
                <Table>
                  <thead>
                    <tr>
                      <Th>Zeile</Th>
                      <Th>Name</Th>
                      <Th>Adresse</Th>
                      <Th>E-Mail</Th>
                      <Th>Telefon</Th>
                      <Th>Produkt</Th>
                      <Th>Kaufdatum</Th>
                      <Th>Zuordnung</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((row) => (
                      <tr key={row.row}>
                        <Td>{row.row}</Td>
                        <Td>
                          {row.lastName}, {row.firstName}
                        </Td>
                        <Td className="muted">
                          {row.street}, {row.zip} {row.city}
                        </Td>
                        <Td className="muted">{row.email ?? "—"}</Td>
                        <Td className="muted">{row.phone ?? "—"}</Td>
                        <Td className="muted">{row.product ?? "—"}</Td>
                        <Td className="muted">
                          {row.purchasedAt
                            ? new Date(row.purchasedAt).toLocaleDateString(
                                "de-DE",
                              )
                            : "—"}
                        </Td>
                        <Td className="muted">
                          {row.matchesCustomerId ? "vorhanden" : "neu"}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </details>
            ) : null}
          </>
        ) : null}

        <div className="toolbar">
          <Button
            type="submit"
            name="modus"
            value="vorschau"
            disabled={isPending}
          >
            {isPending ? "Wird gelesen…" : "Datei einlesen und prüfen"}
          </Button>
          <Button
            type="submit"
            name="modus"
            value="import"
            variant="primary"
            disabled={isPending || !preview}
            title={
              preview ? undefined : "Bitte zuerst die Datei einlesen und prüfen"
            }
          >
            Import ausführen
          </Button>
        </div>
      </ActionForm>
    </Card>
  );
}
