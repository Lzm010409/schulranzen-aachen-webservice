import "server-only";
import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";
import { seasonLabel } from "./season";
import {
  buildSalutation,
  buildShortSalutation,
  type TemplateVars,
} from "./template";

/**
 * Platzhalterwerte zu einem Kunden.
 *
 * Eine Stelle fuer alle Wege: Versand, Testmail und Vorschau. Vorher stand
 * dieselbe Zuordnung dreimal im Code, und sie lief auseinander — die Vorschau
 * zeigte fest „Anna Beispiel", egal welcher Kunde gemeint war.
 *
 * Liefert immer den vollstaendigen Satz. Fehlt eine Angabe, steht dort ein
 * leerer Text und nicht `undefined`: ein fehlender Wert wuerde den Platzhalter
 * woertlich in der Mail stehen lassen.
 */

/** Auswahl, die fuer die Platzhalter gebraucht wird. */
export const mailVarsSelect = {
  salutation: true,
  firstName: true,
  lastName: true,
  city: true,
  zip: true,
  purchases: {
    orderBy: [{ purchasedAt: "desc" as const }, { createdAt: "desc" as const }],
    take: 1,
    select: {
      purchasedAt: true,
      season: true,
      product: {
        select: { name: true, category: { select: { name: true } } },
      },
    },
  },
} satisfies Prisma.CustomerSelect;

type Quelle = {
  salutation: "FRAU" | "HERR" | "UNBEKANNT";
  firstName: string;
  lastName: string;
  city: string;
  zip: string;
  purchases: {
    purchasedAt: Date | null;
    season: number | null;
    product: { name: string; category: { name: string } | null };
  }[];
};

/** Rechnet einen geladenen Kunden in Platzhalterwerte um. */
export function varsFromCustomer(customer: Quelle): TemplateVars {
  const letzter = customer.purchases[0];

  return {
    vorname: customer.firstName,
    nachname: customer.lastName,
    anrede: buildSalutation(
      customer.firstName,
      customer.lastName,
      customer.salutation,
    ),
    anrede_kurz: buildShortSalutation(customer.firstName),
    stadt: customer.city,
    plz: customer.zip,
    produkt: letzter?.product.name ?? "",
    warengruppe: letzter?.product.category?.name ?? "",
    kaufdatum: letzter?.purchasedAt
      ? letzter.purchasedAt.toLocaleDateString("de-DE")
      : "",
    saison: letzter?.season ? seasonLabel(letzter.season) : "",
  };
}

/**
 * Platzhalterwerte fuer einen Kunden aus der Datenbank.
 *
 * Ist der Kunde nicht mehr da — zwischen Einreihen und Versand kann er
 * geloescht worden sein —, traegt der beim Einreihen eingefrorene Name die
 * Anrede. Der Rest bleibt leer statt unaufgeloest.
 */
export async function buildCustomerVars(
  customerId: string | null,
  fallbackName = "",
): Promise<TemplateVars> {
  if (customerId) {
    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: mailVarsSelect,
    });
    if (customer) return varsFromCustomer(customer);
  }

  const name = fallbackName.trim();
  const teile = name.split(/\s+/).filter(Boolean);
  const vorname = teile.length > 1 ? teile.slice(0, -1).join(" ") : name;
  const nachname = teile.length > 1 ? teile[teile.length - 1] : "";

  return {
    vorname,
    nachname,
    anrede: buildSalutation(vorname, nachname),
    anrede_kurz: buildShortSalutation(vorname),
    stadt: "",
    plz: "",
    produkt: "",
    warengruppe: "",
    kaufdatum: "",
    saison: "",
  };
}

/**
 * Platzhalterwerte fuer eine Vorschau.
 *
 * Nimmt einen echten Kunden — vorzugsweise den uebergebenen, sonst irgendeinen
 * aus dem Bestand. Erst wenn es gar keinen gibt, stehen erfundene Werte da,
 * und dann sagt die Beschriftung das auch.
 */
export async function buildPreviewVars(customerId?: string | null): Promise<{
  vars: TemplateVars;
  quelle: string;
}> {
  const customer = customerId
    ? await db.customer.findUnique({
        where: { id: customerId },
        select: mailVarsSelect,
      })
    : await db.customer.findFirst({
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: mailVarsSelect,
      });

  if (customer) {
    return {
      vars: varsFromCustomer(customer),
      quelle: `${customer.firstName} ${customer.lastName}`.trim(),
    };
  }

  return {
    vars: {
      vorname: "Anna",
      nachname: "Beispiel",
      anrede: buildSalutation("Anna", "Beispiel", "FRAU"),
      anrede_kurz: buildShortSalutation("Anna"),
      stadt: "Aachen",
      plz: "52062",
      produkt: "Ergobag Cubo",
      warengruppe: "Schulranzen",
      kaufdatum: "14.08.2024",
      saison: "2024/25",
    },
    quelle: "",
  };
}
