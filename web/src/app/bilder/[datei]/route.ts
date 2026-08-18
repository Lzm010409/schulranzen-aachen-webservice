import { db } from "@/lib/db";
import { ERLAUBTE_BILDTYPEN } from "@/lib/mail-images";

export const dynamic = "force-dynamic";

/**
 * Liefert ein Bild aus der Mailablage aus.
 *
 * Bewusst ohne Anmeldung: die Adresse steht in versendeten Mails, und das
 * Mailprogramm des Empfaengers hat keine Sitzung. Preisgegeben wird dadurch
 * nichts, was nicht ohnehin in der Mail steckt — und die ID ist eine cuid,
 * also nicht zu erraten.
 *
 * Der Dateiname traegt eine Endung (`<id>.jpg`), weil manche Mailprogramme
 * und Zwischenspeicher danach entscheiden, ob sie etwas als Bild behandeln.
 * Fuer die Suche zaehlt nur der Teil davor.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ datei: string }> },
) {
  const { datei } = await params;
  const id = datei.replace(/\.[a-z0-9]+$/i, "");

  const bild = await db.mailImage.findUnique({
    where: { id },
    select: { data: true, mimeType: true, size: true },
  });
  if (!bild || !ERLAUBTE_BILDTYPEN[bild.mimeType]) {
    return new Response("Bild nicht gefunden", { status: 404 });
  }

  return new Response(new Uint8Array(bild.data), {
    headers: {
      "Content-Type": bild.mimeType,
      "Content-Length": String(bild.size),
      // Der Inhalt aendert sich unter dieser Adresse nie — jede Aenderung
      // legt ein neues Bild an. Also darf beliebig lange zwischengespeichert
      // werden; das entlastet den Server bei grossen Aussendungen spuerbar.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
