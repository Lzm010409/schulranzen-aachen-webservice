import {
  isValidEmail,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeZip,
  productSlug,
} from "../normalize";
import { seasonOf } from "../season";
import type { LegacyData, LegacyKunde } from "./read-legacy";

/**
 * Rechnet den Altbestand in das neue Modell um. Bewusst frei von
 * Datenbankzugriffen, damit sich die Regeln testen lassen, ohne dass eine
 * Datenbank bereitsteht.
 */

export type PlannedProduct = {
  legacyIds: bigint[];
  name: string;
  slug: string;
};

export type PlannedPurchase = {
  legacyKundeId: bigint;
  productSlug: string | null;
  purchasedAt: Date | null;
  /** Einschulungsjahrgang, aus dem Kaufdatum abgeleitet (siehe lib/season.ts). */
  season: number | null;
};

export type PlannedCustomer = {
  /** Die kleinste alte ID der zusammengefuehrten Datensaetze. */
  legacyId: bigint;
  mergedLegacyIds: bigint[];
  firstName: string;
  lastName: string;
  street: string;
  zip: string;
  city: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  purchases: PlannedPurchase[];
};

export type Issue = {
  kind:
    | "ungueltige E-Mail"
    | "fehlende Pflichtangabe"
    | "unbekanntes Produkt"
    | "ungueltige PLZ"
    | "Produkt zusammengefuehrt"
    | "Kunde zusammengefuehrt";
  legacyId: string;
  detail: string;
};

export type TransformResult = {
  products: PlannedProduct[];
  customers: PlannedCustomer[];
  providers: {
    legacyId: bigint;
    name: string;
    host: string;
    port: number;
    security: "SSL" | "STARTTLS";
  }[];
  templates: {
    legacyId: bigint;
    name: string;
    subject: string;
    body: string;
    isHtml: boolean;
  }[];
  issues: Issue[];
  stats: {
    legacyProducts: number;
    legacyKunden: number;
    products: number;
    customers: number;
    purchases: number;
    mergedProducts: number;
    mergedCustomers: number;
    invalidEmails: number;
    droppedRows: number;
  };
};

/**
 * Schluessel fuer die Kundenzusammenfuehrung.
 *
 * Es werden zwei Schluessel gefuehrt: die E-Mail-Adresse als verlaesslichster
 * Hinweis und Name + PLZ + Strasse als Rueckfallebene. Beide zeigen auf
 * denselben Datensatz — sonst faenden sich eine Zeile mit und eine ohne
 * Adresse nicht, obwohl sie dieselbe Person meinen.
 */
function nameKey(customer: {
  firstName: string;
  lastName: string;
  zip: string;
  street: string;
}): string {
  return [
    "name",
    productSlug(customer.firstName),
    productSlug(customer.lastName),
    customer.zip,
    productSlug(customer.street),
  ].join(":");
}

