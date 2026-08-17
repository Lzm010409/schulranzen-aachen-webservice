/**
 * Legt den ersten Administrator und die gaengigen SMTP-Provider an.
 * Idempotent — mehrfaches Ausfuehren ist unschaedlich.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { hashPassword } from "../src/lib/crypto.js";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PROVIDERS = [
  { name: "IONOS", host: "smtp.ionos.de", port: 465, security: "SSL" as const },
  { name: "Strato", host: "smtp.strato.de", port: 465, security: "SSL" as const },
  {
    name: "Vodafone",
    host: "smtp.vodafonemail.de",
    port: 465,
    security: "SSL" as const,
  },
  { name: "1&1", host: "smtp.1und1.de", port: 465, security: "SSL" as const },
  {
    name: "Telekom",
    host: "securesmtp.t-online.de",
    port: 465,
    security: "SSL" as const,
  },
  {
    name: "Gmail",
    host: "smtp.gmail.com",
    port: 465,
    security: "SSL" as const,
  },
  {
    name: "Microsoft 365",
    host: "smtp.office365.com",
    port: 587,
    security: "STARTTLS" as const,
  },
];

const STANDARD_TEMPLATE = `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px">
        <tr><td style="padding:24px 32px;border-bottom:1px solid #e4e4e7">
          <strong style="font-size:18px">Schulranzen-Aachen</strong>
        </td></tr>
        <tr><td style="padding:32px;font-size:15px;line-height:1.6">
          <p>{{anrede}},</p>
          {{content}}
          <p style="margin-top:24px">Herzliche Gruesse<br>Ihr Team von Schulranzen-Aachen</p>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a">
          <p style="margin:0 0 8px">Schulranzen-Aachen · Musterstrasse 1 · 52062 Aachen</p>
          <p style="margin:0">Keine weiteren E-Mails? <a href="{{abmeldelink}}" style="color:#71717a">Hier abmelden</a>.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@schulranzen-aachen.de")
    .trim()
    .toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password.length < 10) {
    throw new Error(
      "ADMIN_PASSWORD muss gesetzt und mindestens 10 Zeichen lang sein.",
    );
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Administrator ${email} existiert bereits — unveraendert.`);
  } else {
    await db.user.create({
      data: {
        email,
        name: process.env.ADMIN_NAME ?? "Administrator",
        role: "ADMIN",
        passwordHash: await hashPassword(password),
      },
    });
    console.log(`Administrator ${email} angelegt.`);
  }

  for (const provider of PROVIDERS) {
    await db.provider.upsert({
      where: { name: provider.name },
      update: {},
      create: provider,
    });
  }
  console.log(`${PROVIDERS.length} Provider sichergestellt.`);

  const templateCount = await db.mailTemplate.count();
  if (templateCount === 0) {
    await db.mailTemplate.create({
      data: {
        name: "Standard-Layout",
        subject: "Neuigkeiten von Schulranzen-Aachen",
        body: STANDARD_TEMPLATE,
        isHtml: true,
        category: "Basis",
      },
    });
    console.log("Standardvorlage angelegt.");
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
