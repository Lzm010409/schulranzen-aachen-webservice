"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { campaignSchema, fieldErrors } from "@/lib/validation";
import { customerFilterSchema } from "@/lib/customer-filter";
import { enqueueRecipients, retryFailed } from "@/lib/queue";
import {
  createTransport,
  describeSmtpError,
  loadAccount,
  unsubscribeUrlFor,
} from "@/lib/mailer";
import { renderEmail, renderPlaceholders } from "@/lib/template";
import { buildCustomerVars } from "@/lib/mail-vars";
import { flash } from "@/lib/flash";

const MAX_ATTACHMENT_TOTAL = 10 * 1024 * 1024;

export type CampaignFormState = {
  errors?: Record<string, string>;
  message?: string;
};

/**
 * Legt eine Kampagne als Entwurf an und stellt die Empfaenger in die
 * Warteschlange. Es wird noch nichts versendet — das passiert erst nach der
 * ausdruecklichen Freigabe.
 */
export async function createCampaignAction(
  _prev: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  const user = await requirePermission("kampagnen.erstellen");

  const parsed = campaignSchema.safeParse({
    name: formData.get("name") ?? "",
    subject: formData.get("subject") ?? "",
    body: formData.get("body") ?? "",
    templateId: formData.get("templateId") ?? "",
    accountId: formData.get("accountId") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const files = formData
    .getAll("attachments")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_ATTACHMENT_TOTAL) {
    return {
      errors: {
        attachments: `Die Anhänge sind zusammen ${(totalSize / 1024 / 1024).toFixed(1)} MB groß. Erlaubt sind 10 MB.`,
      },
    };
  }

  const source = String(formData.get("quelle") ?? "auswahl");
  const selection =
    source === "filter"
      ? {
          filter: customerFilterSchema.parse(
            Object.fromEntries(
              [...formData.entries()]
                .filter(([key]) => key.startsWith("f_"))
                .map(([key, value]) => [key.slice(2), String(value)]),
            ),
          ),
        }
      : {
          customerIds: String(formData.get("ids") ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        };

  if ("customerIds" in selection && selection.customerIds?.length === 0) {
    return { errors: { _: "Es wurden keine Empfänger ausgewählt." } };
  }

  const campaign = await db.campaign.create({
    data: {
      name: parsed.data.name,
      subject: parsed.data.subject,
      body: parsed.data.body,
      templateId: parsed.data.templateId,
      accountId: parsed.data.accountId,
      createdById: user.id,
      status: "DRAFT",
    },
  });

  for (const file of files) {
    await db.campaignAttachment.create({
      data: {
        campaignId: campaign.id,
        filename: file.name.replace(/[/\\]/g, "_").slice(0, 200),
        contentType: file.type || "application/octet-stream",
        size: file.size,
        data: Buffer.from(await file.arrayBuffer()),
      },
    });
  }

  const result = await enqueueRecipients(campaign.id, selection);

  await recordAudit({
    userId: user.id,
    entity: "Campaign",
    entityId: campaign.id,
    action: "CREATE",
    diff: { empfaenger: result.queued, uebersprungen: result.skipped },
  });

  await flash.angelegt(
    "Kampagne",
    `${result.queued} Empfänger vorgemerkt. Der Versand startet erst mit der Freigabe.`,
  );
  redirect(`/kampagnen/${campaign.id}`);
}

/** Sendet eine Testmail an eine frei wählbare Adresse. */
export async function sendTestMailAction(
  formData: FormData,
): Promise<void> {
  const user = await requirePermission("kampagnen.erstellen");
  const campaignId = String(formData.get("campaignId") ?? "");
  const to = String(formData.get("testEmail") ?? "").trim();
  if (!campaignId) return;
  if (!to) {
    await flash.fehler("Bitte eine Adresse für die Testmail angeben.");
    revalidatePath(`/kampagnen/${campaignId}`);
    return;
  }

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: { template: true, attachments: true },
  });
  if (!campaign) return;

  const account = await loadAccount(campaign.accountId);
  if (!account) {
    await flash.fehler(
      "Der Kampagne fehlt ein Absenderkonto.",
      "Unter Einstellungen → Mailkonten hinterlegen.",
    );
    redirect(`/kampagnen/${campaignId}`);
  }

  // Für den Test wird ein echter Empfänger der Kampagne als Datenquelle
  // genutzt, damit die Platzhalter zeigen, was tatsächlich ankommt —
  // derselbe Baustein wie beim Versand, nicht eine zweite Zuordnung daneben.
  const sampleJob = await db.mailJob.findFirst({
    where: { campaignId, customerId: { not: null } },
    select: { customerId: true, toName: true },
  });

  const vars = await buildCustomerVars(
    sampleJob?.customerId ?? null,
    sampleJob?.toName ?? "",
  );

  const unsubscribeUrl = sampleJob?.customerId
    ? await unsubscribeUrlFor(sampleJob.customerId)
    : `${process.env.APP_URL ?? ""}/abmelden/test`;

  const { html, text } = renderEmail({
    body: campaign.body,
    templateBody: campaign.template?.body ?? null,
    templateIsHtml: campaign.template?.isHtml ?? true,
    vars,
    unsubscribeUrl,
  });

  const transport = createTransport(account);
  try {
    await transport.sendMail({
      from: { name: account.fromName, address: account.fromEmail },
      to,
      subject: `[TEST] ${renderPlaceholders(campaign.subject, vars, { escape: false })}`,
      html,
      text,
      attachments: campaign.attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.data),
        contentType: a.contentType,
      })),
    });
    await recordAudit({
      userId: user.id,
      entity: "Campaign",
      entityId: campaignId,
      action: "SEND",
      diff: { testmailAn: to },
    });
    await flash.hinweis("Testmail verschickt.", `Ging an ${to}.`);
    redirect(`/kampagnen/${campaignId}`);
  } catch (error) {
    await flash.fehler(
      "Die Testmail ging nicht hinaus.",
      describeSmtpError(error),
    );
    redirect(`/kampagnen/${campaignId}`);
  } finally {
    transport.close();
  }
}

