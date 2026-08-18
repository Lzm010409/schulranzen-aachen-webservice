"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, requirePermission, requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { encryptSecret, hashPassword, verifyPassword } from "@/lib/crypto";
import {
  createTransport,
  describeSmtpError,
  loadAccount,
  verifyAccount,
} from "@/lib/mailer";
import {
  DEFAULT_PERMISSIONS,
  sanitizePermissions,
  withImplied,
} from "@/lib/permissions";
import {
  fieldErrors,
  mailAccountSchema,
  passwordSchema,
  providerSchema,
  userSchema,
} from "@/lib/validation";

export type SettingsFormState = {
  errors?: Record<string, string>;
  message?: string;
};

// ------------------------------------------------------------------ Benutzer

export async function saveUserAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const parsed = userSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    role: formData.get("role") ?? "MITARBEITER",
    password: formData.get("password") ?? "",
    active: formData.get("active") === "on",
    permissions: formData.getAll("permissions").map(String),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { password, permissions: rawPermissions, ...data } = parsed.data;

  // Unbekannte Werte aus manipulierten Formularen fallen hier weg; abhaengige
  // Rechte werden ergaenzt, damit kein Konto entsteht, das bearbeiten darf,
  // aber nichts sehen kann.
  const permissions = withImplied(sanitizePermissions(rawPermissions));

  // Beim Anlegen ist ein Passwort Pflicht, beim Bearbeiten optional.
  if (!id || password) {
    const checked = passwordSchema.safeParse(password);
    if (!checked.success) {
      return { errors: { password: checked.error.issues[0].message } };
    }
  }

  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing && existing.id !== id) {
    return { errors: { email: "Diese E-Mail-Adresse ist bereits vergeben." } };
  }

  // Der letzte aktive Admin darf sich nicht selbst aussperren.
  if (id) {
    const current = await db.user.findUnique({ where: { id } });
    if (current?.role === "ADMIN" && (data.role !== "ADMIN" || !data.active)) {
      const admins = await db.user.count({
        where: { role: "ADMIN", active: true, id: { not: id } },
      });
      if (admins === 0) {
        return {
          errors: {
            role: "Es muss mindestens ein aktiver Administrator bestehen bleiben.",
          },
        };
      }
    }
  }

  const user = id
    ? await db.user.update({
        where: { id },
        data: {
          ...data,
          permissions,
          ...(password ? { passwordHash: await hashPassword(password) } : {}),
        },
      })
    : await db.user.create({
        data: {
          ...data,
          permissions:
            permissions.length > 0 ? permissions : DEFAULT_PERMISSIONS,
          passwordHash: await hashPassword(password),
        },
      });

  // Passwortwechsel beendet alle offenen Sitzungen dieses Kontos.
  if (id && password) {
    await db.session.deleteMany({ where: { userId: id } });
  }

  await recordAudit({
    userId: admin.id,
    entity: "User",
    entityId: user.id,
    action: id ? "UPDATE" : "CREATE",
    diff: {
      name: data.name,
      email: data.email,
      role: data.role,
      active: data.active,
      rechte: permissions.join(", ") || "(keine)",
    },
  });

  revalidatePath("/einstellungen/benutzer");
  return { message: id ? "Benutzer aktualisiert." : "Benutzer angelegt." };
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id || id === admin.id) return;

  const target = await db.user.findUnique({ where: { id } });
  if (target?.role === "ADMIN") {
    const admins = await db.user.count({
      where: { role: "ADMIN", active: true, id: { not: id } },
    });
    if (admins === 0) return;
  }

  // Deaktivieren statt loeschen, damit die Protokolleintraege zuordenbar bleiben.
  await db.user.update({ where: { id }, data: { active: false } });
  await db.session.deleteMany({ where: { userId: id } });

  await recordAudit({
    userId: admin.id,
    entity: "User",
    entityId: id,
    action: "UPDATE",
    diff: { active: { von: true, auf: false } },
  });

  revalidatePath("/einstellungen/benutzer");
}

