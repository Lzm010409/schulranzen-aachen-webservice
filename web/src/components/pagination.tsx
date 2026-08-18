import { cx } from "./ui";

/**
 * Seitenweises Blaettern unter einer Tabelle.
 *
 * `paramName` trennt mehrere Tabellen auf einer Seite: die Kundenakte hat
 * Kaeufe, Mailhistorie und Aenderungen nebeneinander, und jede Tabelle blaettert
 * fuer sich, ohne die anderen zurueckzusetzen.
 *
 * Passt alles auf eine Seite, bleiben die Knoepfe weg — die Zeile mit der
 * Anzahl bleibt trotzdem stehen, damit erkennbar ist, dass nichts fehlt.
 */
export function Pagination({
  page,
  pageSize,
  total,
  params,
  paramName = "seite",
}: {
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string | string[] | undefined>;
  paramName?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  // Wer eine Seitenzahl von Hand in die Adresse schreibt, soll keine
  // unsinnige Zeile lesen ("1001–3 von 3"); die Knoepfe fuehren zurueck.
  const current = Math.min(Math.max(1, page), pages);

  function hrefFor(target: number) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === paramName) continue;
      // Mehrfach gesetzte Filter (etwa mehrere Produkte) duerfen beim
      // Blaettern nicht auf den ersten Wert zusammenfallen.
      if (Array.isArray(value)) {
        for (const entry of value) search.append(key, entry);
      } else if (typeof value === "string") {
        search.set(key, value);
      }
    }
    search.set(paramName, String(target));
    return `?${search}`;
  }

  const first = (current - 1) * pageSize + 1;
  const last = Math.min(current * pageSize, total);

  // Fenster um die aktuelle Seite, damit auch 200 Seiten bedienbar bleiben.
  const windowSize = 2;
  const numbers: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (
      i === 1 ||
      i === pages ||
      (i >= current - windowSize && i <= current + windowSize)
    ) {
      numbers.push(i);
    } else if (numbers[numbers.length - 1] !== "…") {
      numbers.push("…");
    }
  }

  return (
    <nav className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-600">
        {first.toLocaleString("de-DE")}–{last.toLocaleString("de-DE")} von{" "}
        {total.toLocaleString("de-DE")}
      </p>
      {pages <= 1 ? null : (
      <div className="flex flex-wrap items-center gap-1">
        <a
          href={hrefFor(Math.max(1, current - 1))}
          aria-disabled={current === 1}
          className={cx(
            "btn btn-secondary",
            current === 1 && "pointer-events-none opacity-50",
          )}
        >
          Zurück
        </a>
        {numbers.map((entry, index) =>
          entry === "…" ? (
            <span key={`gap-${index}`} className="px-2 text-slate-400">
              …
            </span>
          ) : (
            <a
              key={entry}
              href={hrefFor(entry)}
              className={cx(
                "btn",
                entry === current ? "btn-primary" : "btn-secondary",
              )}
            >
              {entry}
            </a>
          ),
        )}
        <a
          href={hrefFor(Math.min(pages, current + 1))}
          aria-disabled={current === pages}
          className={cx(
            "btn btn-secondary",
            current === pages && "pointer-events-none opacity-50",
          )}
        >
          Weiter
        </a>
      </div>
      )}
    </nav>
  );
}
