"use client";

import { useState } from "react";
import { Button, Field, Select } from "@/components/ui";
import { mergeProductsAction } from "./actions";

export function MergeForm({
  products,
}: {
  products: { id: string; name: string; count: number }[];
}) {
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");

  if (products.length < 2) {
    return (
      <p className="text-sm text-slate-500">
        Zum Zusammenführen werden mindestens zwei Produkte benötigt.
      </p>
    );
  }

  const source = products.find((p) => p.id === sourceId);
  const target = products.find((p) => p.id === targetId);
  const valid = sourceId && targetId && sourceId !== targetId;

  return (
    <form action={mergeProductsAction} className="space-y-3">
      <Field label="Quelle (wird gelöscht)" htmlFor="sourceId">
        <Select
          id="sourceId"
          name="sourceId"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          required
        >
          <option value="">bitte wählen</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} ({product.count})
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Ziel (bleibt bestehen)" htmlFor="targetId">
        <Select
          id="targetId"
          name="targetId"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          required
        >
          <option value="">bitte wählen</option>
          {products
            .filter((p) => p.id !== sourceId)
            .map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.count})
              </option>
            ))}
        </Select>
      </Field>

      {valid && source && target ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {source.count} {source.count === 1 ? "Kauf wird" : "Käufe werden"} von
          „{source.name}“ auf „{target.name}“ übertragen. „{source.name}“ wird
          anschließend gelöscht.
        </p>
      ) : null}

      <Button type="submit" variant="error" disabled={!valid}>
        Zusammenführen
      </Button>
    </form>
  );
}
