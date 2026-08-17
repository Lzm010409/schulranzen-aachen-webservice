import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";
import { decryptSecret } from "./crypto";
import { env } from "./env";

export type AccountWithProvider = {
  id: string;
  username: string;
  passwordEnc: string;
  fromEmail: string;
  fromName: string;
  provider: { host: string; port: number; security: "SSL" | "STARTTLS" };
};

/**
 * Baut einen Transport fuer genau ein Konto. Anders als im Altsystem gibt es
 * keinen prozessweiten Zustand — `Session.getDefaultInstance()` dort fuehrte
 * dazu, dass alle Nutzer ueber die Zugangsdaten des ersten Logins versendeten.
 */
export function createTransport(account: AccountWithProvider): Transporter {
  const secure = account.provider.security === "SSL";
  return nodemailer.createTransport({
    host: account.provider.host,
    port: account.provider.port,
    secure,
    requireTLS: !secure,
    auth: {
      user: account.username,
      pass: decryptSecret(account.passwordEnc),
    },
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 60_000,
  });
}

/**
 * Prueft Erreichbarkeit und Zugangsdaten, ohne eine Mail zu versenden.
 * Das Altsystem verschickte zum "Login" eine echte Testmail an sich selbst.
 */
export async function verifyAccount(
  account: AccountWithProvider,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const transport = createTransport(account);
  try {
    await transport.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeSmtpError(error) };
  } finally {
    transport.close();
  }
}

export function describeSmtpError(error: unknown): string {
  const e = error as { code?: string; responseCode?: number; message?: string };
  const code = e?.code ?? "";
  const message = e?.message ?? String(error);

  if (code === "EAUTH" || e?.responseCode === 535) {
    return "Anmeldung abgelehnt. Benutzername oder Passwort stimmt nicht — bei Google/Microsoft wird ein App-Passwort benoetigt.";
  }
  if (code === "ECONNECTION" || code === "ESOCKET") {
    return `Verbindung fehlgeschlagen. Stimmen Host, Port und Verschluesselung? (${message})`;
  }
  if (code === "ETIMEDOUT" || code === "ECONNREFUSED") {
    return "Zeitueberschreitung beim Verbindungsaufbau. Host oder Port ist vermutlich falsch.";
  }
  if (code === "EENVELOPE") {
    return `Der Server hat die Empfaengeradresse abgelehnt (${message}).`;
  }
  if (e?.responseCode === 550 || e?.responseCode === 553) {
    return `Empfaenger abgelehnt: ${message}`;
  }
  if (e?.responseCode === 421 || e?.responseCode === 450 || e?.responseCode === 452) {
    return `Der Server drosselt gerade (${message}). Wird spaeter erneut versucht.`;
  }
  return message;
}

/** Dauerhafte Fehler werden nicht wiederholt, temporaere schon. */
export function isPermanentError(error: unknown): boolean {
  const e = error as { code?: string; responseCode?: number };
  if (e?.code === "EAUTH") return true;
  if (typeof e?.responseCode === "number") {
    return e.responseCode >= 500 && e.responseCode < 600;
  }
  return false;
}

export async function loadAccount(
  accountId: string,
): Promise<AccountWithProvider | null> {
  const account = await db.mailAccount.findUnique({
    where: { id: accountId },
    include: { provider: true },
  });
  if (!account) return null;
  return {
    id: account.id,
    username: account.username,
    passwordEnc: account.passwordEnc,
    fromEmail: account.fromEmail,
    fromName: account.fromName,
    provider: {
      host: account.provider.host,
      port: account.provider.port,
      security: account.provider.security,
    },
  };
}

// ------------------------------------------------------------- Abmeldelinks

function unsubscribeKey(): Uint8Array {
  return new TextEncoder().encode(env().SESSION_SECRET);
}

/**
 * Signierter Abmelde-Token. Ohne Ablaufdatum — ein Abmeldelink muss auch in
 * einer zwei Jahre alten Mail noch funktionieren.
 */
export async function createUnsubscribeToken(
  customerId: string,
): Promise<string> {
  return new SignJWT({ sub: customerId, purpose: "unsubscribe" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(unsubscribeKey());
}

export async function readUnsubscribeToken(
  token: string,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, unsubscribeKey());
    if (payload.purpose !== "unsubscribe" || typeof payload.sub !== "string") {
      return null;
    }
    return payload.sub;
  } catch {
    return null;
  }
}

export async function unsubscribeUrlFor(customerId: string): Promise<string> {
  const token = await createUnsubscribeToken(customerId);
  return `${env().APP_URL.replace(/\/$/, "")}/abmelden/${token}`;
}
