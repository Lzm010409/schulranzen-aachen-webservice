import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startSmtpSink, type ReceivedMail } from "./smtp-sink";

/**
 * Integrationstest der Versand-Pipeline gegen einen echten SMTP-Server und
 * eine echte Datenbank. Prueft genau die Punkte, an denen das Altsystem
 * schwach war: Fehler pro Empfaenger, Ueberspringen nicht erreichbarer
 * Kontakte, Abmeldelink und Schutz vor Doppelversand.
 *
 * Laeuft nur mit gesetzter DATABASE_URL; ohne Datenbank wird uebersprungen.
 */

const PORT = 24650;
const hasDatabase = Boolean(process.env.DATABASE_URL);

// Selbstsigniertes Testzertifikat.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
process.env.SESSION_SECRET ??= "test-session-secret-mit-mindestens-32-zeichen";
process.env.ENCRYPTION_KEY ??= "ZGV2LW9ubHkta2V5LTMyLWJ5dGVzLWxvbmctMDAwMDA=";
process.env.APP_URL ??= "http://127.0.0.1:3000";
process.env.MAIL_RATE_PER_MINUTE = "600";

describe.skipIf(!hasDatabase)("Versand-Pipeline", () => {
  let sink: Awaited<ReturnType<typeof startSmtpSink>>;
  let db: Awaited<typeof import("../db")>["db"];
  let queue: typeof import("../queue");
  let worker: typeof import("../worker");

  const stamp = Date.now().toString(36);
  // Alle Adressen tragen die Laufkennung: sonst greifen Suchen auf Reste
  // frueherer Laeufe zu und der Test wird unzuverlaessig.
  const REJECTED = `kaputt.${stamp}@example.de`;
  const ids: {
    campaign?: string;
    template?: string;
    product?: string;
    account?: string;
    provider?: string;
    customers: string[];
  } = { customers: [] };

  let mail: ReceivedMail | undefined;
  let decoded = "";
  let enqueued: Awaited<ReturnType<typeof queue.enqueueRecipients>>;
  let progress: Awaited<ReturnType<typeof queue.campaignProgress>>;

  beforeAll(async () => {
    sink = await startSmtpSink({ port: PORT, rejectFor: [REJECTED] });
    db = (await import("../db")).db;
    queue = await import("../queue");
    worker = await import("../worker");

    const provider = await db.provider.create({
      data: {
        name: `Testserver ${stamp}`,
        host: "127.0.0.1",
        port: PORT,
        security: "SSL",
      },
    });
    ids.provider = provider.id;

    const { encryptSecret } = await import("../crypto");
    const account = await db.mailAccount.create({
      data: {
        label: `Testkonto ${stamp}`,
        providerId: provider.id,
        username: "test@example.de",
        passwordEnc: encryptSecret("geheim"),
        fromEmail: "info@schulranzen-aachen.de",
        fromName: "Schulranzen-Aachen",
      },
    });
    ids.account = account.id;

    const product = await db.product.create({
      data: { name: `Testranzen ${stamp}`, slug: `testranzen-${stamp}` },
    });
    ids.product = product.id;

    const people = [
      {
        first: "Erika",
        last: "Empfang",
        email: `erika.${stamp}@example.de`,
        salutation: "FRAU" as const,
      },
      { first: "Klaus", last: "Kaputt", email: REJECTED },
      { first: "Ohne", last: "Adresse", email: null },
      {
        first: "Abge",
        last: "Meldet",
        email: `abge.${stamp}@example.de`,
        unsubscribed: true,
      },
      {
        first: "Bounce",
        last: "Bert",
        email: `bert.${stamp}@example.de`,
        bounced: true,
      },
    ];

    for (const person of people) {
      const customer = await db.customer.create({
        data: {
          salutation: person.salutation ?? "UNBEKANNT",
          firstName: person.first,
          lastName: person.last,
          street: "Teststr. 1",
          zip: "52062",
          city: "Aachen",
          email: person.email,
          unsubscribedAt: person.unsubscribed ? new Date() : null,
          bouncedAt: person.bounced ? new Date() : null,
          purchases: {
            create: {
              productId: product.id,
              purchasedAt: new Date("2024-08-14"),
            },
          },
        },
      });
      ids.customers.push(customer.id);
    }

    const template = await db.mailTemplate.create({
      data: {
        name: `Testvorlage ${stamp}`,
        subject: "Test",
        body: "<div><p>{{anrede}},</p>{{content}}</div>",
        isHtml: true,
      },
    });
    ids.template = template.id;

    const admin = await db.user.findFirstOrThrow({ where: { role: "ADMIN" } });

    const campaign = await db.campaign.create({
      data: {
        name: `Testkampagne ${stamp}`,
        subject: "Angebot für {{vorname}}",
        body: "Sie haben {{produkt}} gekauft.",
        templateId: template.id,
        accountId: account.id,
        createdById: admin.id,
        attachments: {
          create: {
            filename: "hinweis.txt",
            contentType: "text/plain",
            size: 5,
            data: Buffer.from("Hallo"),
          },
        },
      },
    });
    ids.campaign = campaign.id;

    enqueued = await queue.enqueueRecipients(campaign.id, {
      customerIds: ids.customers,
    });

    await db.campaign.update({
      where: { id: campaign.id },
      data: { status: "SENDING", startedAt: new Date() },
    });

    for (let i = 0; i < 10; i++) {
      await worker.tick();
      if ((await queue.campaignProgress(campaign.id)).finished) break;
    }

    progress = await queue.campaignProgress(campaign.id);
    mail = sink.received[0];
    decoded = (mail?.raw ?? "")
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-F]{2})/g, (_, hex: string) =>
        String.fromCharCode(parseInt(hex, 16)),
      );
  }, 120_000);

  afterAll(async () => {
    if (db && !process.env.KEEP_TEST_DATA) {
      if (ids.campaign)
        await db.campaign.delete({ where: { id: ids.campaign } }).catch(() => {});
      if (ids.template)
        await db.mailTemplate
          .delete({ where: { id: ids.template } })
          .catch(() => {});
      await db.customer
        .deleteMany({ where: { id: { in: ids.customers } } })
        .catch(() => {});
      if (ids.product)
        await db.product.delete({ where: { id: ids.product } }).catch(() => {});
      if (ids.account)
        await db.mailAccount
          .delete({ where: { id: ids.account } })
          .catch(() => {});
      if (ids.provider)
        await db.provider.delete({ where: { id: ids.provider } }).catch(() => {});
      await db.$disconnect();
    }
    sink?.close();
  }, 60_000);

  it("reiht nur erreichbare Empfänger ein", () => {
    expect(enqueued.queued).toBe(2);
    expect(enqueued.skipped["keine E-Mail-Adresse"]).toBe(1);
    expect(enqueued.skipped["abgemeldet"]).toBe(1);
    expect(enqueued.skipped["Zustellung dauerhaft fehlgeschlagen"]).toBe(1);
  });

  it("erzeugt beim zweiten Einreihen keinen Doppelversand", async () => {
    const again = await queue.enqueueRecipients(ids.campaign!, {
      customerIds: ids.customers,
    });
    expect(again.queued).toBe(0);
  });

  it("stellt zu und hält Fehler pro Empfänger fest", async () => {
    expect(progress.SENT).toBe(1);
    expect(progress.FAILED).toBe(1);
    expect(progress.finished).toBe(true);

    const failed = await db.mailJob.findFirstOrThrow({
      where: { campaignId: ids.campaign!, status: "FAILED" },
    });
    expect(failed.toEmail).toBe(REJECTED);
    expect(failed.error).toBeTruthy();
  });

  it("markiert dauerhaft abgelehnte Adressen als Bounce", async () => {
    // Ueber die ID, nicht ueber die Adresse — die ID gehoert eindeutig zu
    // diesem Lauf.
    const bounced = await db.customer.findUniqueOrThrow({
      where: { id: ids.customers[1] },
    });
    expect(bounced.email).toBe(REJECTED);
    expect(bounced.bouncedAt).not.toBeNull();
  });

  it("versendet genau eine Mail mit gefüllten Platzhaltern", () => {
    expect(sink.received).toHaveLength(1);
    // Die Anrede kommt aus dem Feld am Kunden und geht durch die ganze
    // Strecke: Datenbank → Worker → SMTP.
    expect(decoded).toContain("Sehr geehrte Frau Empfang");
    // Kein Platzhalter darf woertlich beim Empfaenger ankommen.
    expect(decoded).not.toMatch(/\{\{\s*[a-z_]+\s*\}\}/i);
    expect(decoded).toContain(`Testranzen ${stamp}`);
  });

  it("setzt Abmeldelink und List-Unsubscribe-Header", () => {
    expect(mail?.raw ?? "").toMatch(/List-Unsubscribe:\s*</i);
    expect(mail?.raw ?? "").toMatch(/List-Unsubscribe-Post/i);
    expect(decoded).toContain("/abmelden/");
  });

  it("hängt Anhänge und eine Textfassung an", () => {
    expect(mail?.raw ?? "").toContain("hinweis.txt");
    expect((mail?.raw ?? "").toLowerCase()).toContain("text/plain");
  });

  it("wiederholt nur die fehlgeschlagenen Zustellungen", async () => {
    const retried = await queue.retryFailed(ids.campaign!);
    expect(retried).toBe(1);

    const after = await queue.campaignProgress(ids.campaign!);
    expect(after.SENT).toBe(1);
    expect(after.PENDING).toBe(1);
  });
});