/** Passwortwechsel durch den Benutzer selbst. */
export async function changeOwnPasswordAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");

  const checked = passwordSchema.safeParse(next);
  if (!checked.success) {
    return { errors: { next: checked.error.issues[0].message } };
  }

  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(current, record.passwordHash))) {
    return { errors: { current: "Das aktuelle Passwort ist falsch." } };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });
  await recordAudit({
    userId: user.id,
    entity: "User",
    entityId: user.id,
    action: "UPDATE",
    diff: { passwort: "geaendert" },
  });

  return { message: "Das Passwort wurde geändert." };
}

// ------------------------------------------------------------------ Provider

export async function saveProviderAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const user = await requirePermission("mailkonten.verwalten");
  const id = String(formData.get("id") ?? "");

  const parsed = providerSchema.safeParse({
    name: formData.get("name") ?? "",
    host: formData.get("host") ?? "",
    port: formData.get("port") ?? "",
    security: formData.get("security") ?? "SSL",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // Port und Verschluesselung muessen zusammenpassen — im Altsystem war Port 465
  // mit STARTTLS konfiguriert, was so nicht funktioniert.
  const { port, security } = parsed.data;
  if (port === 465 && security !== "SSL") {
    return {
      errors: {
        security: "Port 465 verlangt durchgängiges SSL/TLS, nicht STARTTLS.",
      },
    };
  }
  if ((port === 587 || port === 25) && security !== "STARTTLS") {
    return {
      errors: { security: `Port ${port} verlangt STARTTLS.` },
    };
  }

  const provider = id
    ? await db.provider.update({ where: { id }, data: parsed.data })
    : await db.provider.create({ data: parsed.data });

  await recordAudit({
    userId: user.id,
    entity: "Provider",
    entityId: provider.id,
    action: id ? "UPDATE" : "CREATE",
    diff: parsed.data,
  });

  revalidatePath("/einstellungen/mailkonten");
  return { message: "Provider gespeichert." };
}

export async function deleteProviderAction(formData: FormData): Promise<void> {
  await requirePermission("mailkonten.verwalten");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const inUse = await db.mailAccount.count({ where: { providerId: id } });
  if (inUse > 0) return;
  await db.provider.delete({ where: { id } }).catch(() => undefined);
  revalidatePath("/einstellungen/mailkonten");
}

// -------------------------------------------------------------- Mailkonten

export async function saveMailAccountAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const user = await requirePermission("mailkonten.verwalten");
  const id = String(formData.get("id") ?? "");

  const parsed = mailAccountSchema.safeParse({
    label: formData.get("label") ?? "",
    providerId: formData.get("providerId") ?? "",
    username: formData.get("username") ?? "",
    password: formData.get("password") ?? "",
    fromEmail: formData.get("fromEmail") ?? "",
    fromName: formData.get("fromName") ?? "",
    isDefault: formData.get("isDefault") === "on",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { password, isDefault, ...data } = parsed.data;
  if (!id && !password) {
    return { errors: { password: "Beim Anlegen wird das Passwort benötigt." } };
  }

  const account = await db.$transaction(async (tx) => {
    const saved = id
      ? await tx.mailAccount.update({
          where: { id },
          data: {
            ...data,
            isDefault,
            // Leeres Feld heisst: Passwort unveraendert lassen.
            ...(password ? { passwordEnc: encryptSecret(password) } : {}),
            ...(password ? { lastVerifiedAt: null, lastError: null } : {}),
          },
        })
      : await tx.mailAccount.create({
          data: { ...data, isDefault, passwordEnc: encryptSecret(password) },
        });

    if (isDefault) {
      await tx.mailAccount.updateMany({
        where: { id: { not: saved.id } },
        data: { isDefault: false },
      });
    }
    return saved;
  });

  await recordAudit({
    userId: user.id,
    entity: "MailAccount",
    entityId: account.id,
    action: id ? "UPDATE" : "CREATE",
    // Das Passwort taucht bewusst in keinem Protokoll auf.
    diff: { label: data.label, username: data.username, fromEmail: data.fromEmail },
  });

  revalidatePath("/einstellungen/mailkonten");
  return { message: "Konto gespeichert. Bitte anschließend die Verbindung prüfen." };
}

/**
 * Prueft die Verbindung mit `SMTP VERIFY` — ohne eine Mail zu versenden.
 */
export async function verifyMailAccountAction(
  formData: FormData,
): Promise<void> {
  await requirePermission("mailkonten.verwalten");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const account = await loadAccount(id);
  if (!account) return;

  const result = await verifyAccount(account);
  await db.mailAccount.update({
    where: { id },
    data: result.ok
      ? { lastVerifiedAt: new Date(), lastError: null }
      : { lastVerifiedAt: null, lastError: result.error },
  });

  revalidatePath("/einstellungen/mailkonten");
}

/**
 * Verschickt eine echte Testmail ueber das gewaehlte Konto. `verify()` prueft
 * nur die Anmeldung — erst eine zugestellte Mail zeigt, dass der Provider den
 * Absender auch akzeptiert und die Nachricht durchlaesst.
 */
export async function sendAccountTestMailAction(
  formData: FormData,
): Promise<void> {
  const user = await requirePermission("mailkonten.verwalten");
  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("testEmail") ?? "").trim();
  if (!id || !to) return;

  const account = await loadAccount(id);
  if (!account) {
    redirect("/einstellungen/mailkonten?fehler=Konto+nicht+gefunden");
  }

  const transport = createTransport(account);
  try {
    const info = await transport.sendMail({
      from: { name: account.fromName, address: account.fromEmail },
      to,
      subject: "Testmail aus dem Schulranzen-Aachen-Webservice",
      text: [
        "Diese Testmail bestaetigt, dass der Versand ueber dieses Konto funktioniert.",
        "",
        `Absender: ${account.fromName} <${account.fromEmail}>`,
        `Server:   ${account.provider.host}:${account.provider.port} (${account.provider.security === "SSL" ? "SSL/TLS" : "STARTTLS"})`,
        `Gesendet: ${new Date().toLocaleString("de-DE")}`,
        "",
        "Wenn diese Nachricht angekommen ist, koennen Kampagnen ueber dieses Konto versendet werden.",
      ].join("\n"),
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6">
<p>Diese Testmail bestätigt, dass der Versand über dieses Konto funktioniert.</p>
<table cellpadding="4" style="border-collapse:collapse;font-size:14px">
<tr><td><strong>Absender</strong></td><td>${account.fromName} &lt;${account.fromEmail}&gt;</td></tr>
<tr><td><strong>Server</strong></td><td>${account.provider.host}:${account.provider.port} (${account.provider.security === "SSL" ? "SSL/TLS" : "STARTTLS"})</td></tr>
<tr><td><strong>Gesendet</strong></td><td>${new Date().toLocaleString("de-DE")}</td></tr>
</table>
<p style="color:#666;font-size:13px">Wenn diese Nachricht angekommen ist, können Kampagnen über dieses Konto versendet werden.</p>
</div>`,
    });

    await db.mailAccount.update({
      where: { id },
      data: { lastVerifiedAt: new Date(), lastError: null },
    });
    await recordAudit({
      userId: user.id,
      entity: "MailAccount",
      entityId: id,
      action: "SEND",
      diff: { testmailAn: to, messageId: info.messageId },
    });

    revalidatePath("/einstellungen/mailkonten");
    redirect(`/einstellungen/mailkonten?test=${encodeURIComponent(to)}`);
  } catch (error) {
    const message = describeSmtpError(error);
    await db.mailAccount
      .update({ where: { id }, data: { lastError: message } })
      .catch(() => undefined);
    revalidatePath("/einstellungen/mailkonten");
    redirect(
      `/einstellungen/mailkonten?fehler=${encodeURIComponent(message)}`,
    );
  } finally {
    transport.close();
  }
}

export async function deleteMailAccountAction(
  formData: FormData,
): Promise<void> {
  await requirePermission("mailkonten.verwalten");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const inUse = await db.campaign.count({ where: { accountId: id } });
  if (inUse > 0) {
    redirect("/einstellungen/mailkonten?fehler=Konto+wird+von+Kampagnen+genutzt");
  }
  await db.mailAccount.delete({ where: { id } }).catch(() => undefined);
  revalidatePath("/einstellungen/mailkonten");
}
