"use client";

import { useRef, useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { uploadBildAction } from "@/app/(app)/bild-actions";

/**
 * Bild auswaehlen und als `<img>` in den Text einsetzen.
 *
 * Der Umweg ueber ein eingebettetes Bild entfaellt damit ganz: die Datei
 * landet in der Ablage und im Text steht sofort die Adresse, unter der sie
 * jedes Mailprogramm laden kann. Breite und Alternativtext kommen gleich mit,
 * weil Outlook das eine und blockierte Bilder das andere brauchen.
 */
export function BildUpload({
  onInsert,
  breite = 600,
}: {
  onInsert: (html: string) => void;
  /** Voreingestellte Anzeigebreite in Pixeln. */
  breite?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function waehlen(datei: File) {
    setFehler(null);
    setMeldung(null);
    const formData = new FormData();
    formData.set("bild", datei);
    startTransition(async () => {
      const ergebnis = await uploadBildAction(formData);
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      const alt = datei.name.replace(/\.[^.]+$/, "").slice(0, 80);
      onInsert(
        `<img src="${ergebnis.url}" width="${breite}" alt="${alt.replace(/"/g, "&quot;")}" style="display:block;width:100%;max-width:${breite}px;height:auto;border:0" />`,
      );
      setMeldung(
        ergebnis.bekannt
          ? "Dieses Bild lag bereits — es wurde erneut verlinkt."
          : `Bild abgelegt (${(ergebnis.size / 1024).toFixed(0)} KB) und eingefügt.`,
      );
      if (input.current) input.current.value = "";
    });
  }

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(event) => {
          const datei = event.target.files?.[0];
          if (datei) waehlen(datei);
        }}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => input.current?.click()}
      >
        {pending ? "Bild wird abgelegt…" : "Bild einfügen"}
      </Button>
      <p className="text-xs text-slate-500">
        Die Datei wird abgelegt und als Adresse eingefügt. Eingebettete Bilder
        (<code>data:</code>) zeigt Gmail nicht an.
      </p>
      {meldung ? (
        <Alert variant="success" title="Bild eingefügt">
          {meldung}
        </Alert>
      ) : null}
      {fehler ? (
        <Alert variant="error" title="Bild nicht abgelegt">
          {fehler}
        </Alert>
      ) : null}
    </div>
  );
}
