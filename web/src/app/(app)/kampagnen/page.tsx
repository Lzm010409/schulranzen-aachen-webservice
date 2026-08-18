import { db } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/auth";
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
  formatDateTime,
} from "@/components/ui";

export const metadata = { title: "Mailversand" };
export const dynamic = "force-dynamic";

const STATUS: Record<
  string,
  { label: string; tone: "slate" | "blue" | "green" | "amber" | "red" }
> = {
  DRAFT: { label: "Entwurf", tone: "slate" },
  SENDING: { label: "Versand läuft", tone: "blue" },
  DONE: { label: "Abgeschlossen", tone: "green" },
  PAUSED: { label: "Pausiert", tone: "amber" },
  CANCELLED: { label: "Abgebrochen", tone: "red" },
};

export default async function CampaignsPage() {
  await requirePermissionOrRedirect("kampagnen.ansehen");

  const campaigns = await db.campaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      createdBy: { select: { name: true } },
      account: { select: { fromEmail: true } },
    },
  });

  const counts = await db.mailJob.groupBy({
    by: ["campaignId", "status"],
    _count: { _all: true },
    where: { campaignId: { in: campaigns.map((c) => c.id) } },
  });

  const byCampaign = new Map<string, { sent: number; failed: number; total: number }>();
  for (const row of counts) {
    const entry = byCampaign.get(row.campaignId) ?? {
      sent: 0,
      failed: 0,
      total: 0,
    };
    entry.total += row._count._all;
    if (row.status === "SENT") entry.sent += row._count._all;
    if (row.status === "FAILED") entry.failed += row._count._all;
    byCampaign.set(row.campaignId, entry);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        description="Jede Kampagne behält ihr vollständiges Versandprotokoll."
        actions={
          <LinkButton href="/kunden" variant="primary">
            Empfänger auswählen
          </LinkButton>
        }
      />

      <Card className="overflow-hidden">
        {campaigns.length === 0 ? (
          <EmptyState
            title="Noch keine Kampagne"
            description="Wählen Sie in der Kundenliste die Empfänger aus — daraus entsteht eine Kampagne."
            action={
              <LinkButton href="/kunden" variant="primary">
                Zur Kundenliste
              </LinkButton>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th className="text-right">Empfänger</Th>
                <Th className="text-right">Zugestellt</Th>
                <Th className="text-right">Fehler</Th>
                <Th>Absender</Th>
                <Th>Angelegt</Th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => {
                const stats = byCampaign.get(campaign.id) ?? {
                  sent: 0,
                  failed: 0,
                  total: 0,
                };
                const status = STATUS[campaign.status];
                return (
                  <tr key={campaign.id} className="hover:bg-slate-50">
                    <Td>
                      <a
                        href={`/kampagnen/${campaign.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {campaign.name}
                      </a>
                      <span className="block text-xs text-slate-500">
                        {campaign.subject}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </Td>
                    <Td className="text-right tabular-nums">{stats.total}</Td>
                    <Td className="text-right tabular-nums text-emerald-700">
                      {stats.sent}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {stats.failed > 0 ? (
                        <span className="text-red-700">{stats.failed}</span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-slate-600">
                      {campaign.account.fromEmail}
                    </Td>
                    <Td className="whitespace-nowrap text-slate-600">
                      {formatDateTime(campaign.createdAt)}
                      <span className="block text-xs text-slate-400">
                        {campaign.createdBy.name}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
