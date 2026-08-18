import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Ein Filterstand ist vollstaendig durch die URL beschrieben. Damit ist jede
 * Ansicht teilbar, per Lesezeichen wiederherstellbar und laesst sich unveraendert
 * als Segment speichern.
 *
 * Anders als im Altsystem schliessen sich Stichwort und Zeitraum nicht mehr aus —
 * alle Kriterien werden mit UND verknuepft.
 */
export const customerFilterSchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  from: z.string().optional().default(""),
  to: z.string().optional().default(""),
  productId: z.string().optional().default(""),
  /** Warengruppe des gekauften Produkts. */
  categoryId: z.string().optional().default(""),
  /** Einschulungsjahrgang des Kaufs, etwa "2021". */
  season: z.string().trim().max(4).optional().default(""),
  city: z.string().trim().max(100).optional().default(""),
  zip: z.string().trim().max(10).optional().default(""),
  /** "yes" nur Abgemeldete, "no" nur Kontaktierbare, "" egal. */
  unsubscribed: z.enum(["", "yes", "no"]).optional().default(""),
  /** "yes" nur mit E-Mail, "no" nur ohne. */
  hasEmail: z.enum(["", "yes", "no"]).optional().default(""),
  includeDeleted: z.enum(["", "1"]).optional().default(""),
});

export type CustomerFilter = z.infer<typeof customerFilterSchema>;

export const emptyFilter: CustomerFilter = customerFilterSchema.parse({});

export function parseFilter(
  params: Record<string, string | string[] | undefined>,
): CustomerFilter {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") flat[key] = value;
    else if (Array.isArray(value) && value[0]) flat[key] = value[0];
  }
  const parsed = customerFilterSchema.safeParse(flat);
  return parsed.success ? parsed.data : emptyFilter;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Uebersetzt den Filter in eine Prisma-Bedingung. */
export function buildWhere(filter: CustomerFilter): Prisma.CustomerWhereInput {
  const and: Prisma.CustomerWhereInput[] = [];

  if (filter.includeDeleted !== "1") {
    and.push({ deletedAt: null });
  }

  if (filter.q) {
    const q = filter.q;
    and.push({
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { street: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { zip: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { notes: { contains: q, mode: "insensitive" } },
        {
          purchases: {
            some: {
              product: { name: { contains: q, mode: "insensitive" } },
            },
          },
        },
      ],
    });
  }

  const from = parseDate(filter.from);
  const to = parseDate(filter.to);
  const season = Number(filter.season);
  const hasSeason = filter.season !== "" && Number.isInteger(season);

  if (from || to || filter.productId || filter.categoryId || hasSeason) {
    // Zeitraum, Produkt, Warengruppe und Saison muessen auf denselben Kauf
    // zutreffen, nicht auf zwei verschiedene.
    const purchase: Prisma.PurchaseWhereInput = {};
    if (filter.productId) purchase.productId = filter.productId;
    if (filter.categoryId) purchase.product = { categoryId: filter.categoryId };
    if (hasSeason) purchase.season = season;
    if (from || to) {
      purchase.purchasedAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
    and.push({ purchases: { some: purchase } });
  }

  if (filter.city) {
    and.push({ city: { contains: filter.city, mode: "insensitive" } });
  }
  if (filter.zip) {
    and.push({ zip: { startsWith: filter.zip } });
  }
  if (filter.unsubscribed === "yes") {
    and.push({ unsubscribedAt: { not: null } });
  } else if (filter.unsubscribed === "no") {
    and.push({ unsubscribedAt: null });
  }
  if (filter.hasEmail === "yes") {
    and.push({ email: { not: null } });
  } else if (filter.hasEmail === "no") {
    and.push({ email: null });
  }

  return and.length > 0 ? { AND: and } : {};
}

export function filterToSearchParams(filter: CustomerFilter): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value) params.set(key, String(value));
  }
  return params;
}

export function isEmptyFilter(filter: CustomerFilter): boolean {
  return Object.values(filter).every((v) => !v);
}

export function describeFilter(
  filter: CustomerFilter,
  productName?: string,
  categoryName?: string,
): string {
  const parts: string[] = [];
  if (filter.q) parts.push(`Stichwort "${filter.q}"`);
  if (filter.productId) parts.push(`Produkt ${productName ?? filter.productId}`);
  if (filter.categoryId)
    parts.push(`Warengruppe ${categoryName ?? filter.categoryId}`);
  if (filter.season) parts.push(`Saison ${filter.season}`);
  if (filter.from) parts.push(`ab ${filter.from}`);
  if (filter.to) parts.push(`bis ${filter.to}`);
  if (filter.city) parts.push(`Stadt ${filter.city}`);
  if (filter.zip) parts.push(`PLZ ${filter.zip}*`);
  if (filter.hasEmail === "yes") parts.push("mit E-Mail");
  if (filter.hasEmail === "no") parts.push("ohne E-Mail");
  if (filter.unsubscribed === "yes") parts.push("abgemeldet");
  if (filter.unsubscribed === "no") parts.push("nicht abgemeldet");
  if (filter.includeDeleted === "1") parts.push("inkl. geloeschter");
  return parts.length > 0 ? parts.join(", ") : "kein Filter";
}
