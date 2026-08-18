import "server-only";
import { cookies } from "next/headers";
import {
  PAGE_SIZES,
  PAGE_SIZE_COOKIE,
  sizeParamFor,
  type PageSize,
} from "./pagination.shared";

/**
 * Seitengroesse — einstellbar, aber nicht beliebig.
 *
 * Der gewaehlte Wert steht in der Adresse und gilt damit fuer genau diese
 * Ansicht; geteilt oder als Lesezeichen gespeichert bleibt sie erhalten.
 * Zusaetzlich merkt sich ein Cookie die letzte Wahl und wird zur Vorgabe fuer
 * alle uebrigen Tabellen — einmal auf 100 gestellt, bleibt es dabei.
 *
 * Die Auswahl ist bewusst eine feste Liste. Ein freies Feld liesse
 * `?proSeite=999999` zu, und damit holte eine Liste mit zehntausend Kunden
 * alles auf einmal.
 */

export {
  PAGE_SIZES,
  PAGE_SIZE_COOKIE,
  sizeParamFor,
  type PageSize,
} from "./pagination.shared";

function toPageSize(value: unknown): PageSize | null {
  const numeric = Number(value);
  return (PAGE_SIZES as readonly number[]).includes(numeric)
    ? (numeric as PageSize)
    : null;
}

type Params = Record<string, string | string[] | undefined>;

function first(params: Params, key: string): string | undefined {
  const value = params[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

/**
 * Ermittelt Seite und Seitengroesse fuer eine Tabelle.
 *
 * Reihenfolge: was in der Adresse steht, sonst die gemerkte Wahl aus dem
 * Cookie, sonst die Vorgabe der Seite.
 */
export async function readPaging(
  params: Params,
  options: { pageParam?: string; fallbackSize: PageSize },
): Promise<{
  page: number;
  pageSize: PageSize;
  skip: number;
  take: number;
  pageParam: string;
}> {
  const pageParam = options.pageParam ?? "seite";

  const page = Math.max(1, Number(first(params, pageParam) ?? 1) || 1);

  const fromUrl = toPageSize(first(params, sizeParamFor(pageParam)));
  const fromCookie = fromUrl
    ? null
    : toPageSize((await cookies()).get(PAGE_SIZE_COOKIE)?.value);

  const pageSize = fromUrl ?? fromCookie ?? options.fallbackSize;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    pageParam,
  };
}
