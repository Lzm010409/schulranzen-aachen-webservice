import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { campaignProgress } from "@/lib/queue";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Table,
  Td,
  Th,
  formatDateTime,
} from "@/components/ui";
import { LiveProgress } from "../live-progress";
import {
  cancelCampaignAction,
  deleteCampaignAction,
  pauseCampaignAction,
  resumeCampaignAction,
  retryFailedAction,
  sendTestMailAction,
  startCampaignAction,
} from "../actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Entwurf",
  SENDING: "Versand läuft",
  DONE: "Abgeschlossen",
  PAUSED: "Pausiert",
  CANCELLED: "Abgebrochen",
};

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const flags = await searchParams;

  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      account: { include: { provider: true } },
      template: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      attachments: {
        select: { id: true, filename: true, size: true, contentType: true },
      },
    },
  });
  if (!campaign) notFound();

  const [progress, failed, recent] = await Promise.all([
    campaignProgress(id),
    db.mailJob.findMany({
      where: { campaignId: id, status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
    db.mailJob.findMany({
      where: { campaignId: id, status: "SENT" },
      orderBy: { sentAt: "desc" },
      take: 10,
    }),
  ]);

  const isDraft = campaign.status === "DRAFT";
  const isRunning = campaign.status === "SENDING";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={campaign.name}
        description={`${STATUS_LABEL[campaign.status]} · angelegt von ${campaign.createdBy.name} am ${formatDateTime(campaign.createdAt)}`}
        actions={
          <>
            {isRunning ? (
              <form action={pauseCampaignAction}>
                <input type="hidden" name="id" value={id} />
                <Button type="submit">Pausieren</Button>
              </form>
            ) : null}
            {campaign.status === "PAUSED" ? (
              <form action={resumeCampaignAction}>
                <input type="hidden" name="id" value={id} />
                <Button type="submit" variant="primary">
                  Fortsetzen
                </Button>
              </form>
            ) : null}
            {isRunning || campaign.status === "PAUSED" ? (
              <form action={cancelCampaignAction}>
                <input type="hidden" name="id" value={id} />
                <Button type="submit" variant="danger">
                  Abbrechen
                </Button>
              </form>
            ) : null}
            {isDraft ? (
              <form action={deleteCampaignAction}>
                <input type="hidden" name="id" value={id} />
                <Button type="submit" variant="danger">
                  Entwurf löschen
                </Button>
              </form>
            ) : null}
          </>
        }
      />

      {flags.fehler ? (
        <div className="mb-4">
          <Alert variant="error">{flags.fehler}</Alert>
        </div>
      ) : null}
      {flags.test ? (
        <div className="mb-4">
          <Alert variant="success">Die Testmail wurde versendet.</Alert>
        </div>
      ) : null}
      {flags.gestartet ? (
        <div className="mb-4">
          <Alert variant="success">
            Der Versand läuft. Der Fortschritt aktualisiert sich automatisch.
          </Alert>
        </div>
      ) : null}
      {flags.wiederholt ? (
        <div className="mb-4">
          <Alert variant="success">
            {flags.wiederholt} fehlgeschlagene Mails wurden erneut eingereiht.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Fortschritt">
            <LiveProgress
              campaignId={id}
              initial={progress}
              live={isRunning}
            />
          </Card>

          {isDraft ? (
            <Card
              title="Vor dem Versand"
              description="Erst testen, dann freigeben. Nach der Freigabe lässt sich der Versand pausieren, aber Versendetes nicht zurückholen."
            >
              <form
                action={sendTestMailAction}
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="campaignId" value={id} />
                <Field label="Testmail an" htmlFor="testEmail" className="flex-1 min-w-56">
                  <Input
                    id="testEmail"
                    name="testEmail"
                    type="email"
                    required
                    defaultValue={user.email}
                  />
                </Field>
                <Button type="submit">Testmail senden</Button>
              </form>

              <div className="mt-5 border-t border-slate-200 pt-4">
                <form action={startCampaignAction}>
                  <input type="hidden" name="id" value={id} />
                  <Button type="submit" variant="primary">
                    Versand an {progress.PENDING.toLocaleString("de-DE")}{" "}
                    Empfänger freigeben
                  </Button>
                </form>
              </div>
            </Card>
          ) : null}

          {failed.length > 0 ? (
            <Card
              title={`Fehlgeschlagen (${progress.FAILED})`}
              description="Pro Empfänger festgehalten, warum die Zustellung nicht geklappt hat."
              footer={
                <form action={retryFailedAction}>
                  <input type="hidden" name="id" value={id} />
                  <Button type="submit">
                    Nur die Fehlgeschlagenen erneut senden
                  </Button>
                </form>
              }
            >
              <Table>
                <thead>
                  <tr>
                    <Th>Empfänger</Th>
                    <Th>Versuche</Th>
                    <Th>Fehler</Th>
                  </tr>
                </thead>
                <tbody>
                  {failed.map((job) => (
                    <tr key={job.id}>
                      <Td>
                        <span className="font-medium">{job.toName}</span>
                        <span className="block text-xs text-slate-500">
                          {job.toEmail}
                        </span>
                      </Td>
                      <Td className="tabular-nums">{job.attempts}</Td>
                      <Td className="text-xs text-red-700">{job.error}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ) : null}

          {recent.length > 0 ? (
            <Card title="Zuletzt zugestellt">
              <ul className="divide-y divide-slate-100 text-sm">
                {recent.map((job) => (
                  <li
                    key={job.id}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span>
                      {job.toName}{" "}
                      <span className="text-slate-500">({job.toEmail})</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDateTime(job.sentAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card title="Eckdaten">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Status
                </dt>
                <dd className="mt-0.5">
                  <Badge
                    tone={
                      campaign.status === "DONE"
                        ? "green"
                        : campaign.status === "SENDING"
                          ? "blue"
                          : campaign.status === "CANCELLED"
                            ? "red"
                            : "slate"
                    }
                  >
                    {STATUS_LABEL[campaign.status]}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Betreff
                </dt>
                <dd className="mt-0.5">{campaign.subject}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Absender
                </dt>
                <dd className="mt-0.5">
                  {campaign.account.fromName}
                  <span className="block text-xs text-slate-500">
                    {campaign.account.fromEmail} über{" "}
                    {campaign.account.provider.name}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Vorlage
                </dt>
                <dd className="mt-0.5">
                  {campaign.template ? (
                    <a
                      href={`/vorlagen/${campaign.template.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {campaign.template.name}
                    </a>
                  ) : (
                    "Standardlayout"
                  )}
                </dd>
              </div>
              {campaign.startedAt ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">
                    Gestartet
                  </dt>
                  <dd className="mt-0.5">{formatDateTime(campaign.startedAt)}</dd>
                </div>
              ) : null}
              {campaign.finishedAt ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">
                    Beendet
                  </dt>
                  <dd className="mt-0.5">
                    {formatDateTime(campaign.finishedAt)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          {campaign.attachments.length > 0 ? (
            <Card title="Anhänge">
              <ul className="space-y-1 text-sm">
                {campaign.attachments.map((attachment) => (
                  <li key={attachment.id} className="flex justify-between gap-2">
                    <span className="truncate">{attachment.filename}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {(attachment.size / 1024).toFixed(0)} KB
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
