"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

/**
 * Mehrfachauswahl per Checkbox. Ersetzt das Einzelklick-Sammeln in eine zweite
 * Tabelle: der Nutzer kann alle Treffer eines Filters in einem Zug uebernehmen,
 * statt sie einzeln anzuklicken.
 *
 * Die Auswahl ueberlebt das Blaettern. Sie liegt dafuer im sessionStorage und
 * nicht im Zustand der Komponente: beim Seitenwechsel liefert der Server neue
 * Zeilen, die alten Checkboxen verschwinden aus dem DOM — wer auf Seite 1
 * zwoelf Kunden angehakt hatte, stand danach wieder bei null.
 *
 * Gebunden ist die Auswahl an den Filter. Blaettern und die Seitengroesse
 * aendern den Filter nicht und lassen sie stehen; ein anderer Filter beginnt
 * eine neue Auswahl — sonst gingen Mails an Empfaenger hinaus, die der Nutzer
 * unter einer ganz anderen Suche angehakt hatte.
 */

const SPEICHER = "kundenauswahl";

/**
 * Wieviele IDs sich sicher in eine Adresse schreiben lassen. Ein cuid ist
 * 25 Zeichen; bei 400 Stueck steht die URL bei rund 10 KB und damit im
 * Rahmen dessen, was Server und Browser verarbeiten. Darueber hinaus fuehrt
 * der Weg ueber „alle Treffer".
 */
const MAX_IDS_IN_URL = 400;

type Gespeichert = { filter: string; ids: string[]; alle: boolean };

function lesen(): Gespeichert | null {
  try {
    const roh = sessionStorage.getItem(SPEICHER);
    if (!roh) return null;
    const wert = JSON.parse(roh) as Gespeichert;
    return Array.isArray(wert?.ids) ? wert : null;
  } catch {
    // Ein unlesbarer Eintrag darf die Liste nicht lahmlegen.
    return null;
  }
}

