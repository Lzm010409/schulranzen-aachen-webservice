/**
 * Wird einmal beim Serverstart ausgefuehrt. Startet den Versand-Worker im
 * selben Prozess — dadurch braucht die Anwendung weder Redis noch einen
 * zweiten Container.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startWorker, recoverStuckJobs } = await import("@/lib/worker");

  // Nach einem Neustart koennen Jobs auf SENDING stehen, ohne dass sie
  // jemand bearbeitet — die werden zuerst wieder freigegeben.
  await recoverStuckJobs().catch((error) => {
    console.error("[start] Wiederherstellung fehlgeschlagen", error);
  });

  startWorker();
}
