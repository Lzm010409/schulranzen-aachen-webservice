/**
 * Ladeanzeige beim Seitenwechsel.
 *
 * Alle Seiten des angemeldeten Bereichs holen ihre Daten beim Aufruf
 * (`force-dynamic`). Ohne diese Datei bliebe waehrenddessen die alte Ansicht
 * stehen und nichts deutete darauf hin, dass etwas passiert.
 */
export default function Loading() {
  return (
    <div className="loading-banner" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span>Wird geladen…</span>
    </div>
  );
}
