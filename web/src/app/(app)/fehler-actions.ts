"use server";

import { getSession } from "@/lib/auth";
import { log } from "@/lib/log";

/**
 * Nimmt einen Fehler entgegen, der beim Aufbau einer Seite aufgetreten ist.
 *
 * Next.js faengt solche Fehler in der Fehlergrenze ab und zeigt dem Benutzer
 * eine allgemeine Meldung — auf dem Server steht dann eine Kennung, sonst
 * nichts. Damit der Administrator spaeter ueberhaupt etwas sieht, meldet die
 * Grenze den Fehler hierher zurueck.
 */
export async function meldeSeitenfehlerAction(input: {
  message: string;
  digest?: string;
  pfad: string;
}): Promise<void> {
  const user = await getSession();
  await log.error({
    source: "oberflaeche",
    message: `Seite „${input.pfad}" konnte nicht aufgebaut werden: ${input.message}`,
    context: { pfad: input.pfad, kennung: input.digest ?? null },
    userId: user?.id ?? null,
  });
}
