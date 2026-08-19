import "server-only";
import type { Transporter } from "nodemailer";
import { db } from "./db";
import { env } from "./env";
import {
  createTransport,
  describeSmtpError,
  isPermanentError,
  loadAccount,
  unsubscribeUrlFor,
  type AccountWithProvider,
} from "./mailer";
import { renderEmail, renderPlaceholders } from "./template";
import { buildCustomerVars } from "./mail-vars";
import { log, raeumeProtokollAuf } from "./log";

/**
 * Versand-Worker.
 *
 * Laeuft im selben Prozess wie die Anwendung und arbeitet die Tabelle
 * `mail_job` ab. Wichtige Eigenschaften:
 *
 *  - Jobs werden per `FOR UPDATE SKIP LOCKED` geholt. Selbst wenn mehrere
 *    Instanzen laufen, bekommt jeden Job genau einer.
 *  - Ein Neustart mitten im Versand verliert nichts: der Zustand steht in der
 *    Datenbank, nicht im Speicher.
 *  - Die Rate ist gedeckelt (MAIL_RATE_PER_MINUTE), weil Provider sonst
 *    drosseln oder sperren.
 *  - Fehler werden pro Empfaenger festgehalten. Ein kaputter Empfaenger
 *    stoppt nicht den Rest — das war im Altsystem der Hauptmangel.
 */

const TICK_MS = 5_000;

type ClaimedJob = {
  id: string;
  campaign_id: string;
  customer_id: string | null;
  to_email: string;
  to_name: string;
  attempts: number;
};

let running = false;
let timer: NodeJS.Timeout | null = null;
/** Wann zuletzt aufgeraeumt wurde; das muss nicht bei jedem Durchlauf sein. */
let letzteAufraeumung = 0;
const AUFRAEUMEN_ALLE_MS = 60 * 60 * 1000;

export function startWorker(): void {
  if (timer || !env().MAIL_WORKER_ENABLED) return;
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  // Der Worker soll den Prozess nicht am Beenden hindern.
  timer.unref?.();
  void log.info({ source: "worker", message: "Versand-Worker gestartet" });
}

export function stopWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Wie viele Mails pro Durchlauf erlaubt sind, abgeleitet aus der Minutenrate. */
function batchSize(): number {
  const perMinute = env().MAIL_RATE_PER_MINUTE;
  return Math.max(1, Math.round((perMinute * TICK_MS) / 60_000));
}

export async function tick(): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    await aufraeumenWennFaellig();

    const jobs = await claimJobs(batchSize());
    if (jobs.length === 0) {
      await finishCompletedCampaigns();
      return 0;
    }

    // Nach Kampagne gruppieren, damit pro Durchlauf nur ein Transport pro
    // Absenderkonto aufgebaut wird.
    const byCampaign = new Map<string, ClaimedJob[]>();
    for (const job of jobs) {
      const list = byCampaign.get(job.campaign_id) ?? [];
      list.push(job);
      byCampaign.set(job.campaign_id, list);
    }

    for (const [campaignId, campaignJobs] of byCampaign) {
      await processCampaignJobs(campaignId, campaignJobs);
    }

    await finishCompletedCampaigns();
    return jobs.length;
  } catch (error) {
    await log.error({
      source: "worker",
      message: "Durchlauf fehlgeschlagen",
      error,
    });
    return 0;
  } finally {
    running = false;
  }
}

/**
 * Haengt sich an den Takt des Workers, statt einen zweiten Zeitgeber zu
 * starten: der Worker laeuft ohnehin, und ein eigener Prozess waere fuer ein
 * DELETE pro Stunde nicht zu rechtfertigen.
 */
async function aufraeumenWennFaellig(): Promise<void> {
  if (Date.now() - letzteAufraeumung < AUFRAEUMEN_ALLE_MS) return;
  letzteAufraeumung = Date.now();
  try {
    const tage = env().LOG_RETENTION_DAYS;
    const entfernt = await raeumeProtokollAuf(tage);
    if (entfernt > 0) {
      await log.info({
        source: "worker",
        message: `${entfernt} Protokolleinträge älter als ${tage} Tage entfernt`,
        context: { entfernt, tage },
      });
    }
  } catch (error) {
    await log.warn({
      source: "worker",
      message: "Aufräumen des Anwendungsprotokolls fehlgeschlagen",
      error,
    });
  }
}

async function claimJobs(limit: number): Promise<ClaimedJob[]> {
  // Alle Zeitstempel liegen als UTC ohne Zeitzone in der Datenbank; `now()`
  // wird deshalb explizit nach UTC gerechnet, damit die Zeitzone der
  // Datenbanksitzung keine Rolle spielt.
  return db.$queryRaw<ClaimedJob[]>`
    UPDATE mail_job
       SET status = 'SENDING', "updatedAt" = (now() AT TIME ZONE 'utc')
     WHERE id IN (
       SELECT j.id
         FROM mail_job j
         JOIN campaign c ON c.id = j."campaignId"
        WHERE j.status = 'PENDING'
          AND j."nextAttemptAt" <= (now() AT TIME ZONE 'utc')
          AND c.status = 'SENDING'
        ORDER BY j."nextAttemptAt" ASC
        FOR UPDATE OF j SKIP LOCKED
        LIMIT ${limit}
     )
    RETURNING id,
              "campaignId" AS campaign_id,
              "customerId" AS customer_id,
              "toEmail"    AS to_email,
              "toName"     AS to_name,
              attempts
  `;
}

