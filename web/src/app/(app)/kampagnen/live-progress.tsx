"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type Progress = {
  PENDING: number;
  SENDING: number;
  SENT: number;
  FAILED: number;
  SKIPPED: number;
  total: number;
  done: number;
  percent: number;
  finished: boolean;
};

/**
 * Echter Fortschritt statt der Fortschrittsleiste des Altsystems, die zwar
 * eingeblendet, aber nie hochgezaehlt wurde. Der Zustand kommt aus der
 * Datenbank — ein Browser-Reload verliert ihn nicht.
 */
export function LiveProgress({
  campaignId,
  initial,
  live,
}: {
  campaignId: string;
  initial: Progress;
  live: boolean;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState(initial);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(
          `/api/kampagnen/${campaignId}/fortschritt`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const next = (await response.json()) as Progress;
        if (cancelled) return;
        setProgress(next);
        // Ist der Versand durch, die Seite neu laden, damit auch die
        // Fehlerliste und der Status aktuell sind.
        if (next.finished) router.refresh();
      } catch {
        // Netzwerkfehler ignorieren, der nächste Durchlauf versucht es erneut.
      }
    }

    const timer = setInterval(poll, 3000);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [campaignId, live, router]);

  const segments = [
    { label: "zugestellt", value: progress.SENT, className: "bg-emerald-500" },
    { label: "fehlgeschlagen", value: progress.FAILED, className: "bg-red-500" },
    { label: "übersprungen", value: progress.SKIPPED, className: "bg-slate-400" },
  ];

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-2xl font-semibold tabular-nums text-slate-900">
          {progress.percent}%
        </p>
        <p className="text-sm text-slate-600">
          {progress.done.toLocaleString("de-DE")} von{" "}
          {progress.total.toLocaleString("de-DE")}
          {live && !progress.finished ? " · läuft…" : ""}
        </p>
      </div>

      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200">
        {segments.map((segment) =>
          segment.value > 0 ? (
            <div
              key={segment.label}
              className={segment.className}
              style={{
                width: `${(segment.value / Math.max(1, progress.total)) * 100}%`,
              }}
              title={`${segment.value} ${segment.label}`}
            />
          ) : null,
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Zugestellt" value={progress.SENT} tone="text-emerald-700" />
        <Stat label="Offen" value={progress.PENDING + progress.SENDING} />
        <Stat label="Fehlgeschlagen" value={progress.FAILED} tone="text-red-700" />
        <Stat label="Übersprungen" value={progress.SKIPPED} />
      </dl>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "text-slate-900",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`text-lg font-semibold tabular-nums ${tone}`}>
        {value.toLocaleString("de-DE")}
      </dd>
    </div>
  );
}
