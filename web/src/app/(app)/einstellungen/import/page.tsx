import { db } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/auth";
import { Card, Table, Td, Th, formatDateTime } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { readPaging } from "@/lib/pagination";
import { LegacyImportForm } from "./legacy-form";
import { TableImportForm } from "./table-form";

export const metadata = { title: "Import" };
export const dynamic = "force-dynamic";

/** Vorgabe, solange nichts anderes gewählt wurde. */
const STANDARD_SEITENGROESSE = 10;

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermissionOrRedirect("daten.importieren");
  const params = await searchParams;
  const { page, pageSize, skip, take } = await readPaging(params, {
    fallbackSize: STANDARD_SEITENGROESSE,
  });

  const [runTotal, runs] = await Promise.all([
    db.migrationRun.count(),
    db.migrationRun.findMany({
      orderBy: { startedAt: "desc" },
      skip,
      take,
    }),
  ]);

  return (
    <div className="space-y-6">
      <LegacyImportForm />
      <TableImportForm />

      {runTotal > 0 ? (
        <Card
          title={`Bisherige Übernahmen (${runTotal})`}
          description="Jeder Lauf wird protokolliert, auch die Trockenläufe."
        >
          <Table>
            <thead>
              <tr>
                <Th>Zeitpunkt</Th>
                <Th>Quelle</Th>
                <Th>Art</Th>
                <Th>Ergebnis</Th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const report = run.report as {
                  stats?: { customers?: number; purchases?: number };
                } | null;
                return (
                  <tr key={run.id}>
                    <Td className="muted">{formatDateTime(run.startedAt)}</Td>
                    <Td className="muted">
                      {run.source === "direct" ? "Direktverbindung" : "Dump-Datei"}
                    </Td>
                    <Td>{run.dryRun ? "Trockenlauf" : "Übernahme"}</Td>
                    <Td className="muted">
                      {run.error
                        ? `Fehler: ${run.error.slice(0, 120)}`
                        : report?.stats
                          ? `${report.stats.customers ?? 0} Kunden, ${report.stats.purchases ?? 0} Käufe`
                          : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={runTotal}
            params={params}
          />
        </Card>
      ) : null}
    </div>
  );
}
