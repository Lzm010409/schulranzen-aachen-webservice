"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { readUnsubscribeToken } from "@/lib/mailer";

export async function unsubscribeAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const customerId = await readUnsubscribeToken(token);
  if (!customerId) redirect("/abmelden/ungueltig");

  await db.customer
    .update({
      where: { id: customerId },
      data: { unsubscribedAt: new Date() },
    })
    .catch(() => undefined);

  // Noch nicht versendete Mails an diesen Kunden werden sofort gestoppt.
  await db.mailJob.updateMany({
    where: { customerId, status: "PENDING" },
    data: { status: "SKIPPED", error: "Kunde hat sich abgemeldet" },
  });

  await recordAudit({
    userId: null,
    entity: "Customer",
    entityId: customerId,
    action: "UPDATE",
    diff: { abmeldung: "ueber Abmeldelink" },
  });

  redirect(`/abmelden/${token}?ok=1`);
}
