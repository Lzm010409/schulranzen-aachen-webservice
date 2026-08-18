import { db } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/auth";
import { Card, Table, Td, Th, formatDateTime } from "@/components/ui";
import { LegacyImportForm } from "./legacy-form";
import { TableImportForm } from "./table-form";

export const metadata = { title: "Import" };
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requirePermissionOrRedirect("daten.importieren");

  const runs = await db.migrationRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <LegacyImportForm />
      <TableImportForm />

      {runs.length > 0 ? (
        <Card
          title="Bisherige Übernahmen"
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
        </Card>
      ) : null}
    </div>
  );
}
