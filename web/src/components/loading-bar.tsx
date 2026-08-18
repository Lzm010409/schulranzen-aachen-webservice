"use client";

import { useLinkStatus } from "next/link";

/**
 * Ladeanzeige innerhalb eines Navigationseintrags.
 *
 * `useLinkStatus` gilt nur unterhalb des zugehoerigen `<Link>` und meldet,
 * solange der Seitenwechsel laeuft. Damit weiss der Nutzer sofort, welcher
 * Eintrag geklickt wurde — auch wenn die neue Seite noch Daten holt.
 */
export function NavSpinner() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span className="nav-spinner" aria-hidden="true" />;
}
