import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Bilder aus Mails auslagern.
 *
 * Wer ein Bild in eine Vorlage einfuegt, hat es meistens als `data:`-URI
 * dabei — so kommt es aus Word, aus dem Zwischenspeicher oder aus einem
 * Baukasten. In einer Mail ist das die schlechteste aller Moeglichkeiten:
 *
 *  - Gmail zeigt `data:`-Bilder ueberhaupt nicht an; an der Stelle bleibt
 *    ein leerer Kasten.
 *  - Base64 blaeht die Datei um ein Drittel auf. Ab etwa 102 KB schneidet
 *    Gmail die ganze Nachricht ab — samt Abmeldelink.
 *
 * Deshalb nimmt diese Datei die Bilder aus dem HTML heraus, legt die Bytes
 * in der Datenbank ab und setzt an ihre Stelle eine gewoehnliche Adresse.
 * Der Bearbeiter merkt davon nichts, ausser dass die Vorlage danach klein
 * ist und die Mail beim Empfaenger ankommt.
 */

/** Was ein Mailprogramm zuverlaessig darstellt. */
export const ERLAUBTE_BILDTYPEN: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** Obergrenze je Bild. Darueber wird die Mail unzumutbar gross. */
export const MAX_BILD_BYTES = 4 * 1024 * 1024;

/** Verweise auf Bilder in `src="data:image/...;base64,...">`. */
const DATA_BILD = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(data:image\/([a-z+]+);base64,([^"']+))\2/gi;

export function bildPfad(id: string, mimeType: string): string {
  const endung = ERLAUBTE_BILDTYPEN[mimeType.toLowerCase()] ?? "bin";
  return `/bilder/${id}.${endung}`;
}

/**
 * Vollstaendige Adresse. In der Mail muss sie absolut sein — ein relativer
 * Pfad zeigt im Mailprogramm ins Leere.
 */
export function bildUrl(id: string, mimeType: string): string {
  return `${env().APP_URL.replace(/\/$/, "")}${bildPfad(id, mimeType)}`;
}

export type AblageErgebnis = {
  id: string;
  mimeType: string;
  size: number;
  url: string;
  /** Wahr, wenn dasselbe Bild schon lag und nicht erneut gespeichert wurde. */
  bekannt: boolean;
};

/** Legt Bytes ab — oder gibt das bereits vorhandene Bild zurueck. */
export async function speichereBild(
  data: Buffer,
  mimeType: string,
  options: { filename?: string; userId?: string } = {},
): Promise<AblageErgebnis> {
  const typ = mimeType.toLowerCase();
  if (!ERLAUBTE_BILDTYPEN[typ]) {
    throw new Error(
      `Bildformat ${mimeType} wird nicht unterstützt. Möglich sind JPEG, PNG, GIF und WebP.`,
    );
  }
  if (data.byteLength > MAX_BILD_BYTES) {
    throw new Error(
      `Das Bild ist ${(data.byteLength / 1024 / 1024).toFixed(1)} MB groß. Erlaubt sind ${MAX_BILD_BYTES / 1024 / 1024} MB.`,
    );
  }

  const sha256 = createHash("sha256").update(data).digest("hex");
  const vorhanden = await db.mailImage.findUnique({
    where: { sha256 },
    select: { id: true, mimeType: true, size: true },
  });
  if (vorhanden) {
    return { ...vorhanden, url: bildUrl(vorhanden.id, vorhanden.mimeType), bekannt: true };
  }

  const angelegt = await db.mailImage.create({
    data: {
      sha256,
      mimeType: typ,
      data,
      size: data.byteLength,
      filename: options.filename?.slice(0, 200),
      createdById: options.userId,
    },
    select: { id: true, mimeType: true, size: true },
  });
  return { ...angelegt, url: bildUrl(angelegt.id, angelegt.mimeType), bekannt: false };
}

export type AuslagerungsErgebnis = {
  html: string;
  /** Wie viele Bilder ersetzt wurden. */
  ausgelagert: number;
  /** Wie viele Zeichen die Vorlage dadurch kuerzer wurde. */
  gespart: number;
  /** Bilder, die liegen bleiben mussten, mit Begruendung. */
  probleme: string[];
};

/**
 * Ersetzt alle eingebetteten Bilder eines HTML-Textes durch Verweise.
 *
 * Was nicht abgelegt werden kann (unbekanntes Format, zu gross), bleibt
 * unveraendert stehen und wird gemeldet — lieber eine Vorlage, die noch das
 * alte Verhalten zeigt, als eine, aus der ein Bild klaglos verschwindet.
 */
export async function lagereBilderAus(
  html: string,
  options: { userId?: string } = {},
): Promise<AuslagerungsErgebnis> {
  const treffer = [...html.matchAll(DATA_BILD)];
  if (treffer.length === 0) {
    return { html, ausgelagert: 0, gespart: 0, probleme: [] };
  }

  const probleme: string[] = [];
  // Nacheinander: mehrere gleiche Bilder in einer Vorlage wuerden sich sonst
  // gegenseitig ueberholen und denselben Datensatz doppelt anlegen wollen.
  const ersatz = new Map<string, string>();
  for (const [, , , datenUri, format, base64] of treffer) {
    if (ersatz.has(datenUri)) continue;
    const mimeType = `image/${format.toLowerCase()}`;
    try {
      const bytes = Buffer.from(base64.replace(/\s+/g, ""), "base64");
      if (bytes.byteLength === 0) throw new Error("Das Bild ist leer.");
      const abgelegt = await speichereBild(bytes, mimeType, options);
      ersatz.set(datenUri, abgelegt.url);
    } catch (error) {
      probleme.push(
        error instanceof Error ? error.message : "Ein Bild ließ sich nicht ablegen.",
      );
    }
  }

  const neu = html.replace(DATA_BILD, (treffer, vorspann, anfuehrung, datenUri) => {
    const url = ersatz.get(datenUri);
    return url ? `${vorspann}${anfuehrung}${url}${anfuehrung}` : treffer;
  });

  return {
    html: neu,
    ausgelagert: ersatz.size,
    gespart: html.length - neu.length,
    probleme,
  };
}

/** Reines Zaehlen, ohne Datenbank — fuer Hinweise im Editor. */
export function zaehleEingebetteteBilder(html: string): number {
  return [...html.matchAll(DATA_BILD)].length;
}
