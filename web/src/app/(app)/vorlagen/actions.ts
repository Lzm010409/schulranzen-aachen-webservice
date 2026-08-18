"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { fieldErrors, templateSchema } from "@/lib/validation";
import { unknownPlaceholders } from "@/lib/template";
import { flash } from "@/lib/flash";
import { lagereBilderAus, speichereBild } from "@/lib/mail-images";

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

  // Eingebettete Bilder muessen raus, bevor irgendetwas gespeichert wird:
  // Gmail zeigt sie nicht an und sie sprengen die Groesse, ab der Gmail die
  // ganze Nachricht abschneidet. Sie landen in der Bildablage und stehen
  // danach als gewoehnliche Adresse in der Vorlage.
  const bilder = await lagereBilderAus(parsed.data.body, { userId: user.id });
  const data = { ...parsed.data, body: bilder.html };

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

  if (bilder.probleme.length > 0) {
    // Gespeichert ist die Vorlage, aber ein Bild steckt noch eingebettet
    // darin. Das muss der Bearbeiter jetzt erfahren und nicht erst, wenn die
    // Mail beim Empfaenger leer bleibt.
    await flash.warnung(
      `Vorlage gespeichert. ${bilder.probleme.length} Bild(er) blieben eingebettet: ${bilder.probleme.join(" ")}`,
    );
  } else {
    await flash.gespeichert(
      "Vorlage",
      bilder.ausgelagert > 0
        ? `${data.name} — ${bilder.ausgelagert} Bild(er) ausgelagert und verlinkt`
        : data.name,
    );
  }
  revalidatePath("/vorlagen");
  redirect(`/vorlagen/${savedId}`);
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const user = await requirePermission("vorlagen.verwalten");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const removed = await db.mailTemplate.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await recordAudit({
    userId: user.id,
    entity: "MailTemplate",
    entityId: id,
    action: "DELETE",
  });

  await flash.geloescht("Vorlage", removed.name);
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
  if (!source) {
    await flash.fehler("Die Vorlage gibt es nicht mehr.");
    revalidatePath("/vorlagen");
    return;
  }

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

  await flash.angelegt("Kopie der Vorlage", copy.name);
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
  if (!version) {
    await flash.fehler("Diese Fassung gibt es nicht mehr.");
    return;
  }

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

  await flash.hinweis(
    `Fassung v${version.version} wiederhergestellt.`,
    "Sie wurde als neue Version angelegt; nichts ging verloren.",
  );
  revalidatePath(`/vorlagen/${version.templateId}`);
  redirect(`/vorlagen/${version.templateId}`);
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
