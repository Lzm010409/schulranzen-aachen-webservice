import { cx } from "./ui";

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
  if (pages <= 1) return null;

  function hrefFor(target: number) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && key !== paramName) search.set(key, value);
    }
    search.set(paramName, String(target));
    return `?${search}`;
  }

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  // Fenster um die aktuelle Seite, damit auch 200 Seiten bedienbar bleiben.
  const windowSize = 2;
  const numbers: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (
      i === 1 ||
      i === pages ||
      (i >= page - windowSize && i <= page + windowSize)
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
      <div className="flex flex-wrap items-center gap-1">
        <a
          href={hrefFor(Math.max(1, page - 1))}
          aria-disabled={page === 1}
          className={cx(
            "btn btn-secondary",
            page === 1 && "pointer-events-none opacity-50",
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
                entry === page ? "btn-primary" : "btn-secondary",
              )}
            >
              {entry}
            </a>
          ),
        )}
        <a
          href={hrefFor(Math.min(pages, page + 1))}
          aria-disabled={page === pages}
          className={cx(
            "btn btn-secondary",
            page === pages && "pointer-events-none opacity-50",
          )}
        >
          Weiter
        </a>
      </div>
    </nav>
  );
}
