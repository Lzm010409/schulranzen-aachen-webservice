"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Alert, Button, Card } from "@/components/ui";
import { meldeSeitenfehlerAction } from "./fehler-actions";

/**
 * Fehlergrenze fuer den angemeldeten Bereich.
 *
 * Zwei Aufgaben: dem Benutzer sagen, dass es nicht an ihm lag und wie er
 * weiterkommt — und den Fehler ins Anwendungsprotokoll schreiben. Ohne das
 * bliebe er nur in der Ausgabe des Containers stehen, wo ihn niemand sucht.
 */
export default function Fehlergrenze({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pfad = usePathname();

  useEffect(() => {
    void meldeSeitenfehlerAction({
      message: error.message,
      digest: error.digest,
      pfad,
    });
  }, [error, pfad]);

  return (
    <Card title="Da ist etwas schiefgegangen">
      <Alert variant="error" title="Die Seite konnte nicht aufgebaut werden">
        Der Fehler steht im Protokoll unter Einstellungen → Protokoll →
        Anwendung.
        {error.digest ? (
          <>
            {" "}
            Kennung: <code className="font-mono">{error.digest}</code>
          </>
        ) : null}
      </Alert>
      <div className="mt-4 flex gap-2">
        <Button type="button" variant="primary" onClick={reset}>
          Noch einmal versuchen
        </Button>
        <a href="/" className="btn btn-secondary">
          Zur Startseite
        </a>
      </div>
    </Card>
  );
}