function schreiben(wert: Gespeichert): void {
  try {
    sessionStorage.setItem(SPEICHER, JSON.stringify(wert));
  } catch {
    // Privater Modus oder voller Speicher: die Auswahl gilt dann eben nur
    // fuer diese Seite. Kein Grund, die Liste scheitern zu lassen.
  }
}
export function SelectionToolbar({
  total,
  filterQuery,
  ids,
  canCreateCampaign,
  children,
}: {
  total: number;
  filterQuery: string;
  ids: string[];
  canCreateCampaign: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [useWholeFilter, setUseWholeFilter] = useState(false);

  // Der Listener unten liest den aktuellen Stand; ohne Ref haette er den vom
  // ersten Rendern in der Hand.
  const selectedRef = useRef<string[]>([]);
  selectedRef.current = selected;

  /** Legt den neuen Stand ab und haelt ihn fest. */
  const merken = useCallback(
    (naechste: string[], alle: boolean) => {
      setSelected(naechste);
      setUseWholeFilter(alle);
      schreiben({ filter: filterQuery, ids: naechste, alle });
    },
    [filterQuery],
  );

  /** Hakt auf dieser Seite an, was in der gespeicherten Auswahl steht. */
  const haken = useCallback((auswahl: string[]) => {
    const node = containerRef.current;
    if (!node) return;
    const gesetzt = new Set(auswahl);
    node
      .querySelectorAll<HTMLInputElement>('input[name="selected"]')
      .forEach((box) => {
        box.checked = gesetzt.has(box.value);
      });
  }, []);

  // Beim Seitenwechsel liefert der Server neue Zeilen — die Haken müssen
  // wiederhergestellt werden, sonst wirkt die Auswahl verloren.
  useEffect(() => {
    const gespeichert = lesen();
    if (!gespeichert || gespeichert.filter !== filterQuery) {
      // Anderer Filter: von vorn, und den alten Stand nicht mitschleppen.
      merken([], false);
      haken([]);
      return;
    }
    setSelected(gespeichert.ids);
    setUseWholeFilter(gespeichert.alle);
    haken(gespeichert.ids);
  }, [filterQuery, ids, merken, haken]);

  // Auf Änderungen der Checkboxen hören, statt jede Zeile zu einer
  // Client-Komponente zu machen.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    function onChange(event: Event) {
      const ziel = event.target as HTMLInputElement | null;
      if (!ziel || ziel.name !== "selected") return;

      const angehakt = [
        ...node!.querySelectorAll<HTMLInputElement>(
          'input[name="selected"]:checked',
        ),
      ].map((b) => b.value);

      // Was auf anderen Seiten gewählt wurde, bleibt stehen; nur der Stand
      // dieser Seite wird ersetzt.
      const aufDieserSeite = new Set(ids);
      const andere = selectedRef.current.filter((id) => !aufDieserSeite.has(id));
      merken([...andere, ...angehakt], false);
    }
    node.addEventListener("change", onChange);
    return () => node.removeEventListener("change", onChange);
  }, [ids, merken]);

  function setAllOnPage(checked: boolean) {
    const node = containerRef.current;
    if (!node) return;
    node
      .querySelectorAll<HTMLInputElement>('input[name="selected"]')
      .forEach((box) => {
        box.checked = checked;
      });

    const aufDieserSeite = new Set(ids);
    const andere = selected.filter((id) => !aufDieserSeite.has(id));
    merken(checked ? [...andere, ...ids] : andere, false);
  }

  function auswahlAufheben() {
    haken([]);
    merken([], false);
  }

  function startCampaign() {
    const params = new URLSearchParams(filterQuery);
    if (useWholeFilter) {
      params.set("quelle", "filter");
    } else {
      params.set("quelle", "auswahl");
      params.set("ids", selected.join(","));
    }
    router.push(`/kampagnen/neu?${params}`);
  }

  const count = useWholeFilter ? total : selected.length;
  const aufDieserSeite = new Set(selected);
  const allOnPageSelected =
    ids.length > 0 && ids.every((id) => aufDieserSeite.has(id));
  const zuVieleFuerDieAdresse =
    !useWholeFilter && selected.length > MAX_IDS_IN_URL;

  return (
    <div ref={containerRef}>
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md bg-slate-50 px-3 py-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="size-4 rounded border-slate-300"
            checked={allOnPageSelected}
            onChange={(e) => setAllOnPage(e.target.checked)}
          />
          Seite auswählen
        </label>

        {allOnPageSelected && total > ids.length ? (
          <button
            type="button"
            onClick={() => setUseWholeFilter((v) => !v)}
            className="text-sm text-brand-700 underline"
          >
            {useWholeFilter
              ? "Auswahl auf diese Seite beschränken"
              : `Stattdessen alle ${total.toLocaleString("de-DE")} Treffer auswählen`}
          </button>
        ) : null}

        <span className="text-sm text-slate-600">
          {count > 0
            ? `${count.toLocaleString("de-DE")} ausgewählt`
            : "nichts ausgewählt"}
        </span>

        {count > 0 && !useWholeFilter ? (
          <button
            type="button"
            onClick={auswahlAufheben}
            className="text-sm text-slate-600 underline"
          >
            Auswahl aufheben
          </button>
        ) : null}

        {canCreateCampaign ? (
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={count === 0 || zuVieleFuerDieAdresse}
              onClick={startCampaign}
            >
              Mail an Auswahl
            </Button>
          </div>
        ) : null}
      </div>

      {zuVieleFuerDieAdresse ? (
        <div className="mb-3">
          <div className="alert alert-warning">
            <span className="alert-title">Zu viele einzeln ausgewählte Kunden</span>{" "}
            {selected.length.toLocaleString("de-DE")} Einzelauswahlen passen
            nicht mehr zuverlässig in die Adresszeile. Bitte den Filter so
            setzen, dass er die gewünschten Kunden trifft, und dann
            „alle Treffer auswählen“ verwenden.
          </div>
        </div>
      ) : null}

      {children}
    </div>
  );
}