async function processCampaignJobs(
  campaignId: string,
  jobs: ClaimedJob[],
): Promise<void> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: { template: true, attachments: true },
  });

  if (!campaign) {
    await db.mailJob.updateMany({
      where: { id: { in: jobs.map((j) => j.id) } },
      data: { status: "FAILED", error: "Kampagne wurde geloescht" },
    });
    return;
  }

  const account = await loadAccount(campaign.accountId);
  if (!account) {
    await failJobs(jobs, "Absenderkonto ist nicht mehr vorhanden");
    return;
  }

  let transport: Transporter;
  try {
    transport = createTransport(account);
  } catch (error) {
    const meldung = describeSmtpError(error);
    await failJobs(jobs, meldung);
    // Das trifft alle Empfaenger dieser Portion auf einmal — meist stimmt am
    // Mailkonto etwas nicht. Ohne Eintrag sucht man den Grund in den
    // einzelnen Jobs.
    await log.error({
      source: "mailer",
      message: `Verbindung zum Mailkonto „${account.fromEmail}" fehlgeschlagen: ${meldung}`,
      context: { kampagne: campaign.id, betroffeneJobs: jobs.length },
    });
    return;
  }

  const attachments = campaign.attachments.map((a) => ({
    filename: a.filename,
    content: Buffer.from(a.data),
    contentType: a.contentType,
  }));

  try {
    for (const job of jobs) {
      await sendOne({ job, campaign, account, transport, attachments });
    }
  } finally {
    transport.close();
  }
}

async function sendOne(input: {
  job: ClaimedJob;
  campaign: {
    id: string;
    subject: string;
    body: string;
    template: { body: string; isHtml: boolean } | null;
  };
  account: AccountWithProvider;
  transport: Transporter;
  attachments: { filename: string; content: Buffer; contentType: string }[];
}): Promise<void> {
  const { job, campaign, account, transport, attachments } = input;

  try {
    const vars = await buildCustomerVars(job.customer_id, job.to_name);
    const unsubscribeUrl = job.customer_id
      ? await unsubscribeUrlFor(job.customer_id)
      : undefined;

    const subject = renderPlaceholders(campaign.subject, vars, {
      escape: false,
    });
    const { html, text } = renderEmail({
      body: campaign.body,
      templateBody: campaign.template?.body ?? null,
      templateIsHtml: campaign.template?.isHtml ?? true,
      vars,
      unsubscribeUrl,
    });

    await transport.sendMail({
      from: { name: account.fromName, address: account.fromEmail },
      to: { name: job.to_name, address: job.to_email },
      replyTo: account.fromEmail,
      subject,
      html,
      text,
      attachments,
      headers: unsubscribeUrl
        ? {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          }
        : undefined,
    });

    await db.mailJob.update({
      where: { id: job.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        attempts: job.attempts + 1,
        error: null,
      },
    });
  } catch (error) {
    const attempts = job.attempts + 1;
    const permanent = isPermanentError(error);
    const exhausted = attempts >= env().MAIL_MAX_ATTEMPTS;
    const message = describeSmtpError(error);

    if (permanent || exhausted) {
      await db.mailJob.update({
        where: { id: job.id },
        data: { status: "FAILED", attempts, error: message },
      });
      await log.warn({
        source: "mailer",
        message: `Versand an ${job.to_email} endgültig fehlgeschlagen: ${message}`,
        context: {
          kampagne: campaign.id,
          versuche: attempts,
          grund: permanent ? "dauerhaft abgelehnt" : "Versuche erschöpft",
        },
      });
      // Dauerhaft abgelehnte Adressen werden markiert und kuenftig
      // uebersprungen, statt bei jeder Kampagne erneut zu scheitern.
      if (permanent && job.customer_id && /550|553|no such user|unknown/i.test(message)) {
        await db.customer
          .update({
            where: { id: job.customer_id },
            data: { bouncedAt: new Date() },
          })
          .catch(() => undefined);
      }
    } else {
      // Exponentielles Backoff: 1, 4, 9 Minuten.
      const delayMs = attempts * attempts * 60_000;
      await db.mailJob.update({
        where: { id: job.id },
        data: {
          status: "PENDING",
          attempts,
          error: message,
          nextAttemptAt: new Date(Date.now() + delayMs),
        },
      });
    }
  }
}


async function failJobs(jobs: ClaimedJob[], error: string): Promise<void> {
  await db.mailJob.updateMany({
    where: { id: { in: jobs.map((j) => j.id) } },
    data: { status: "FAILED", error },
  });
}

/** Kampagnen ohne offene Jobs werden abgeschlossen. */
async function finishCompletedCampaigns(): Promise<void> {
  const open = await db.campaign.findMany({
    where: { status: "SENDING" },
    select: { id: true },
  });
  for (const campaign of open) {
    const pending = await db.mailJob.count({
      where: {
        campaignId: campaign.id,
        status: { in: ["PENDING", "SENDING"] },
      },
    });
    if (pending === 0) {
      await db.campaign.update({
        where: { id: campaign.id },
        data: { status: "DONE", finishedAt: new Date() },
      });
    }
  }
}

/**
 * Haengengebliebene Jobs zuruecksetzen. Wird beim Start aufgerufen: wenn der
 * Container mitten im Versand neu startet, stehen Jobs auf SENDING, ohne dass
 * sie jemand bearbeitet.
 */
export async function recoverStuckJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - 10 * 60_000);
  const result = await db.mailJob.updateMany({
    where: { status: "SENDING", updatedAt: { lt: cutoff } },
    data: { status: "PENDING", nextAttemptAt: new Date() },
  });
  if (result.count > 0) {
    await log.warn({
      source: "worker",
      message: `${result.count} hängengebliebene Versandaufträge zurückgesetzt`,
      context: { anzahl: result.count },
    });
  }
  return result.count;
}