/** Gibt die Kampagne frei — ab hier arbeitet der Worker sie ab. */
export async function startCampaignAction(formData: FormData): Promise<void> {
  // Erst dieses Recht laesst tatsaechlich Mails hinausgehen.
  const user = await requirePermission("kampagnen.senden");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const pending = await db.mailJob.count({
    where: { campaignId: id, status: "PENDING" },
  });
  if (pending === 0) {
    await flash.fehler("Es gibt keine offenen Empfänger mehr.");
    redirect(`/kampagnen/${id}`);
  }

  await db.campaign.update({
    where: { id },
    data: { status: "SENDING", startedAt: new Date(), finishedAt: null },
  });
  await recordAudit({
    userId: user.id,
    entity: "Campaign",
    entityId: id,
    action: "SEND",
    diff: { freigegeben: pending },
  });

  await flash.hinweis(
    "Versand freigegeben.",
    `${pending} Empfänger sind eingereiht; der Fortschritt aktualisiert sich von selbst.`,
  );
  revalidatePath(`/kampagnen/${id}`);
  redirect(`/kampagnen/${id}`);
}

export async function pauseCampaignAction(formData: FormData): Promise<void> {
  await requirePermission("kampagnen.senden");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.campaign.update({ where: { id }, data: { status: "PAUSED" } });
  await flash.hinweis("Versand pausiert.", "Bereits begonnene Mails gehen noch hinaus.");
  revalidatePath(`/kampagnen/${id}`);
}

export async function resumeCampaignAction(formData: FormData): Promise<void> {
  await requirePermission("kampagnen.senden");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.campaign.update({ where: { id }, data: { status: "SENDING" } });
  await flash.hinweis("Versand fortgesetzt.");
  revalidatePath(`/kampagnen/${id}`);
}

export async function cancelCampaignAction(formData: FormData): Promise<void> {
  const user = await requirePermission("kampagnen.senden");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db.$transaction([
    db.mailJob.updateMany({
      where: { campaignId: id, status: { in: ["PENDING", "SENDING"] } },
      data: { status: "SKIPPED", error: "Kampagne abgebrochen" },
    }),
    db.campaign.update({
      where: { id },
      data: { status: "CANCELLED", finishedAt: new Date() },
    }),
  ]);
  await recordAudit({
    userId: user.id,
    entity: "Campaign",
    entityId: id,
    action: "UPDATE",
    diff: { status: { von: "SENDING", auf: "CANCELLED" } },
  });

  await flash.warnung(
    "Kampagne abgebrochen.",
    "Offene Empfänger werden nicht mehr angeschrieben.",
  );
  revalidatePath(`/kampagnen/${id}`);
}

export async function retryFailedAction(formData: FormData): Promise<void> {
  await requirePermission("kampagnen.senden");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const count = await retryFailed(id);
  if (count > 0) {
    await flash.hinweis(`${count} Empfänger erneut eingereiht.`);
  } else {
    await flash.hinweis("Es gab nichts zu wiederholen.");
  }
  revalidatePath(`/kampagnen/${id}`);
  redirect(`/kampagnen/${id}`);
}

export async function deleteCampaignAction(formData: FormData): Promise<void> {
  await requirePermission("kampagnen.erstellen");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const campaign = await db.campaign.findUnique({ where: { id } });
  // Versendete Kampagnen bleiben als Nachweis erhalten.
  if (!campaign || campaign.status !== "DRAFT") {
    await flash.fehler(
      "Nur Entwürfe lassen sich löschen.",
      "Versendete Kampagnen bleiben als Nachweis erhalten.",
    );
    redirect(`/kampagnen/${id}`);
  }
  await db.campaign.delete({ where: { id } });
  await flash.geloescht("Kampagne", campaign.name);
  redirect("/kampagnen");
}
