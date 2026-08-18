import { z } from "zod";
import {
  isValidEmail,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeZip,
} from "./normalize";

const requiredText = (label: string, max = 200) =>
  z
    .string()
    .transform(normalizeName)
    .pipe(
      z
        .string()
        .min(1, `${label} ist erforderlich`)
        .max(max, `${label} ist zu lang (max. ${max} Zeichen)`),
    );

const optionalText = (max = 500) =>
  z
    .string()
    .max(max)
    .transform((v) => {
      const t = v.trim();
      return t.length > 0 ? t : null;
    })
    .nullable()
    .catch(null);

export const customerSchema = z.object({
  firstName: requiredText("Vorname", 100),
  lastName: requiredText("Nachname", 100),
  street: requiredText("Adresse", 200),
  zip: z
    .string()
    .transform(normalizeZip)
    .pipe(z.string().regex(/^\d{5}$/, "PLZ muss aus 5 Ziffern bestehen")),
  city: requiredText("Stadt", 100),
  email: z
    .string()
    .optional()
    .transform((v) => normalizeEmail(v))
    .refine(
      (v) => v === null || isValidEmail(v),
      "Das ist keine gueltige E-Mail-Adresse",
    ),
  phone: z
    .string()
    .optional()
    .transform((v) => normalizePhone(v)),
  notes: optionalText(2000),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const purchaseSchema = z.object({
  productName: requiredText("Produkt", 150),
  purchasedAt: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }),
  note: optionalText(500),
});

export const productSchema = z.object({
  name: requiredText("Produktname", 150),
  category: optionalText(100),
  season: optionalText(50),
  active: z.coerce.boolean().default(true),
});

export const providerSchema = z.object({
  name: requiredText("Name", 100),
  host: requiredText("SMTP-Host", 200),
  port: z.coerce.number().int().min(1).max(65535),
  security: z.enum(["SSL", "STARTTLS"]),
});

export const mailAccountSchema = z.object({
  label: requiredText("Bezeichnung", 100),
  providerId: z.string().min(1, "Bitte einen Provider waehlen"),
  username: requiredText("Benutzername", 200),
  // Leer lassen heisst beim Bearbeiten: Passwort unveraendert uebernehmen.
  password: z.string().default(""),
  fromEmail: z
    .string()
    .transform((v) => normalizeEmail(v) ?? "")
    .pipe(z.string().refine(isValidEmail, "Ungueltige Absenderadresse")),
  fromName: requiredText("Absendername", 100),
  isDefault: z.coerce.boolean().default(false),
});

export const templateSchema = z.object({
  name: requiredText("Name", 150),
  subject: requiredText("Betreff", 300),
  body: z.string().min(1, "Der Inhalt darf nicht leer sein").max(200_000),
  isHtml: z.coerce.boolean().default(true),
  category: optionalText(100),
});

export const userSchema = z.object({
  name: requiredText("Name", 120),
  email: z
    .string()
    .transform((v) => normalizeEmail(v) ?? "")
    .pipe(z.string().refine(isValidEmail, "Ungueltige E-Mail-Adresse")),
  role: z.enum(["ADMIN", "MITARBEITER"]),
  password: z.string().default(""),
  active: z.coerce.boolean().default(true),
  // Einzelrechte; werden in der Action gegen den Katalog geprueft.
  permissions: z.array(z.string()).default([]),
});

export const passwordSchema = z
  .string()
  .min(10, "Das Passwort muss mindestens 10 Zeichen lang sein")
  .max(200);

export const campaignSchema = z.object({
  name: requiredText("Kampagnenname", 150),
  subject: requiredText("Betreff", 300),
  body: z.string().max(200_000).default(""),
  templateId: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  accountId: z.string().min(1, "Bitte ein Absenderkonto waehlen"),
});

/**
 * Uebersetzt einen ZodError in ein Feld → Meldung-Objekt, wie es die Formulare
 * erwarten.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
