"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  PAGE_SIZES,
  PAGE_SIZE_COOKIE,
  sizeParamFor,
} from "@/lib/pagination.shared";

/**
 * Auswahl der Seitengroesse unter einer Tabelle.
 *
 * Die Wahl landet in der Adresse — damit gilt sie fuer genau diese Ansicht und
 * bleibt beim Teilen erhalten. Zusaetzlich wird sie in einem Cookie vermerkt
 * und dient allen anderen Tabellen als Vorgabe; wer einmal auf 100 stellt,
 * bekommt sie ueberall.
 */
export function PageSizeSelect({
  pageSize,
  pageParam,
}: {
  pageSize: number;
  pageParam: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <label className="page-size">
      <span>Zeilen</span>
      <select
        className="field-control page-size-select"
        value={pageSize}
        aria-label="Zeilen je Seite"
        onChange={(event) => {
          const wert = event.target.value;

          // Merken, damit die Wahl auch fuer die naechste Tabelle gilt.
          document.cookie = `${PAGE_SIZE_COOKIE}=${wert}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

          const next = new URLSearchParams(params.toString());
          next.set(sizeParamFor(pageParam), wert);
          // Zurueck auf die erste Seite: bei 200 Zeilen je Seite gibt es
          // Seite 7 womoeglich gar nicht mehr.
          next.delete(pageParam);
          router.push(`?${next}`);
        }}
      >
        {PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  );
}
