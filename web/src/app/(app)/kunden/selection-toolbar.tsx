"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

/**
 * Mehrfachauswahl per Checkbox. Ersetzt das Einzelklick-Sammeln in eine zweite
 * Tabelle: der Nutzer kann alle Treffer eines Filters in einem Zug uebernehmen,
 * statt sie einzeln anzuklicken.
 */
export function SelectionToolbar({
  total,
  filterQuery,
  ids,
  children,
}: {
  total: number;
  filterQuery: string;
  ids: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [useWholeFilter, setUseWholeFilter] = useState(false);

  // Auf Änderungen der Checkboxen hören, statt jede Zeile zu einer
  // Client-Komponente zu machen.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    function onChange() {
      const boxes = node!.querySelectorAll<HTMLInputElement>(
        'input[name="selected"]:checked',
      );
      setSelected([...boxes].map((b) => b.value));
      setUseWholeFilter(false);
    }
    node.addEventListener("change", onChange);
    return () => node.removeEventListener("change", onChange);
  }, []);

  function setAllOnPage(checked: boolean) {
    const node = containerRef.current;
    if (!node) return;
    const boxes = node.querySelectorAll<HTMLInputElement>(
      'input[name="selected"]',
    );
    boxes.forEach((box) => {
      box.checked = checked;
    });
    setSelected(checked ? ids : []);
    setUseWholeFilter(false);
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
  const allOnPageSelected = ids.length > 0 && selected.length === ids.length;

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

        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="primary"
            disabled={count === 0}
            onClick={startCampaign}
          >
            Mail an Auswahl
          </Button>
        </div>
      </div>

      {children}
    </div>
  );
}
