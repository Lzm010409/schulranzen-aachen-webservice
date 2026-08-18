import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  Alert,
  Card,
  Table,
  Td,
  Th,
  formatDateTime,
} from "@/components/ui";
import { Pagination } from "@/components/pagination";

export const metadata = { title: "Protokoll" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const ACTION_LABEL: Record<string, string> = {
  CREATE: "Angelegt",
  UPDATE: "Geändert",
  DELETE: "Gelöscht",
  RESTORE: "Wiederhergestellt",
  LOGIN: "Anmeldung",
  LOGIN_FAILED: "Anmeldung fehlgeschlagen",
  LOGOUT: "Abmeldung",
  EXPORT: "Export",
  SEND: "Versand",
  MERGE: "Zusammengeführt",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  if (!can(user, "protokoll.ansehen")) {
    return (
      <Alert variant="warning" title="Kein Zugriff">
        Für das Protokoll fehlt Ihnen die Berechtigung.
      </Alert>
    );
  }

  const page = Math.max(1, Number(params.seite ?? 1) || 1);
  const entity = typeof params.entity === "string" ? params.entity : "";
  const where = entity ? { entity } : {};

  const [total, entries] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const entities = [
    "",
    "Customer",
    "Product",
    "MailTemplate",
    "Campaign",
    "MailAccount",
    "Provider",
    "User",
  ];

  return (
    <div className="space-y-4">
      <Card
        title="Protokoll"
        description="Wer hat wann was geändert, exportiert oder versendet."
      >
        <div className="mb-4 flex flex-wrap gap-1.5">
          {entities.map((value) => (
            <a
              key={value || "alle"}
              href={value ? `/einstellungen/protokoll?entity=${value}` : "/einstellungen/protokoll"}
              className={
                entity === value
                  ? "btn btn-primary"
                  : "btn btn-secondary"
              }
            >
              {value || "Alle"}
            </a>
          ))}
        </div>

        <Table>
          <thead>
            <tr>
              <Th>Zeitpunkt</Th>
              <Th>Benutzer</Th>
              <Th>Aktion</Th>
              <Th>Objekt</Th>
              <Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-50">
                <Td className="whitespace-nowrap text-slate-600">
                  {formatDateTime(entry.createdAt)}
                </Td>
                <Td>{entry.user?.name ?? "—"}</Td>
                <Td>{ACTION_LABEL[entry.action] ?? entry.action}</Td>
                <Td className="text-slate-600">
                  {entry.entity}
                  {entry.entityId ? (
                    <span className="block font-mono text-xs text-slate-400">
                      {entry.entityId.slice(0, 12)}
                    </span>
                  ) : null}
                </Td>
                <Td className="max-w-md">
                  {entry.diff ? (
                    <code className="block truncate text-xs text-slate-500">
                      {JSON.stringify(entry.diff)}
                    </code>
                  ) : (
                    "—"
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        params={params}
      />
    </div>
  );
}
