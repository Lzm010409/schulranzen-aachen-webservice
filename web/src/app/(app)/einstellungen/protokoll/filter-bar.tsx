"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button, Field, Input, Select } from "@/components/ui";

export type Auswahl = { wert: string; text: string };

/**
 * Filterleiste des Protokolls.
 *
 * Alle Kriterien wirken gleichzeitig und stehen in der Adresse — damit laesst
 * sich eine Ansicht weitergeben („schau dir das an") und der Zurueck-Knopf
 * fuehrt dorthin, wo man war.
 */
export function ProtokollFilter({
  felder,
  bereich,
}: {
  felder: {
    name: string;
    label: string;
    /** Leer = Freitextfeld, sonst Auswahlliste. */
    optionen?: Auswahl[];
    typ?: "text" | "date";
    platzhalter?: string;
  }[];
  /** Wird beim Zuruecksetzen beibehalten. */
  bereich: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setzen(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    // Nach einer Filteraenderung gibt es die alte Seitenzahl meist nicht mehr.
    params.delete("seite");
    startTransition(() =>
      router.replace(`/einstellungen/protokoll?${params}`),
    );
  }

  const gesetzt = felder.filter((f) => searchParams.get(f.name));

  return (
    <div className="mb-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {felder.map((feld) => (
          <Field key={feld.name} label={feld.label} htmlFor={`f_${feld.name}`}>
            {feld.optionen ? (
              <Select
                id={`f_${feld.name}`}
                value={searchParams.get(feld.name) ?? ""}
                onChange={(e) => setzen(feld.name, e.target.value)}
              >
                {feld.optionen.map((o) => (
                  <option key={o.wert} value={o.wert}>
                    {o.text}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                id={`f_${feld.name}`}
                type={feld.typ ?? "text"}
                defaultValue={searchParams.get(feld.name) ?? ""}
                placeholder={feld.platzhalter}
                // Erst beim Verlassen des Feldes suchen: bei einem Datum ist
                // jede Zwischeneingabe unvollstaendig.
                onBlur={(e) => setzen(feld.name, e.target.value.trim())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setzen(feld.name, e.currentTarget.value.trim());
                  }
                }}
              />
            )}
          </Field>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {gesetzt.length > 0 ? (
          <Button
            type="button"
            onClick={() =>
              startTransition(() =>
                router.replace(
                  bereich
                    ? `/einstellungen/protokoll?bereich=${bereich}`
                    : "/einstellungen/protokoll",
                ),
              )
            }
          >
            Filter zurücksetzen
          </Button>
        ) : null}
        {pending ? (
          <span className="text-sm text-slate-500">wird geladen…</span>
        ) : null}
      </div>
    </div>
  );
}
