import { z } from "zod";

/**
 * Zentrale Konfiguration. Faellt die Validierung durch, bricht der Start ab —
 * besser als eine App, die erst beim ersten Mailversand merkt, dass ein
 * Schluessel fehlt.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL fehlt"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET muss mindestens 32 Zeichen lang sein"),
  ENCRYPTION_KEY: z
    .string()
    .refine(
      (v) => Buffer.from(v, "base64").length === 32,
      "ENCRYPTION_KEY muss 32 Bytes base64-kodiert sein (openssl rand -base64 32)",
    ),
  APP_URL: z.string().url().default("http://localhost:3000"),
  MAIL_RATE_PER_MINUTE: z.coerce.number().int().positive().default(20),
  MAIL_WORKER_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v !== "false" && v !== "0"),
  MAIL_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  /// Wie lange Eintraege im Anwendungsprotokoll stehen bleiben.
  LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
});

let cached: z.infer<typeof schema> | null = null;

export function env() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Konfiguration unvollstaendig:\n${details}`);
  }
  cached = parsed.data;
  return cached;
}
