/**
 * Zeigt das `diff` eines Protokolleintrags lesbar an.
 *
 * Vorher stand dort eine abgeschnittene JSON-Zeile — technisch vollstaendig
 * und praktisch unlesbar. Die haeufigste Form ist `{ feld: { von, auf } }`;
 * alles andere wird flach als „Schluessel: Wert" gezeigt.
 */

function alsText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function istVonAuf(value: unknown): value is { von: unknown; auf: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "von" in value &&
    "auf" in value
  );
}

export function DiffAnzeige({ diff }: { diff: unknown }) {
  if (diff === null || diff === undefined) {
    return <span className="text-slate-400">—</span>;
  }
  if (typeof diff !== "object") {
    return <span className="text-slate-600">{alsText(diff)}</span>;
  }

  const eintraege = Object.entries(diff as Record<string, unknown>);
  if (eintraege.length === 0) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <dl className="space-y-0.5 text-xs">
      {eintraege.map(([feld, wert]) => (
        <div key={feld} className="flex flex-wrap gap-x-1.5">
          <dt className="font-medium text-slate-600">{feld}</dt>
          <dd className="text-slate-500">
            {istVonAuf(wert) ? (
              <>
                <span className="line-through">{alsText(wert.von)}</span>
                <span aria-hidden> → </span>
                <span className="text-slate-700">{alsText(wert.auf)}</span>
              </>
            ) : (
              alsText(wert)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
