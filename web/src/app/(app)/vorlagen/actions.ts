"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { fieldErrors, templateSchema } from "@/lib/validation";
import { unknownPlaceholders } from "@/lib/template";

export type TemplateFormState = {
  errors?: Record<string, string>;
  warnings?: string[];
};

export async function saveTemplateAction(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const user = await requirePermission("vorlagen.verwalten");
  const id = String(formData.get("id") ?? "");

  const parsed = templateSchema.safeParse({
    name: formData.get("name") ?? "",
    subject: formData.get("subject") ?? "",
    body: formData.get("body") ?? "",
    isHtml: formData.get("isHtml") === "on",
    category: formData.get("category") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const data = parsed.data;

  const savedId = await db.$transaction(async (tx) => {
    if (!id) {
      const created = await tx.mailTemplate.create({ data });
      await tx.mailTemplateVersion.create({
        data: {
          templateId: created.id,
          version: created.version,
          name: created.name,
          subject: created.subject,
          body: created.body,
          isHtml: created.isHtml,
        },
      });
      return created.id;
    }

    const current = await tx.mailTemplate.findUniqueOrThrow({ where: { id } });
    const changed =
      current.name !== data.name ||
      current.subject !== data.subject ||
      current.body !== data.body ||
      current.isHtml !== data.isHtml;

    const updated = await tx.mailTemplate.update({
      where: { id },
      data: { ...data, version: changed ? current.version + 1 : current.version },
    });

    // Alte Fassungen bleiben erhalten, damit ein versehentliches Ueberschreiben
    // nicht endgueltig ist.
    if (changed) {
      await tx.mailTemplateVersion.create({
        data: {
          templateId: updated.id,
          version: updated.version,
          name: updated.name,
          subject: updated.subject,
          body: updated.body,
          isHtml: updated.isHtml,
        },
      });
    }
    return updated.id;
  });

  await recordAudit({
    userId: user.id,
    entity: "MailTemplate",
    entityId: savedId,
    action: id ? "UPDATE" : "CREATE",
    diff: { name: data.name, subject: data.subject },
  });

  revalidatePath("/vorlagen");
  redirect(`/vorlagen/${savedId}?gespeichert=1`);
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const user = await requirePermission("vorlagen.verwalten");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db.mailTemplate.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await recordAudit({
    userId: user.id,
    entity: "MailTemplate",
    entityId: id,
    action: "DELETE",
  });

  revalidatePath("/vorlagen");
  redirect("/vorlagen");
}

export async function duplicateTemplateAction(
  formData: FormData,
): Promise<void> {
  const user = await requirePermission("vorlagen.verwalten");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const source = await db.mailTemplate.findUnique({ where: { id } });
  if (!source) return;

  const copy = await db.mailTemplate.create({
    data: {
      name: `${source.name} (Kopie)`,
      subject: source.subject,
      body: source.body,
      isHtml: source.isHtml,
      category: source.category,
    },
  });
  await recordAudit({
    userId: user.id,
    entity: "MailTemplate",
    entityId: copy.id,
    action: "CREATE",
    diff: { kopiertVon: id },
  });

  revalidatePath("/vorlagen");
  redirect(`/vorlagen/${copy.id}`);
}

/** Stellt eine frühere Fassung wieder her. */
export async function restoreVersionAction(formData: FormData): Promise<void> {
  const user = await requirePermission("vorlagen.verwalten");
  const versionId = String(formData.get("versionId") ?? "");
  if (!versionId) return;

  const version = await db.mailTemplateVersion.findUnique({
    where: { id: versionId },
  });
  if (!version) return;

  const current = await db.mailTemplate.findUniqueOrThrow({
    where: { id: version.templateId },
  });

  await db.$transaction(async (tx) => {
    const updated = await tx.mailTemplate.update({
      where: { id: version.templateId },
      data: {
        name: version.name,
        subject: version.subject,
        body: version.body,
        isHtml: version.isHtml,
        version: current.version + 1,
      },
    });
    await tx.mailTemplateVersion.create({
      data: {
        templateId: updated.id,
        version: updated.version,
        name: updated.name,
        subject: updated.subject,
        body: updated.body,
        isHtml: updated.isHtml,
      },
    });
  });

  await recordAudit({
    userId: user.id,
    entity: "MailTemplate",
    entityId: version.templateId,
    action: "RESTORE",
    diff: { wiederhergestellteVersion: version.version },
  });

  revalidatePath(`/vorlagen/${version.templateId}`);
  redirect(`/vorlagen/${version.templateId}?gespeichert=1`);
}

/** Prüft den Text im Editor, ohne zu speichern. */
export async function checkPlaceholdersAction(
  body: string,
): Promise<{ unknown: string[]; hasContent: boolean }> {
  await requirePermission("vorlagen.ansehen");
  return {
    unknown: unknownPlaceholders(body),
    hasContent: /\{\{\s*content\s*\}\}/i.test(body),
  };
}
