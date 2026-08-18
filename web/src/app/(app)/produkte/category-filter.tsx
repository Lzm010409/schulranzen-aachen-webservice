"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";

/** Filtert den Katalog nach Warengruppe; der Stand steht in der Adresse. */
export function CategoryFilter({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("gruppe") ?? "";

  return (
    <Select
      aria-label="Warengruppe"
      value={current}
      onChange={(event) => {
        const next = new URLSearchParams(params.toString());
        if (event.target.value) next.set("gruppe", event.target.value);
        else next.delete("gruppe");
        // Beim Filtern zurück auf die erste Seite — sonst zeigt Seite 7 nichts.
        next.delete("seite");
        router.push(`/produkte?${next}`);
      }}
    >
      <option value="">Alle Warengruppen</option>
      {categories.map((entry) => (
        <option key={entry.id} value={entry.id}>
          {entry.name}
        </option>
      ))}
    </Select>
  );
}
