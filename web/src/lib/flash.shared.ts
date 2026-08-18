/**
 * Die Teile der Rueckmeldung, die auch der Browser kennen muss.
 *
 * `flash.ts` selbst ist serverseitig (`cookies()`); die Einblendung laeuft im
 * Browser und braucht nur den Namen des Cookies und die Form der Nachricht.
 */
export const FLASH_COOKIE = "hinweis";

export type FlashTone = "erfolg" | "fehler" | "warnung" | "info";

export type Flash = {
  tone: FlashTone;
  text: string;
  detail?: string;
};
