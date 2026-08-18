import "server-only";
import { cookies } from "next/headers";
import { FLASH_COOKIE, type Flash } from "./flash.shared";

/**
 * Zentrale Rueckmeldung nach einer Aktion.
 *
 * Jede Server Action, die etwas aendert, hinterlaesst hier eine kurze
 * Nachricht: gespeichert, geloescht, wiederhergestellt, fehlgeschlagen. Die
 * Nachricht liegt in einem kurzlebigen Cookie und wird beim naechsten
 * Seitenaufbau angezeigt und sofort weggeraeumt.
 *
 * Warum ein Cookie und nicht der Rueckgabewert der Action? Weil die meisten
 * Aktionen hier entweder umleiten oder nur `revalidatePath` aufrufen — in
 * beiden Faellen gibt es keinen Rueckgabewert, den ein Formular anzeigen
 * koennte. Ueber das Cookie erreicht die Nachricht die Oberflaeche in jedem
 * Fall, auch quer ueber eine Umleitung auf eine andere Seite.
 *
 * Feldfehler in Formularen bleiben davon unberuehrt: die gehoeren an das Feld
 * und nicht in eine Einblendung am Bildschirmrand.
 */

export { FLASH_COOKIE, type Flash, type FlashTone } from "./flash.shared";

/** Hinterlegt eine Rueckmeldung fuer den naechsten Seitenaufbau. */
export async function setFlash(flash: Flash): Promise<void> {
  const store = await cookies();
  store.set(FLASH_COOKIE, JSON.stringify(flash), {
    // Nicht httpOnly: die Einblendung raeumt das Cookie im Browser wieder weg,
    // damit dieselbe Nachricht nach einem Reload nicht erneut erscheint.
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 30,
  });
}

/** Liest die Rueckmeldung fuer die aktuelle Seite, falls es eine gibt. */
export async function readFlash(): Promise<Flash | null> {
  const raw = (await cookies()).get(FLASH_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Flash;
    if (!parsed?.text) return null;
    return {
      tone: parsed.tone ?? "info",
      text: String(parsed.text),
      detail: parsed.detail ? String(parsed.detail) : undefined,
    };
  } catch {
    // Ein unlesbares Cookie darf keine Seite zerlegen.
    return null;
  }
}

/** Kurzformen fuer die immer gleichen Faelle. */
export const flash = {
  gespeichert: (was: string, detail?: string) =>
    setFlash({ tone: "erfolg", text: `${was} gespeichert.`, detail }),
  angelegt: (was: string, detail?: string) =>
    setFlash({ tone: "erfolg", text: `${was} angelegt.`, detail }),
  geloescht: (was: string, detail?: string) =>
    setFlash({ tone: "erfolg", text: `${was} gelöscht.`, detail }),
  fehler: (text: string, detail?: string) =>
    setFlash({ tone: "fehler", text, detail }),
  hinweis: (text: string, detail?: string) =>
    setFlash({ tone: "info", text, detail }),
  warnung: (text: string, detail?: string) =>
    setFlash({ tone: "warnung", text, detail }),
};
