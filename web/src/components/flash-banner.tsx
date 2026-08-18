"use client";

import { useEffect, useState } from "react";
import { cx } from "./ui";
import { FLASH_COOKIE, type Flash } from "@/lib/flash.shared";

const TONE_CLASS: Record<Flash["tone"], string> = {
  erfolg: "alert-success",
  fehler: "alert-error",
  warnung: "alert-warning",
  info: "alert-info",
};

const TONE_LABEL: Record<Flash["tone"], string> = {
  erfolg: "Erledigt",
  fehler: "Fehlgeschlagen",
  warnung: "Achtung",
  info: "Hinweis",
};

/**
 * Zeigt die Rueckmeldung der letzten Aktion.
 *
 * Erfolgsmeldungen blenden sich nach ein paar Sekunden aus; Fehler bleiben
 * stehen, bis sie weggeklickt werden — wer etwas falsch gemacht hat, soll es
 * in Ruhe lesen koennen.
 */
export function FlashBanner({ flash }: { flash: Flash | null }) {
  const [sichtbar, setSichtbar] = useState(Boolean(flash));

  useEffect(() => {
    if (!flash) return;
    setSichtbar(true);

    // Das Cookie sofort wegraeumen: sonst erscheint dieselbe Meldung nach
    // einem Reload noch einmal. Serverseitig geht das nicht — Cookies lassen
    // sich waehrend des Renderns nicht setzen.
    document.cookie = `${FLASH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;

    if (flash.tone === "fehler") return;
    const timer = setTimeout(() => setSichtbar(false), 6000);
    return () => clearTimeout(timer);
  }, [flash]);

  if (!flash || !sichtbar) return null;

  return (
    <div className="flash-area" role="status" aria-live="polite">
      <div className={cx("alert flash", TONE_CLASS[flash.tone])}>
        <div>
          <span className="alert-title">{TONE_LABEL[flash.tone]}</span>{" "}
          <span>{flash.text}</span>
          {flash.detail ? (
            <span className="flash-detail">{flash.detail}</span>
          ) : null}
        </div>
        <button
          type="button"
          className="flash-close"
          onClick={() => setSichtbar(false)}
          aria-label="Meldung schließen"
        >
          ×
        </button>
      </div>
    </div>
  );
}
