import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startSmtpSink, type ReceivedMail } from "./smtp-sink";

/**
 * Prueft die Testmail eines Absenderkontos gegen einen echten SMTP-Server.
 * `verify()` bestaetigt nur die Anmeldung — erst eine zugestellte Nachricht
 * zeigt, dass der Provider den Absender akzeptiert.
 */

const PORT = 24651;
const hasDatabase = Boolean(process.env.DATABASE_URL);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
process.env.SESSION_SECRET ??= "test-session-secret-mit-mindestens-32-zeichen";
process.env.ENCRYPTION_KEY ??= "ZGV2LW9ubHkta2V5LTMyLWJ5dGVzLWxvbmctMDAwMDA=";
process.env.APP_URL ??= "http://127.0.0.1:3000";

describe.skipIf(!hasDatabase)("Testmail eines Absenderkontos", () => {
  let sink: Awaited<ReturnType<typeof startSmtpSink>>;
  let db: Awaited<typeof import("../db")>["db"];
  const stamp = Date.now().toString(36);
  const ids: { account?: string; provider?: string } = {};
  const REJECTED = `abgelehnt.${stamp}@example.de`;
  let received: ReceivedMail | undefined;
  let verifyResult: { ok: boolean } | { ok: false; error: string } | undefined;

  beforeAll(async () => {
    sink = await startSmtpSink({ port: PORT, rejectFor: [REJECTED] });
    db = (await import("../db")).db;

    const { encryptSecret } = await import("../crypto");
    const provider = await db.provider.create({
      data: {
        name: `Testmailserver ${stamp}`,
        host: "127.0.0.1",
        port: PORT,
        security: "SSL",
      },
    });
    ids.provider = provider.id;

    const account = await db.mailAccount.create({
      data: {
        label: `Testmailkonto ${stamp}`,
        providerId: provider.id,
        username: "test@example.de",
        passwordEnc: encryptSecret("geheim"),
        fromEmail: "info@schulranzen-aachen.de",
        fromName: "Schulranzen-Aachen",
      },
    });
    ids.account = account.id;

    const { createTransport, loadAccount, verifyAccount } = await import(
      "../mailer"
    );
    const loaded = await loadAccount(account.id);
    verifyResult = await verifyAccount(loaded!);

    const transport = createTransport(loaded!);
    try {
      await transport.sendMail({
        from: { name: loaded!.fromName, address: loaded!.fromEmail },
        to: `empfang.${stamp}@example.de`,
        subject: "Testmail aus dem Schulranzen-Aachen-Webservice",
        text: "Diese Testmail bestaetigt, dass der Versand funktioniert.",
        html: "<p>Diese Testmail bestätigt, dass der Versand funktioniert.</p>",
      });
    } finally {
      transport.close();
    }
    received = sink.received[0];
  }, 60_000);

  afterAll(async () => {
    if (db) {
      if (ids.account)
        await db.mailAccount.delete({ where: { id: ids.account } }).catch(() => {});
      if (ids.provider)
        await db.provider.delete({ where: { id: ids.provider } }).catch(() => {});
      await db.$disconnect();
    }
    sink?.close();
  }, 30_000);

  it("bestätigt die Verbindung ohne Versand", () => {
    expect(verifyResult?.ok).toBe(true);
    // verify() darf nichts zustellen — im Altsystem verschickte der "Login"
    // eine echte Mail an den Nutzer selbst.
    expect(sink.received).toHaveLength(1);
  });

  it("stellt die Testmail mit dem hinterlegten Absender zu", () => {
    expect(received).toBeDefined();
    expect(received!.to).toBe(`empfang.${stamp}@example.de`);
    expect(received!.raw).toMatch(/From:.*info@schulranzen-aachen\.de/);
  });

  it("verschickt Text- und HTML-Fassung", () => {
    const raw = (received?.raw ?? "").toLowerCase();
    expect(raw).toContain("text/plain");
    expect(raw).toContain("text/html");
  });

  it("trägt einen aussagekräftigen Betreff", () => {
    const decoded = (received?.raw ?? "")
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-F]{2})/g, (_, hex: string) =>
        String.fromCharCode(parseInt(hex, 16)),
      );
    expect(decoded).toMatch(/Subject:.*Testmail/i);
  });

  it("meldet einen abgelehnten Empfänger verständlich", async () => {
    const { createTransport, describeSmtpError, loadAccount } = await import(
      "../mailer"
    );
    const loaded = await loadAccount(ids.account!);
    const transport = createTransport(loaded!);
    let message = "";
    try {
      await transport.sendMail({
        from: { name: loaded!.fromName, address: loaded!.fromEmail },
        to: REJECTED,
        subject: "Test",
        text: "Test",
      });
    } catch (error) {
      message = describeSmtpError(error);
    } finally {
      transport.close();
    }
    expect(message).toMatch(/abgelehnt|550/i);
  }, 30_000);
});
