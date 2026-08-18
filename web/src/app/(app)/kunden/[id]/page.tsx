import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  Alert,
  Badge,
  Button,
  Card,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
  formatDateTime,
} from "@/components/ui";
import { Pagination } from "@/components/pagination";
import {
  deleteCustomerAction,
  restoreCustomerAction,
  setUnsubscribedAction,
} from "../actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermissionOrRedirect("kunden.ansehen");
  const { id } = await params;
  const flags = await searchParams;

  // Drei Tabellen auf einer Seite, also drei eigene Seitenzahlen.
  const purchasePage = Math.max(1, Number(flags.kaeufe ?? 1) || 1);
  const mailPage = Math.max(1, Number(flags.mails ?? 1) || 1);
  const historyPage = Math.max(1, Number(flags.verlauf ?? 1) || 1);

  const customer = await db.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  const [
    purchaseTotal,
    purchases,
    mailTotal,
    mailJobs,
    historyTotal,
    history,
  ] = await Promise.all([
    db.purchase.count({ where: { customerId: id } }),
    db.purchase.findMany({
      where: { customerId: id },
      orderBy: [{ purchasedAt: "desc" }, { createdAt: "desc" }],
      include: { product: true },
      skip: (purchasePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.mailJob.count({ where: { customerId: id } }),
    db.mailJob.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      include: { campaign: { select: { id: true, name: true } } },
      skip: (mailPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.count({ where: { entity: "Customer", entityId: id } }),
    db.auditLog.findMany({
      where: { entity: "Customer", entityId: id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
      skip: (historyPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const fullName = `${customer.firstName} ${customer.lastName}`;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={fullName}
        description={`${customer.street} · ${customer.zip} ${customer.city}`}
        actions={
          <>
            <LinkButton href="/kunden">Zur Liste</LinkButton>
            {can(user, "kunden.bearbeiten") ? (
              <LinkButton href={`/kunden/${id}/bearbeiten`} variant="primary">
                Bearbeiten
              </LinkButton>
            ) : null}
          </>
        }
      />

      {flags.gespeichert ? (
        <div className="mb-4">
          <Alert variant="success">Die Änderungen wurden gespeichert.</Alert>
        </div>
      ) : null}
      {flags.wiederhergestellt ? (
        <div className="mb-4">
          <Alert variant="success">Der Kunde wurde wiederhergestellt.</Alert>
        </div>
      ) : null}
      {customer.deletedAt ? (
        <div className="mb-4">
          <Alert variant="warning" title="Dieser Kunde ist gelöscht">
            <p className="mb-2">
              Gelöscht am {formatDateTime(customer.deletedAt)}. Der Datensatz
              wird bei Filtern und beim Mailversand ignoriert.
            </p>
            <form action={restoreCustomerAction}>
              <input type="hidden" name="id" value={customer.id} />
              <Button type="submit">Wiederherstellen</Button>
            </form>
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Kontakt">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="E-Mail">
                {customer.email ? (
                  <a
                    href={`mailto:${customer.email}`}
                    className="text-brand-700 hover:underline"
                  >
                    {customer.email}
                  </a>
                ) : (
                  <span className="text-slate-400">nicht hinterlegt</span>
                )}
              </Detail>
              <Detail label="Telefon">
                {customer.phone ?? (
                  <span className="text-slate-400">nicht hinterlegt</span>
                )}
              </Detail>
              <Detail label="Erfasst am">
                {formatDateTime(customer.createdAt)}
              </Detail>
              <Detail label="Zuletzt geändert">
                {formatDateTime(customer.updatedAt)}
              </Detail>
              {customer.notes ? (
                <Detail label="Notiz" className="sm:col-span-2">
                  <span className="whitespace-pre-wrap">{customer.notes}</span>
                </Detail>
              ) : null}
            </dl>
          </Card>

          <Card title="Käufe" description={`${purchaseTotal} erfasst`}>
            {purchases.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">
                Noch kein Kauf hinterlegt.
              </p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Produkt</Th>
                    <Th>Kaufdatum</Th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => (
                    <tr key={purchase.id}>
                      <Td>{purchase.product.name}</Td>
                      <Td className="text-slate-600">
                        {formatDate(purchase.purchasedAt)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}

            <Pagination
              page={purchasePage}
              pageSize={PAGE_SIZE}
              total={purchaseTotal}
              params={flags}
              paramName="kaeufe"
            />
          </Card>

          <Card title="Mailhistorie" description={`${mailTotal} Versände`}>
            {mailJobs.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">
                An diesen Kunden wurde noch nichts versendet.
              </p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Kampagne</Th>
                    <Th>Status</Th>
                    <Th>Zeitpunkt</Th>
                  </tr>
                </thead>
                <tbody>
                  {mailJobs.map((job) => (
                    <tr key={job.id}>
                      <Td>
                        <a
                          href={`/kampagnen/${job.campaign.id}`}
                          className="text-brand-700 hover:underline"
                        >
                          {job.campaign.name}
                        </a>
                      </Td>
                      <Td>
                        <JobBadge status={job.status} error={job.error} />
                      </Td>
                      <Td className="text-slate-600">
                        {formatDateTime(job.sentAt ?? job.createdAt)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}

            <Pagination
              page={mailPage}
              pageSize={PAGE_SIZE}
              total={mailTotal}
              params={flags}
              paramName="mails"
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Status">
            <div className="flex flex-wrap gap-2">
              {customer.unsubscribedAt ? (
                <Badge tone="amber">
                  abgemeldet am {formatDate(customer.unsubscribedAt)}
                </Badge>
              ) : (
                <Badge tone="green">Newsletter aktiv</Badge>
              )}
              {customer.bouncedAt ? <Badge tone="red">Hard-Bounce</Badge> : null}
              {!customer.email ? (
                <Badge tone="slate">keine E-Mail-Adresse</Badge>
              ) : null}
            </div>

            <form action={setUnsubscribedAction} className="mt-4">
              <input type="hidden" name="id" value={customer.id} />
              <input
                type="hidden"
                name="value"
                value={customer.unsubscribedAt ? "0" : "1"}
              />
              <Button type="submit">
                {customer.unsubscribedAt
                  ? "Wieder anmelden"
                  : "Vom Newsletter abmelden"}
              </Button>
            </form>
          </Card>

          {!customer.deletedAt && can(user, "kunden.loeschen") ? (
            <Card title="Löschen">
              <p className="mb-3 text-sm text-slate-600">
                Der Datensatz wird ausgeblendet, bleibt aber wiederherstellbar.
              </p>
              <form action={deleteCustomerAction}>
                <input type="hidden" name="id" value={customer.id} />
                <Button type="submit" variant="error">
                  Kunde löschen
                </Button>
              </form>
            </Card>
          ) : null}

          <Card title={`Änderungshistorie (${historyTotal})`}>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">Keine Einträge.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {history.map((entry) => (
                  <li key={entry.id} className="border-l-2 border-slate-200 pl-3">
                    <p className="font-medium text-slate-800">
                      {actionLabel(entry.action)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(entry.createdAt)}
                      {entry.user ? ` · ${entry.user.name}` : ""}
                    </p>
                    {entry.diff ? (
                      <ChangeList diff={entry.diff as Record<string, { von: unknown; auf: unknown }>} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <Pagination
              page={historyPage}
              pageSize={PAGE_SIZE}
              total={historyTotal}
              params={flags}
              paramName="verlauf"
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function ChangeList({
  diff,
}: {
  diff: Record<string, { von: unknown; auf: unknown }>;
}) {
  const entries = Object.entries(diff).filter(
    ([, value]) => value && typeof value === "object" && "auf" in value,
  );
  if (entries.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
      {entries.slice(0, 6).map(([field, value]) => (
        <li key={field}>
          <span className="font-medium">{field}</span>:{" "}
          <span className="line-through">{String(value.von ?? "—")}</span> →{" "}
          {String(value.auf ?? "—")}
        </li>
      ))}
    </ul>
  );
}

function actionLabel(action: string): string {
  return (
    {
      CREATE: "Angelegt",
      UPDATE: "Geändert",
      DELETE: "Gelöscht",
      RESTORE: "Wiederhergestellt",
      SEND: "Mail versendet",
      MERGE: "Zusammengeführt",
    }[action] ?? action
  );
}

function JobBadge({ status, error }: { status: string; error: string | null }) {
  if (status === "SENT") return <Badge tone="green">zugestellt</Badge>;
  if (status === "FAILED")
    return (
      <span title={error ?? undefined}>
        <Badge tone="red">fehlgeschlagen</Badge>
      </span>
    );
  if (status === "SKIPPED") return <Badge tone="slate">übersprungen</Badge>;
  return <Badge tone="blue">in Warteschlange</Badge>;
}
