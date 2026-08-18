"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import type { CustomerFilter } from "@/lib/customer-filter";
import { saveSegmentAction, deleteSegmentAction } from "./actions";

/**
 * Alle Kriterien wirken gleichzeitig und landen in der URL. Damit ist jede
 * Ansicht teilbar — im Altsystem schlossen sich Stichwort- und Datumssuche
 * gegenseitig aus und der Filterstand war nirgends festgehalten.
 */
export function CustomerFilterBar({
  filter,
  products,
  categories,
  seasons,
  segments,
}: {
  filter: CustomerFilter;
  products: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  /** Jahrgänge, zu denen es tatsächlich Käufe gibt. */
  seasons: number[];
  segments: { id: string; name: string; filter: Record<string, string> }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filter.q);
  const [showSave, setShowSave] = useState(false);

  // Stichwortsuche mit kurzer Verzoegerung, damit nicht jeder Tastendruck
  // eine Abfrage ausloest.
  useEffect(() => {
    if (q === filter.q) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) params.set("q", q);
      else params.delete("q");
      params.delete("seite");
      startTransition(() => router.replace(`/kunden?${params}`));
    }, 350);
    return () => clearTimeout(timer);
  }, [q, filter.q, router, searchParams]);

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("seite");
    startTransition(() => router.replace(`/kunden?${params}`));
  }

  function reset() {
    setQ("");
    startTransition(() => router.replace("/kunden"));
  }

  const activeCount = Object.values(filter).filter(Boolean).length;

  return (
    <div className="card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Field label="Stichwort" htmlFor="q" className="lg:col-span-2">
          <Input
            id="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, Adresse, Mail, Produkt…"
          />
        </Field>

        <Field label="Kauf ab" htmlFor="from">
          <Input
            id="from"
            type="date"
            defaultValue={filter.from}
            onChange={(e) => update("from", e.target.value)}
          />
        </Field>

        <Field label="Kauf bis" htmlFor="to">
          <Input
            id="to"
            type="date"
            defaultValue={filter.to}
            onChange={(e) => update("to", e.target.value)}
          />
        </Field>

        <Field label="Produkt" htmlFor="productId">
          <Select
            id="productId"
            defaultValue={filter.productId}
            onChange={(e) => update("productId", e.target.value)}
          >
            <option value="">alle</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Warengruppe" htmlFor="categoryId">
          <Select
            id="categoryId"
            defaultValue={filter.categoryId}
            onChange={(e) => update("categoryId", e.target.value)}
          >
            <option value="">alle</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Saison"
          htmlFor="season"
          hint="Einschulungsjahrgang des Kaufs"
        >
          <Select
            id="season"
            defaultValue={filter.season}
            onChange={(e) => update("season", e.target.value)}
          >
            <option value="">alle</option>
            {seasons.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Stadt" htmlFor="city">
          <Input
            id="city"
            defaultValue={filter.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder="z. B. Aachen"
          />
        </Field>

        <Field label="PLZ beginnt mit" htmlFor="zip">
          <Input
            id="zip"
            defaultValue={filter.zip}
            onChange={(e) => update("zip", e.target.value)}
            placeholder="52"
            inputMode="numeric"
          />
        </Field>

        <Field label="E-Mail" htmlFor="hasEmail">
          <Select
            id="hasEmail"
            defaultValue={filter.hasEmail}
            onChange={(e) => update("hasEmail", e.target.value)}
          >
            <option value="">egal</option>
            <option value="yes">nur mit Adresse</option>
            <option value="no">nur ohne Adresse</option>
          </Select>
        </Field>

        <Field label="Newsletter" htmlFor="unsubscribed">
          <Select
            id="unsubscribed"
            defaultValue={filter.unsubscribed}
            onChange={(e) => update("unsubscribed", e.target.value)}
          >
            <option value="">egal</option>
            <option value="no">nur Angemeldete</option>
            <option value="yes">nur Abgemeldete</option>
          </Select>
        </Field>

        <Field label="Gelöschte" htmlFor="includeDeleted">
          <Select
            id="includeDeleted"
            defaultValue={filter.includeDeleted}
            onChange={(e) => update("includeDeleted", e.target.value)}
          >
            <option value="">ausblenden</option>
            <option value="1">mit anzeigen</option>
          </Select>
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <Button type="button" onClick={reset} disabled={activeCount === 0}>
          Filter zurücksetzen
        </Button>
        <Button
          type="button"
          onClick={() => setShowSave((v) => !v)}
          disabled={activeCount === 0}
        >
          Als Segment speichern
        </Button>
        {pending ? (
          <span className="text-xs text-slate-500">wird aktualisiert…</span>
        ) : null}

        {segments.length > 0 ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Segmente:</span>
            {segments.map((segment) => (
              <span
                key={segment.id}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs"
              >
                <a
                  href={`/kunden?${new URLSearchParams(
                    Object.entries(segment.filter).filter(([, v]) => v) as [
                      string,
                      string,
                    ][],
                  )}`}
                  className="font-medium text-slate-700 hover:text-brand-700"
                >
                  {segment.name}
                </a>
                <form action={deleteSegmentAction}>
                  <input type="hidden" name="id" value={segment.id} />
                  <button
                    type="submit"
                    className="text-slate-400 hover:text-red-600"
                    aria-label={`Segment ${segment.name} löschen`}
                  >
                    ×
                  </button>
                </form>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {showSave ? (
        <form
          action={saveSegmentAction}
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3"
        >
          {Object.entries(filter).map(([key, value]) =>
            value ? (
              <input key={key} type="hidden" name={key} value={String(value)} />
            ) : null,
          )}
          <Field label="Name des Segments" htmlFor="segmentName">
            <Input
              id="segmentName"
              name="name"
              required
              placeholder="z. B. Kauf vor 2024, Raum Aachen"
            />
          </Field>
          <Button type="submit" variant="primary">
            Speichern
          </Button>
        </form>
      ) : null}
    </div>
  );
}
