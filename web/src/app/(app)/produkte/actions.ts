"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { mergeProducts } from "@/lib/customers";
import { productSlug } from "@/lib/normalize";
import { fieldErrors, productSchema } from "@/lib/validation";
import { flash } from "@/lib/flash";

export type ProductFormState = { errors?: Record<string, string>; message?: string };

export async function saveProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const user = await requirePermission("produkte.verwalten");
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

  if (id) await flash.gespeichert("Produkt", product.name);
  else await flash.angelegt("Produkt", product.name);

  revalidatePath("/produkte");
  return { message: id ? "Produkt aktualisiert." : "Produkt angelegt." };
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const user = await requirePermission("produkte.verwalten");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const used = await db.purchase.count({ where: { productId: id } });
  if (used > 0) {
    // Produkte mit Kaufhistorie werden nur deaktiviert, nie geloescht.
    const product = await db.product.update({
      where: { id },
      data: { active: false },
    });
    await recordAudit({
      userId: user.id,
      entity: "Product",
      entityId: id,
      action: "UPDATE",
      diff: { active: { von: true, auf: false } },
    });
    await flash.hinweis(
      `„${product.name}“ deaktiviert.`,
      `${used} Käufe hängen daran — deshalb bleibt der Eintrag erhalten.`,
    );
  } else {
    const product = await db.product.delete({ where: { id } });
    await recordAudit({
      userId: user.id,
      entity: "Product",
      entityId: id,
      action: "DELETE",
    });
    await flash.geloescht("Produkt", product.name);
  }

  revalidatePath("/produkte");
}

/** Fuehrt Duplikate zusammen — das Aufraeumwerkzeug fuer den Altbestand. */
export async function mergeProductsAction(formData: FormData): Promise<void> {
  const user = await requirePermission("produkte.verwalten");
  const sourceId = String(formData.get("sourceId") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  if (!sourceId || !targetId || sourceId === targetId) {
    await flash.fehler("Bitte zwei verschiedene Produkte auswählen.");
    revalidatePath("/produkte");
    return;
  }

  const target = await db.product.findUnique({ where: { id: targetId } });
  const moved = await mergeProducts(sourceId, targetId);

  await recordAudit({
    userId: user.id,
    entity: "Product",
    entityId: targetId,
    action: "MERGE",
    diff: { quelle: sourceId, ziel: targetId, verschobeneKaeufe: moved },
  });

  await flash.hinweis(
    "Produkte zusammengeführt.",
    `${moved} Käufe gehören jetzt zu „${target?.name ?? "dem Ziel"}“.`,
  );
  revalidatePath("/produkte");
}
