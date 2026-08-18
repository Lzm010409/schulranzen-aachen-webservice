"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { findOrCreateCategory, mergeProducts } from "@/lib/customers";
import { productSlug } from "@/lib/normalize";
import { categorySchema, fieldErrors, productSchema } from "@/lib/validation";
import { flash } from "@/lib/flash";

export type ProductFormState = { errors?: Record<string, string>; message?: string };
export type CategoryFormState = { errors?: Record<string, string>; message?: string };

export async function saveProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const user = await requirePermission("produkte.verwalten");
  const id = String(formData.get("id") ?? "");

  const parsed = productSchema.safeParse({
    name: formData.get("name") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    newCategory: formData.get("newCategory") ?? "",
    modelYear: formData.get("modelYear") ?? "",
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

  // Eine frisch eingetippte Warengruppe sticht die Auswahl aus der Liste.
  const created = parsed.data.newCategory
    ? await findOrCreateCategory(parsed.data.newCategory)
    : null;

  const data = {
    name: parsed.data.name,
    slug,
    categoryId: created?.id ?? parsed.data.categoryId,
    modelYear: parsed.data.modelYear,
    active: parsed.data.active,
  };

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

// ----------------------------------------------------------- Warengruppen

/**
 * Legt eine Warengruppe an oder aendert sie.
 *
 * Umbenennen aendert den Schluessel mit, nicht den Datensatz: wer
 * „Schulranzen“ in „Schulranzen & Rucksäcke“ umbenennt, behaelt dieselbe
 * Warengruppe — die Produkte haengen an der ID und wandern mit.
 */
export async function saveCategoryAction(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const user = await requirePermission("produkte.verwalten");
  const id = String(formData.get("id") ?? "");

  const parsed = categorySchema.safeParse({
    name: formData.get("name") ?? "",
    sortOrder: formData.get("sortOrder") ?? 0,
    active: formData.get("active") === "on" || !id,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const slug = productSlug(parsed.data.name);
  if (!slug) {
    return { errors: { name: "Bitte einen Namen angeben." } };
  }

  const clash = await db.productCategory.findUnique({ where: { slug } });
  if (clash && clash.id !== id) {
    return {
      errors: {
        name: `„${clash.name}“ gibt es bereits. Bitte den vorhandenen Eintrag verwenden.`,
      },
    };
  }

  const data = { ...parsed.data, slug };
  const category = id
    ? await db.productCategory.update({ where: { id }, data })
    : await db.productCategory.create({ data });

  await recordAudit({
    userId: user.id,
    entity: "Product",
    entityId: category.id,
    action: id ? "UPDATE" : "CREATE",
    diff: { warengruppe: data.name, reihenfolge: data.sortOrder, aktiv: data.active },
  });

  if (id) await flash.gespeichert("Warengruppe", category.name);
  else await flash.angelegt("Warengruppe", category.name);

  revalidatePath("/produkte");
  return { message: "gespeichert" };
}
