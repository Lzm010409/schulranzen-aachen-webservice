import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { verifyPassword } from "./crypto";
import { SESSION_COOKIE } from "./auth.shared";
import { can, type Permission } from "./permissions";
import type { Role, User } from "@/generated/prisma/client";

export { SESSION_COOKIE };

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const SESSION_RENEW_AFTER_MS = 1000 * 60 * 60;

/** Fehlversuche pro E-Mail bzw. IP im Beobachtungsfenster. */
const RATE_WINDOW_MS = 1000 * 60 * 15;
const RATE_MAX_PER_EMAIL = 5;
const RATE_MAX_PER_IP = 20;

export type SessionUser = Pick<
  User,
  "id" | "email" | "name" | "role" | "permissions"
>;

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? h.get("x-real-ip") ?? "unbekannt").trim();
}

/**
 * Liest die aktuelle Sitzung. Pro Request gecacht, damit Layout und Seite
 * nicht zweimal in die Datenbank gehen.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { id: token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (!session.user.active) return null;

  // Gleitendes Ablaufdatum: aktive Nutzer werden nicht mitten in der Arbeit
  // ausgeloggt, inaktive Sitzungen laufen trotzdem zuverlaessig ab.
  const age = session.expiresAt.getTime() - SESSION_TTL_MS;
  if (Date.now() - age > SESSION_RENEW_AFTER_MS) {
    await db.session
      .update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
      })
      .catch(() => undefined);
  }

  const { id, email, name, role, permissions } = session.user;
  return { id, email, name, role, permissions };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Diese Aktion ist Administratoren vorbehalten.");
  }
  return user;
}

export function hasRole(user: SessionUser | null, role: Role): boolean {
  if (!user) return false;
  return user.role === "ADMIN" || user.role === role;
}

/**
 * Verbindliche Rechtepruefung. Fehlt das Recht, bricht die Aktion ab —
 * die Oberflaeche blendet solche Bedienelemente zwar aus, aber darauf
 * verlaesst sich der Server nicht.
 */
export async function requirePermission(
  permission: Permission,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, permission)) {
    throw new Error(
      "Für diese Aktion fehlt Ihnen die Berechtigung. Bitte wenden Sie sich an einen Administrator.",
    );
  }
  return user;
}

/** Wie requirePermission, aber fuer Seiten: leitet auf die Startseite um. */
export async function requirePermissionOrRedirect(
  permission: Permission,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, permission)) redirect("/?kein-zugriff=1");
  return user;
}

type LoginResult =
  | { ok: true; user: SessionUser }
  | { ok: false; error: string };

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  const normalized = email.trim().toLowerCase();
  const ip = await clientIp();
  const since = new Date(Date.now() - RATE_WINDOW_MS);

  const [emailFails, ipFails] = await Promise.all([
    db.loginAttempt.count({
      where: { email: normalized, success: false, createdAt: { gte: since } },
    }),
    db.loginAttempt.count({
      where: { ip, success: false, createdAt: { gte: since } },
    }),
  ]);

  if (emailFails >= RATE_MAX_PER_EMAIL || ipFails >= RATE_MAX_PER_IP) {
    return {
      ok: false,
      error:
        "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.",
    };
  }

  const user = await db.user.findUnique({ where: { email: normalized } });

  // Auch ohne Treffer wird gehasht, damit die Antwortzeit nicht verraet,
  // ob die Adresse existiert.
  const valid = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, "scrypt$65536$8$1$AAAA$AAAA").then(
        () => false,
      );

  if (!user || !valid || !user.active) {
    await db.loginAttempt.create({
      data: { email: normalized, ip, success: false },
    });
    await db.auditLog.create({
      data: {
        userId: user?.id ?? null,
        entity: "User",
        entityId: user?.id ?? null,
        action: "LOGIN_FAILED",
        ip,
        diff: { email: normalized },
      },
    });
    return { ok: false, error: "E-Mail oder Passwort ist falsch." };
  }

  const h = await headers();
  const session = await db.session.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      ip,
    },
  });

  await Promise.all([
    db.loginAttempt.create({ data: { email: normalized, ip, success: true } }),
    db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
    db.auditLog.create({
      data: {
        userId: user.id,
        entity: "User",
        entityId: user.id,
        action: "LOGIN",
        ip,
      },
    }),
  ]);

  (await cookies()).set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: session.expiresAt,
  });

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
    },
  };
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await db.session
      .delete({ where: { id: token } })
      .catch(() => null);
    if (session) {
      await db.auditLog.create({
        data: {
          userId: session.userId,
          entity: "User",
          entityId: session.userId,
          action: "LOGOUT",
        },
      });
    }
  }
  jar.delete(SESSION_COOKIE);
}
