"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { diffOf, recordAudit } from "@/lib/audit";
import { findDuplicates, findOrCreateProduct } from "@/lib/customers";
import { customerSchema } from "@/lib/validation";
import { fieldErrors } from "@/lib/validation";
import { customerFilterSchema } from "@/lib/customer-filter";

export type CustomerFormState = {
  errors?: Record<string, string>;
  message?: string;
  duplicates?: Awaited<ReturnType<typeof findDuplicates>>;
};

function readCustomer(formData: FormData) {
  return customerSchema.safeParse({
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    street: formData.get("street") ?? "",
    zip: formData.get("zip") ?? "",
    city: formData.get("city") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

/** Liest die Kauf-Zeilen aus dem Formular (produkt/datum paarweise indiziert). */
function readPurchases(formData: FormData) {
  const names = formData.getAll("purchaseProduct").map(String);
  const dates = formData.getAll("purchaseDate").map(String);
  const ids = formData.getAll("purchaseId").map(String);

  return names
    .map((name, index) => ({
      id: ids[index] || null,
      name: name.trim(),
      date: dates[index] || "",
    }))
    .filter((row) => row.name.length > 0);
}

export async function saveCustomerAction(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const user = await requirePermission("kunden.bearbeiten");
  const id = String(formData.get("id") ?? "");
  const parsed = readCustomer(formData);

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  // Dublettenwarnung: einmal anzeigen, beim zweiten Absenden akzeptieren.
  if (formData.get("confirmDuplicate") !== "1") {
    const duplicates = await findDuplicates({
      firstName: data.firstName,
      lastName: data.lastName,
      zip: data.zip,
      email: data.email,
      excludeId: id || undefined,
    });
    if (duplicates.length > 0) {
      return {
        duplicates,
        message:
          "Es gibt bereits ähnliche Kunden. Bitte prüfen und erneut speichern, wenn es sich um eine andere Person handelt.",
      };
    }
  }

  const purchases = readPurchases(formData);

  const savedId = await db.$transaction(async (tx) => {
    const before = id
      ? await tx.customer.findUnique({ where: { id } })
      : null;

    const customer = id
      ? await tx.customer.update({ where: { id }, data })
      : await tx.customer.create({ data });

    // Kaeufe abgleichen: neue anlegen, entfallene entfernen, vorhandene pflegen.
    const keptIds: string[] = [];
    for (const row of purchases) {
      const product = await findOrCreateProduct(row.name, tx);
      const purchasedAt = row.date ? new Date(row.date) : null;

      if (row.id) {
        const updated = await tx.purchase.update({
          where: { id: row.id },
          data: { productId: product.id, purchasedAt },
        });
        keptIds.push(updated.id);
      } else {
        const created = await tx.purchase.create({
          data: { customerId: customer.id, productId: product.id, purchasedAt },
        });
        keptIds.push(created.id);
      }
    }
    await tx.purchase.deleteMany({
      where: { customerId: customer.id, id: { notIn: keptIds } },
    });

    await recordAudit({
      userId: user.id,
      entity: "Customer",
      entityId: customer.id,
      action: id ? "UPDATE" : "CREATE",
      diff: before
        ? diffOf(
            {
              firstName: before.firstName,
              lastName: before.lastName,
              street: before.street,
              zip: before.zip,
              city: before.city,
              email: before.email,
              phone: before.phone,
              notes: before.notes,
            },
            data,
          )
        : data,
    });

    return customer.id;
  });

  revalidatePath("/kunden");
  redirect(`/kunden/${savedId}?gespeichert=1`);
}

export async function deleteCustomerAction(formData: FormData): Promise<void> {
  const user = await requirePermission("kunden.loeschen");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Soft-Delete: der Datensatz bleibt wiederherstellbar.
  await db.customer.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await recordAudit({
    userId: user.id,
    entity: "Customer",
    entityId: id,
    action: "DELETE",
  });

  revalidatePath("/kunden");
  redirect("/kunden?geloescht=1");
}

export async function restoreCustomerAction(formData: FormData): Promise<void> {
  const user = await requirePermission("kunden.loeschen");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db.customer.update({ where: { id }, data: { deletedAt: null } });
  await recordAudit({
    userId: user.id,
    entity: "Customer",
    entityId: id,
    action: "RESTORE",
  });

  revalidatePath("/kunden");
  redirect(`/kunden/${id}?wiederhergestellt=1`);
}

export async function setUnsubscribedAction(formData: FormData): Promise<void> {
  const user = await requirePermission("kunden.bearbeiten");
  const id = String(formData.get("id") ?? "");
  const value = formData.get("value") === "1";
  if (!id) return;

  await db.customer.update({
    where: { id },
    data: {
      unsubscribedAt: value ? new Date() : null,
      ...(value ? {} : { bouncedAt: null }),
    },
  });
  await recordAudit({
    userId: user.id,
    entity: "Customer",
    entityId: id,
    action: "UPDATE",
    diff: { unsubscribed: { von: !value, auf: value } },
  });

  revalidatePath(`/kunden/${id}`);
}

/** Speichert den aktuellen Filterstand als wiederverwendbares Segment. */
export async function saveSegmentAction(formData: FormData): Promise<void> {
  await requirePermission("kunden.ansehen");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const filter = customerFilterSchema.parse(
    Object.fromEntries(
      [...formData.entries()]
        .filter(([key]) => key !== "name")
        .map(([key, value]) => [key, String(value)]),
    ),
  );

  await db.segment.upsert({
    where: { name },
    update: { filter },
    create: { name, filter },
  });

  revalidatePath("/kunden");
}

export async function deleteSegmentAction(formData: FormData): Promise<void> {
  await requirePermission("kunden.ansehen");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.segment.delete({ where: { id } }).catch(() => undefined);
  revalidatePath("/kunden");
}
