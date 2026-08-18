import { db } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/auth";
import { Card, Table, Td, Th, formatDateTime } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { LegacyImportForm } from "./legacy-form";
import { TableImportForm } from "./table-form";

export const metadata = { title: "Import" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermissionOrRedirect("daten.importieren");
  const params = await searchParams;
  const page = Math.max(1, Number(params.seite ?? 1) || 1);

  const [runTotal, runs] = await Promise.all([
    db.migrationRun.count(),
    db.migrationRun.findMany({
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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
            pageSize={PAGE_SIZE}
            total={runTotal}
            params={params}
          />
        </Card>
      ) : null}
    </div>
  );
}