export function transform(data: LegacyData): TransformResult {
  const issues: Issue[] = [];

  // ---------------------------------------------------------- Produkte
  // Gleichwertige Namen fallen ueber den Slug zusammen. Genau hier entstanden
  // im Altsystem Duplikate, weil die Freitexteingabe bei jedem Speichern einen
  // neuen Datensatz anlegte.
  const productBySlug = new Map<string, PlannedProduct>();
  const slugByLegacyId = new Map<string, string>();
  let mergedProducts = 0;

  for (const product of data.products) {
    const name = normalizeName(product.productName ?? "");
    if (!name) {
      issues.push({
        kind: "fehlende Pflichtangabe",
        legacyId: `product:${product.id}`,
        detail: "Produkt ohne Namen — uebersprungen",
      });
      continue;
    }
    const slug = productSlug(name);
    const existing = productBySlug.get(slug);
    if (existing) {
      existing.legacyIds.push(product.id);
      mergedProducts += 1;
      issues.push({
        kind: "Produkt zusammengefuehrt",
        legacyId: `product:${product.id}`,
        detail: `"${name}" faellt mit "${existing.name}" zusammen`,
      });
    } else {
      productBySlug.set(slug, { legacyIds: [product.id], name, slug });
    }
    slugByLegacyId.set(product.id.toString(), slug);
  }

  // ---------------------------------------------------------- Kunden
  const customersOut: PlannedCustomer[] = [];
  const byEmail = new Map<string, PlannedCustomer>();
  const byName = new Map<string, PlannedCustomer>();
  let invalidEmails = 0;
  let droppedRows = 0;

  // Nach alter ID sortieren, damit das Ergebnis bei jedem Lauf gleich ist.
  const sorted = [...data.kunden].sort((a, b) => (a.id < b.id ? -1 : 1));

  for (const kunde of sorted) {
    const firstName = normalizeName(kunde.vorname ?? "");
    const lastName = normalizeName(kunde.nachname ?? "");

    if (!firstName && !lastName) {
      droppedRows += 1;
      issues.push({
        kind: "fehlende Pflichtangabe",
        legacyId: `kunde:${kunde.id}`,
        detail: "weder Vor- noch Nachname — uebersprungen",
      });
      continue;
    }

    const zip = normalizeZip(kunde.plz);
    if (kunde.plz && zip.length !== 5) {
      issues.push({
        kind: "ungueltige PLZ",
        legacyId: `kunde:${kunde.id}`,
        detail: `"${kunde.plz}" ergibt keine 5-stellige PLZ`,
      });
    }

    let email = normalizeEmail(kunde.mail);
    if (email && !isValidEmail(email)) {
      invalidEmails += 1;
      issues.push({
        kind: "ungueltige E-Mail",
        legacyId: `kunde:${kunde.id}`,
        detail: `"${kunde.mail}" ist keine gueltige Adresse — als Notiz uebernommen`,
      });
    }

    // Ungueltige Adressen werden nicht weggeworfen, sondern in die Notiz
    // verschoben; sonst geht eine Information verloren, die sich vielleicht
    // noch von Hand retten laesst.
    const noteParts: string[] = [];
    if (email && !isValidEmail(email)) {
      noteParts.push(`Nicht uebernommene E-Mail aus dem Altsystem: ${email}`);
      email = null;
    }

    const slug = kunde.productId
      ? (slugByLegacyId.get(kunde.productId.toString()) ?? null)
      : null;
    if (kunde.productId && !slug) {
      issues.push({
        kind: "unbekanntes Produkt",
        legacyId: `kunde:${kunde.id}`,
        detail: `Produkt ${kunde.productId} existiert nicht — Kauf ohne Produkt`,
      });
    }

    const candidate: PlannedCustomer = {
      legacyId: kunde.id,
      mergedLegacyIds: [kunde.id],
      firstName: firstName || "—",
      lastName: lastName || "—",
      street: normalizeName(kunde.adresse ?? "") || "—",
      zip,
      city: normalizeName(kunde.stadt ?? "") || "—",
      email,
      phone: normalizePhone(kunde.tel),
      notes: noteParts.length > 0 ? noteParts.join("\n") : null,
      purchases: [],
    };

    const key = nameKey(candidate);
    const viaEmail = candidate.email ? byEmail.get(candidate.email) : undefined;
    const existing = viaEmail ?? byName.get(key);
    const reason = viaEmail ? "gleiche E-Mail" : "gleicher Name und Adresse";

    if (existing) {
      // Derselbe Kunde, weiterer Kauf. Genau dafuer gibt es jetzt Purchase.
      existing.mergedLegacyIds.push(kunde.id);
      existing.phone ??= candidate.phone;

      if (candidate.email) {
        if (!existing.email) {
          existing.email = candidate.email;
          byEmail.set(candidate.email, existing);
        } else if (existing.email !== candidate.email) {
          // Zwei Adressen fuer dieselbe Person: die erste bleibt, die zweite
          // wird nicht verworfen, sondern notiert.
          existing.notes = [
            existing.notes,
            `Weitere E-Mail aus dem Altsystem (kunde:${kunde.id}): ${candidate.email}`,
          ]
            .filter(Boolean)
            .join("\n");
        }
      }

      if (candidate.notes) {
        existing.notes = [existing.notes, candidate.notes]
          .filter(Boolean)
          .join("\n");
      }
      if (slug || kunde.kaufdatum) {
        existing.purchases.push({
          legacyKundeId: kunde.id,
          productSlug: slug,
          purchasedAt: kunde.kaufdatum,
          season: seasonOf(kunde.kaufdatum),
        });
      }
      issues.push({
        kind: "Kunde zusammengefuehrt",
        legacyId: `kunde:${kunde.id}`,
        detail: `faellt mit kunde:${existing.legacyId} zusammen (${reason})`,
      });
    } else {
      if (slug || kunde.kaufdatum) {
        candidate.purchases.push({
          legacyKundeId: kunde.id,
          productSlug: slug,
          purchasedAt: kunde.kaufdatum,
          season: seasonOf(kunde.kaufdatum),
        });
      }
      customersOut.push(candidate);
      byName.set(key, candidate);
      if (candidate.email) byEmail.set(candidate.email, candidate);
    }
  }

  const customers = customersOut;

  // ---------------------------------------------------------- Provider
  const providers = data.providers
    .filter((provider) => provider.smtpHost)
    .map((provider) => {
      const port = Number(provider.smtpPort ?? "465") || 465;
      // Das Altsystem setzte pauschal starttls.enable=true, auch auf Port 465.
      // Die Zuordnung wird hier anhand des Ports korrigiert.
      const security: "SSL" | "STARTTLS" = port === 465 ? "SSL" : "STARTTLS";
      return {
        legacyId: provider.id,
        name: normalizeName(provider.providerName ?? "") || `Provider ${provider.id}`,
        host: provider.smtpHost as string,
        port,
        security,
      };
    });

  // ---------------------------------------------------------- Vorlagen
  const templates = data.templates
    .filter((template) => template.name || template.body)
    .map((template) => ({
      legacyId: template.id,
      name: normalizeName(template.name ?? "") || `Vorlage ${template.id}`,
      subject: normalizeName(template.subject ?? "") || "(ohne Betreff)",
      // Der alte Platzhalter {Content} wird auf die neue Schreibweise gebracht.
      body: (template.body ?? "").replace(/\{\s*Content\s*\}/gi, "{{content}}"),
      isHtml: template.html ?? true,
    }));

  const purchases = customers.reduce((sum, c) => sum + c.purchases.length, 0);

  return {
    products: [...productBySlug.values()],
    customers,
    providers,
    templates,
    issues,
    stats: {
      legacyProducts: data.products.length,
      legacyKunden: data.kunden.length,
      products: productBySlug.size,
      customers: customers.length,
      purchases,
      mergedProducts,
      mergedCustomers: data.kunden.length - customers.length - droppedRows,
      invalidEmails,
      droppedRows,
    },
  };
}
