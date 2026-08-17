import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Alert, LinkButton, PageHeader } from "@/components/ui";
import { buildWhere, describeFilter, parseFilter } from "@/lib/customer-filter";
import { CampaignForm } from "../campaign-form";

export const metadata = { title: "Neue Kampagne" };
export const dynamic = "force-dynamic";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const params = await searchParams;

  const source = params.quelle === "filter" ? "filter" : "auswahl";
  const filter = parseFilter(params);
  const ids =
    typeof params.ids === "string"
      ? params.ids.split(",").filter(Boolean)
      : [];

  const where =
    source === "filter"
      ? buildWhere(filter)
      : { id: { in: ids }, deletedAt: null };

  const [accounts, templates, stats, product] = await Promise.all([
    db.mailAccount.findMany({
      orderBy: [{ isDefault: "desc" }, { label: "asc" }],
      include: { provider: true },
    }),
    db.mailTemplate.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, subject: true, body: true, isHtml: true },
    }),
    Promise.all([
      db.customer.count({ where }),
      db.customer.count({
        where: { AND: [where, { email: null }] },
      }),
      db.customer.count({
        where: { AND: [where, { unsubscribedAt: { not: null } }] },
      }),
      db.customer.count({
        where: { AND: [where, { bouncedAt: { not: null } }] },
      }),
    ]),
    filter.productId
      ? db.product.findUnique({
          where: { id: filter.productId },
          select: { name: true },
        })
      : null,
  ]);

  const [total, withoutEmail, unsubscribed, bounced] = stats;
  const reachable = total - withoutEmail - unsubscribed - bounced;

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Neue Kampagne" />
        <Alert variant="warning" title="Kein Absenderkonto hinterlegt">
          <p className="mb-3">
            Bevor Mails versendet werden können, muss unter Einstellungen ein
            SMTP-Konto angelegt und geprüft werden.
          </p>
          <LinkButton href="/einstellungen/mailkonten" variant="primary">
            Absenderkonto einrichten
          </LinkButton>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Neue Kampagne"
        description="Der Versand startet erst nach ausdrücklicher Freigabe auf der nächsten Seite."
      />

      <CampaignForm
        source={source}
        ids={ids}
        filter={filter}
        filterDescription={describeFilter(filter, product?.name)}
        recipients={{ total, reachable, withoutEmail, unsubscribed, bounced }}
        accounts={accounts.map((account) => ({
          id: account.id,
          label: account.label,
          fromEmail: account.fromEmail,
          fromName: account.fromName,
          provider: account.provider.name,
          verified: account.lastVerifiedAt !== null,
          isDefault: account.isDefault,
        }))}
        templates={templates}
      />
    </div>
  );
}
