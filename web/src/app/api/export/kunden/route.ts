import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { SALUTATION_LABEL } from "@/lib/template";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { buildWhere, parseFilter } from "@/lib/customer-filter";
import { customerPages, type CustomerListRow } from "@/lib/customers";
import {
  csvStream,
  exportFilename,
  xlsxBuffer,
  type ExportColumn,
} from "@/lib/export";

export const dynamic = "force-dynamic";

const COLUMNS: ExportColumn<CustomerListRow>[] = [
  {
    header: "Anrede",
    value: (c) => SALUTATION_LABEL[c.salutation] ?? "",
    width: 12,
  },
  { header: "Vorname", value: (c) => c.firstName, width: 18 },
  { header: "Nachname", value: (c) => c.lastName, width: 20 },
  { header: "Adresse", value: (c) => c.street, width: 30 },
  { header: "PLZ", value: (c) => c.zip, width: 10 },
  { header: "Stadt", value: (c) => c.city, width: 20 },
  { header: "E-Mail", value: (c) => c.email ?? "", width: 28 },
  { header: "Telefon", value: (c) => c.phone ?? "", width: 18 },
  {
    header: "Produkte",
    value: (c) => c.purchases.map((p) => p.product.name).join(" | "),
    width: 30,
  },
  {
    header: "Kaufdaten",
    value: (c) =>
      c.purchases
        .map((p) =>
          p.purchasedAt ? p.purchasedAt.toLocaleDateString("de-DE") : "",
        )
        .filter(Boolean)
        .join(" | "),
    width: 24,
  },
  {
    header: "Warengruppen",
    value: (c) =>
      [
        ...new Set(
          c.purchases
            .map((p) => p.product.category?.name)
            .filter((name): name is string => Boolean(name)),
        ),
      ].join(" | "),
    width: 22,
  },
  {
    // Der Einschulungsjahrgang ist die Zahl, nach der die Zielgruppen für den
    // nächsten Rundbrief geschnitten werden — er gehört in den Export.
    header: "Saison",
    value: (c) =>
      [...new Set(c.purchases.map((p) => p.season).filter(Boolean))].join(" | "),
    width: 14,
  },
  {
    header: "Newsletter",
    value: (c) => (c.unsubscribedAt ? "abgemeldet" : "aktiv"),
    width: 14,
  },
];

/**
 * Exportiert genau die Datensaetze, die der uebergebene Filter trifft — nicht
 * pauschal den gesamten Bestand. Jeder Export wird protokolliert, weil hier
 * personenbezogene Daten das System verlassen.
 */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return new Response("Nicht angemeldet", { status: 401 });
  }
  if (!can(user, "kunden.exportieren")) {
    return new Response("Keine Berechtigung zum Exportieren", { status: 403 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filter = parseFilter(params);
  const where = buildWhere(filter);
  const format = params.format === "xlsx" ? "xlsx" : "csv";

  const rowCount = await db.customer.count({ where });

  await recordAudit({
    userId: user.id,
    entity: "Customer",
    action: "EXPORT",
    diff: { format, rowCount, filter },
  });
  await db.exportLog.create({
    data: { userId: user.id, format, rowCount, filter },
  });

  if (format === "xlsx") {
    const buffer = await xlsxBuffer(COLUMNS, customerPages(where), "Kunden");
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exportFilename("kunden", "xlsx")}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(csvStream(COLUMNS, customerPages(where)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename("kunden", "csv")}"`,
      "Cache-Control": "no-store",
    },
  });
}
