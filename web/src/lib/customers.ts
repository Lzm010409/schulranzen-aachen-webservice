import "server-only";
import { db } from "./db";
import { productSlug } from "./normalize";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Legt ein Produkt an oder liefert das bestehende zurueck. Der Slug ist der
 * Duplikatschutz: im Altsystem erzeugte die Freitext-ComboBox bei jedem
 * Speichern einen neuen Datensatz, sodass dasselbe Produkt mehrfach existierte.
 */
export async function findOrCreateProduct(
  name: string,
  tx: Prisma.TransactionClient = db,
) {
  const slug = productSlug(name);
  if (!slug) throw new Error("Produktname ist leer");

  const existing = await tx.product.findUnique({ where: { slug } });
  if (existing) return existing;

  return tx.product.create({ data: { name: name.trim(), slug } });
}

/**
 * Legt eine Warengruppe an oder liefert die bestehende zurueck.
 *
 * Derselbe Duplikatschutz wie bei den Produkten: „Schulranzen“, „schulranzen“
 * und „ Schulranzen “ sind eine Warengruppe, nicht drei. Wird beim Import
 * gebraucht, damit eine Spalte „Warengruppe“ nicht bei jedem Lauf neue Eintraege
 * erzeugt.
 */
export async function findOrCreateCategory(
  name: string,
  tx: Prisma.TransactionClient = db,
) {
  const slug = productSlug(name);
  if (!slug) return null;

  const existing = await tx.productCategory.findUnique({ where: { slug } });
  if (existing) return existing;

  return tx.productCategory.create({ data: { name: name.trim(), slug } });
}

export type DuplicateHit = {
  id: string;
  firstName: string;
  lastName: string;
  zip: string;
  city: string;
  email: string | null;
  reason: "E-Mail-Adresse" | "Name und PLZ";
};

/**
 * Sucht moegliche Dubletten, bevor ein Kunde angelegt wird. Es wird nichts
 * automatisch blockiert — der Nutzer entscheidet, ob es dieselbe Person ist.
 */
export async function findDuplicates(input: {
  firstName: string;
  lastName: string;
  zip: string;
  email: string | null;
  excludeId?: string;
}): Promise<DuplicateHit[]> {
  const or: Prisma.CustomerWhereInput[] = [];
  if (input.email) {
    or.push({ email: input.email });
  }
  or.push({
    AND: [
      { firstName: { equals: input.firstName, mode: "insensitive" } },
      { lastName: { equals: input.lastName, mode: "insensitive" } },
      { zip: input.zip },
    ],
  });

  const rows = await db.customer.findMany({
    where: {
      deletedAt: null,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      OR: or,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      zip: true,
      city: true,
      email: true,
    },
    take: 5,
  });

  return rows.map((row) => ({
    ...row,
    reason:
      input.email && row.email === input.email
        ? ("E-Mail-Adresse" as const)
        : ("Name und PLZ" as const),
  }));
}

/**
 * Fuehrt zwei Produkte zusammen: alle Kaeufe wandern auf das Ziel, die Quelle
 * wird geloescht. Aufraeumwerkzeug fuer die Duplikate aus dem Altbestand.
 */
export async function mergeProducts(
  sourceId: string,
  targetId: string,
): Promise<number> {
  if (sourceId === targetId) return 0;
  return db.$transaction(async (tx) => {
    const moved = await tx.purchase.updateMany({
      where: { productId: sourceId },
      data: { productId: targetId },
    });
    await tx.product.delete({ where: { id: sourceId } });
    return moved.count;
  });
}

export const customerListSelect = {
  id: true,
  firstName: true,
  lastName: true,
  street: true,
  zip: true,
  city: true,
  email: true,
  phone: true,
  unsubscribedAt: true,
  bouncedAt: true,
  deletedAt: true,
  purchases: {
    orderBy: [{ purchasedAt: "desc" as const }, { createdAt: "desc" as const }],
    select: {
      id: true,
      purchasedAt: true,
      season: true,
      product: {
        select: {
          id: true,
          name: true,
          modelYear: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.CustomerSelect;

export type CustomerListRow = Prisma.CustomerGetPayload<{
  select: typeof customerListSelect;
}>;

/** Blockweises Lesen fuer Exporte — haelt den Speicherbedarf konstant. */
export async function* customerPages(
  where: Prisma.CustomerWhereInput,
  pageSize = 500,
): AsyncGenerator<CustomerListRow[]> {
  let cursor: string | undefined;
  for (;;) {
    const page = await db.customer.findMany({
      where,
      select: customerListSelect,
      orderBy: { id: "asc" },
      take: pageSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (page.length === 0) return;
    yield page;
    if (page.length < pageSize) return;
    cursor = page[page.length - 1].id;
  }
}
