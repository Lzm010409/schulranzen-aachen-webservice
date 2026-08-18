/**
 * Die Teile der Seitengroesse, die auch der Browser kennen muss.
 *
 * `pagination.ts` selbst ist serverseitig (`cookies()`); die Auswahlliste
 * laeuft im Browser und braucht nur die erlaubten Werte, den Cookienamen und
 * die Regel, wie der Groessenparameter heisst.
 */
export const PAGE_SIZES = [10, 25, 50, 100, 200] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

export const PAGE_SIZE_COOKIE = "seitengroesse";

export function sizeParamFor(pageParam: string): string {
  return pageParam === "seite" ? "proSeite" : `${pageParam}ProSeite`;
}
