import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, Card, Table, Td, Th, formatDateTime } from "@/components/ui";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Mein Konto" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();

  const [record, sessions] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id } }),
    db.session.findMany({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-6">
      <Card title="Mein Konto">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Name
            </dt>
            <dd className="mt-0.5 text-sm">{record.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              E-Mail
            </dt>
            <dd className="mt-0.5 text-sm">{record.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Rolle
            </dt>
            <dd className="mt-0.5">
              <Badge tone={record.role === "ADMIN" ? "blue" : "slate"}>
                {record.role === "ADMIN" ? "Administrator" : "Mitarbeiter"}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Letzte Anmeldung
            </dt>
            <dd className="mt-0.5 text-sm">
              {formatDateTime(record.lastLoginAt)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card
        title="Passwort ändern"
        description="Nach der Änderung werden alle offenen Sitzungen dieses Kontos beendet."
      >
        <PasswordForm />
      </Card>

      <Card
        title="Aktive Sitzungen"
        description="Angemeldete Geräte dieses Kontos."
      >
        <Table>
          <thead>
            <tr>
              <Th>Angemeldet</Th>
              <Th>Läuft ab</Th>
              <Th>IP</Th>
              <Th>Gerät</Th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <Td>{formatDateTime(session.createdAt)}</Td>
                <Td className="text-slate-600">
                  {formatDateTime(session.expiresAt)}
                </Td>
                <Td className="text-slate-600">{session.ip ?? "—"}</Td>
                <Td className="max-w-xs truncate text-xs text-slate-500">
                  {session.userAgent ?? "—"}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
