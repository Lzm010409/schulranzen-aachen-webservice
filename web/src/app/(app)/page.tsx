import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  Badge,
  Card,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
  formatDateTime,
} from "@/components/ui";

export const metadata = { title: "Übersicht" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  const [customers, unsubscribed, withoutEmail, products, campaigns, recent] =
    await Promise.all([
      db.customer.count({ where: { deletedAt: null } }),
      db.customer.count({
        where: { deletedAt: null, unsubscribedAt: { not: null } },
      }),
      db.customer.count({ where: { deletedAt: null, email: null } }),
      db.product.count(),
      db.campaign.count({ where: { status: "SENDING" } }),
      db.campaign.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          _count: { select: { jobs: true } },
          createdBy: { select: { name: true } },
        },
      }),
    ]);

  const stats = [
    { label: "Kunden", value: customers, hint: "aktive Datensätze" },
    { label: "Produkte", value: products, hint: "im Katalog" },
    {
      label: "Ohne E-Mail",
      value: withoutEmail,
      hint: "nicht per Mail erreichbar",
    },
    { label: "Abgemeldet", value: unsubscribed, hint: "vom Newsletter" },
  ];

  return (
    <>
      <PageHeader
        title={`Willkommen, ${user.name.split(" ")[0]}`}
        description="Kundenverwaltung und Mailversand für Schulranzen-Aachen."
        actions={
          <>
            <LinkButton href="/kunden/neu">Kunde anlegen</LinkButton>
            <LinkButton href="/kampagnen/neu" variant="primary">
              Neue Mailkampagne
            </LinkButton>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-5">
            <p className="text-sm text-slate-600">{stat.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
              {stat.value.toLocaleString("de-DE")}
            </p>
            <p className="mt-1 text-xs text-slate-500">{stat.hint}</p>
          </div>
        ))}
      </div>

      {campaigns > 0 ? (
        <div className="mb-6">
          <Card>
            <p className="text-sm">
              <strong>{campaigns}</strong>{" "}
              {campaigns === 1 ? "Kampagne wird" : "Kampagnen werden"} gerade
              versendet.{" "}
              <a href="/kampagnen" className="text-brand-600 underline">
                Fortschritt ansehen
              </a>
            </p>
          </Card>
        </div>
      ) : null}

      <Card
        title="Letzte Kampagnen"
        description="Die fünf zuletzt angelegten Mailversände."
      >
        {recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Noch keine Kampagne angelegt.
          </p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th className="text-right">Empfänger</Th>
                <Th>Angelegt von</Th>
                <Th>Angelegt am</Th>
              </tr>
            </thead>
            <tbody>
              {recent.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-slate-50">
                  <Td>
                    <a
                      href={`/kampagnen/${campaign.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {campaign.name}
                    </a>
                  </Td>
                  <Td>
                    <CampaignBadge status={campaign.status} />
                  </Td>
                  <Td className="text-right tabular-nums">
                    {campaign._count.jobs}
                  </Td>
                  <Td>{campaign.createdBy.name}</Td>
                  <Td className="whitespace-nowrap text-slate-600">
                    {formatDateTime(campaign.createdAt)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

function CampaignBadge({ status }: { status: string }) {
  const map: Record<string, { tone: "slate" | "blue" | "green" | "amber" | "red"; label: string }> =
    {
      DRAFT: { tone: "slate", label: "Entwurf" },
      SENDING: { tone: "blue", label: "Versand läuft" },
      DONE: { tone: "green", label: "Abgeschlossen" },
      PAUSED: { tone: "amber", label: "Pausiert" },
      CANCELLED: { tone: "red", label: "Abgebrochen" },
    };
  const entry = map[status] ?? { tone: "slate" as const, label: status };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
