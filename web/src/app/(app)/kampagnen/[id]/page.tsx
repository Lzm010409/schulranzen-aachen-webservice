import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { campaignProgress } from "@/lib/queue";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  PageHeader,
  Table,
  Td,
  Th,
  formatDateTime,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Pagination } from "@/components/pagination";
import { readPaging } from "@/lib/pagination";
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

/** Vorgabe, solange nichts anderes gewählt wurde. */
const STANDARD_SEITENGROESSE = 25;

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Entwurf",
  SENDING: "Versand läuft",
  DONE: "Abgeschlossen",
  PAUSED: "Pausiert",
  CANCELLED: "Abgebrochen",
};

const JOB_LABEL: Record<string, string> = {
  PENDING: "wartet",
  SENDING: "wird gesendet",
  SENT: "zugestellt",
  FAILED: "fehlgeschlagen",
  SKIPPED: "übersprungen",
};

const JOB_TONE: Record<string, "slate" | "blue" | "green" | "amber" | "red"> = {
  PENDING: "slate",
  SENDING: "blue",
  SENT: "green",
  FAILED: "red",
  SKIPPED: "amber",
};

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermissionOrRedirect("kampagnen.ansehen");
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

  // Zwei Tabellen auf einer Seite, also zwei eigene Seitenzahlen. Eine
  // Kampagne kann zehntausend Empfaenger haben — beide Listen werden
  // seitenweise geholt, nie am Stueck.
  const fehlerSeite = await readPaging(flags, {
    pageParam: "fehler",
    fallbackSize: STANDARD_SEITENGROESSE,
  });
  const empfaenger = await readPaging(flags, {
    pageParam: "empfaenger",
    fallbackSize: STANDARD_SEITENGROESSE,
  });

  const [progress, failedTotal, failed, recipientTotal, recipients] =
    await Promise.all([
      campaignProgress(id),
      db.mailJob.count({ where: { campaignId: id, status: "FAILED" } }),
      db.mailJob.findMany({
        where: { campaignId: id, status: "FAILED" },
        orderBy: { updatedAt: "desc" },
        skip: fehlerSeite.skip,
        take: fehlerSeite.take,
      }),
      db.mailJob.count({ where: { campaignId: id } }),
      db.mailJob.findMany({
        where: { campaignId: id },
        orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
        skip: empfaenger.skip,
        take: empfaenger.take,
      }),
    ]);

  const mayCreate = can(user, "kampagnen.erstellen");
  const maySend = can(user, "kampagnen.senden");
  const isDraft = campaign.status === "DRAFT";
  const isRunning = campaign.status === "SENDING";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={campaign.name}
        description={`${STATUS_LABEL[campaign.status]} · angelegt von ${campaign.createdBy.name} am ${formatDateTime(campaign.createdAt)}`}
        actions={
          <>
            {isRunning && maySend ? (
              <form action={pauseCampaignAction}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton busyLabel="Wird pausiert…">Pausieren</SubmitButton>
              </form>
            ) : null}
            {campaign.status === "PAUSED" && maySend ? (
              <form action={resumeCampaignAction}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton variant="primary" busyLabel="Wird fortgesetzt…">
                  Fortsetzen
                </SubmitButton>
              </form>
            ) : null}
            {(isRunning || campaign.status === "PAUSED") && maySend ? (
              <form action={cancelCampaignAction}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton variant="error" busyLabel="Wird abgebrochen…">
                  Abbrechen
                </SubmitButton>
              </form>
            ) : null}
            {isDraft && mayCreate ? (
              <form action={deleteCampaignAction}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton variant="error" busyLabel="Wird gelöscht…">
                  Entwurf löschen
                </SubmitButton>
              </form>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Fortschritt">
            <LiveProgress
              campaignId={id}
              initial={progress}
              live={isRunning}
            />
          </Card>

          {isDraft && mayCreate ? (
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
                <SubmitButton busyLabel="Wird gesendet…">Testmail senden</SubmitButton>
              </form>

              <div className="mt-5 border-t border-slate-200 pt-4">
                {maySend ? (
                  <form action={startCampaignAction}>
                    <input type="hidden" name="id" value={id} />
                    <SubmitButton variant="primary" busyLabel="Wird freigegeben…">
                      Versand an {progress.PENDING.toLocaleString("de-DE")}{" "}
                      Empfänger freigeben
                    </SubmitButton>
                  </form>
                ) : (
                  <Alert variant="info">
                    Für die Freigabe des Versands fehlt Ihnen die Berechtigung.
                    Ein Kollege mit dem Recht „Versand freigeben“ kann die
                    Kampagne starten.
                  </Alert>
                )}
              </div>
            </Card>
          ) : null}

          {failedTotal > 0 ? (
            <Card
              title={`Fehlgeschlagen (${progress.FAILED})`}
              description="Pro Empfänger festgehalten, warum die Zustellung nicht geklappt hat."
              footer={
                maySend ? (
                <form action={retryFailedAction}>
                  <input type="hidden" name="id" value={id} />
                  <SubmitButton busyLabel="Wird eingereiht…">
                    Nur die Fehlgeschlagenen erneut senden
                  </SubmitButton>
                </form>
                ) : null
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

              <Pagination
                page={fehlerSeite.page}
                pageSize={fehlerSeite.pageSize}
                total={failedTotal}
                params={flags}
                paramName="fehler"
              />
            </Card>
          ) : null}

          {recipientTotal > 0 ? (
            <Card
              title={`Empfänger (${recipientTotal.toLocaleString("de-DE")})`}
              description="Jeder Empfänger mit seinem Zustellstand."
            >
              <Table>
                <thead>
                  <tr>
                    <Th>Empfänger</Th>
                    <Th>Status</Th>
                    <Th>Zeitpunkt</Th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((job) => (
                    <tr key={job.id}>
                      <Td>
                        <span className="font-medium">{job.toName}</span>
                        <span className="block text-xs text-slate-500">
                          {job.toEmail}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone={JOB_TONE[job.status] ?? "slate"}>
                          {JOB_LABEL[job.status] ?? job.status}
                        </Badge>
                      </Td>
                      <Td className="text-xs text-slate-500">
                        {formatDateTime(job.sentAt ?? job.createdAt)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <Pagination
                page={empfaenger.page}
                pageSize={empfaenger.pageSize}
                total={recipientTotal}
                params={flags}
                paramName="empfaenger"
              />
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
