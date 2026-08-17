"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { mergeProducts } from "@/lib/customers";
import { productSlug } from "@/lib/normalize";
import { fieldErrors, productSchema } from "@/lib/validation";

export type ProductFormState = { errors?: Record<string, string>; message?: string };

export async function saveProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const parsed = productSchema.safeParse({
    name: formData.get("name") ?? "",
    category: formData.get("category") ?? "",
    season: formData.get("season") ?? "",
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const slug = productSlug(parsed.data.name);
  const clash = await db.product.findUnique({ where: { slug } });
  if (clash && clash.id !== id) {
    return {
      errors: {
        name: `„${clash.name}“ existiert bereits. Bitte den vorhandenen Eintrag verwenden oder beide zusammenführen.`,
      },
    };
  }

  const data = { ...parsed.data, slug };
  const product = id
    ? await db.product.update({ where: { id }, data })
    : await db.product.create({ data });

  await recordAudit({
    userId: user.id,
    entity: "Product",
    entityId: product.id,
    action: id ? "UPDATE" : "CREATE",
    diff: data,
  });

  revalidatePath("/produkte");
  return { message: id ? "Produkt aktualisiert." : "Produkt angelegt." };
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const used = await db.purchase.count({ where: { productId: id } });
  if (used > 0) {
    // Produkte mit Kaufhistorie werden nur deaktiviert, nie geloescht.
    await db.product.update({ where: { id }, data: { active: false } });
    await recordAudit({
      userId: user.id,
      entity: "Product",
      entityId: id,
      action: "UPDATE",
      diff: { active: { von: true, auf: false } },
    });
  } else {
    await db.product.delete({ where: { id } });
    await recordAudit({
      userId: user.id,
      entity: "Product",
      entityId: id,
      action: "DELETE",
    });
  }

  revalidatePath("/produkte");
}

/** Fuehrt Duplikate zusammen — das Aufraeumwerkzeug fuer den Altbestand. */
export async function mergeProductsAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const sourceId = String(formData.get("sourceId") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  if (!sourceId || !targetId || sourceId === targetId) return;

  const moved = await mergeProducts(sourceId, targetId);

  await recordAudit({
    userId: user.id,
    entity: "Product",
    entityId: targetId,
    action: "MERGE",
    diff: { quelle: sourceId, ziel: targetId, verschobeneKaeufe: moved },
  });

  revalidatePath("/produkte");
}
