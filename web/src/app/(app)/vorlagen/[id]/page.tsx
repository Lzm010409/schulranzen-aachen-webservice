import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/auth";
import {
  Alert,
  Button,
  Card,
  PageHeader,
  formatDateTime,
} from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { TemplateEditor } from "../template-editor";
import {
  deleteTemplateAction,
  duplicateTemplateAction,
  restoreVersionAction,
} from "../actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function TemplateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermissionOrRedirect("vorlagen.verwalten");
  const { id } = await params;
  const flags = await searchParams;

  const versionPage = Math.max(1, Number(flags.fassung ?? 1) || 1);

  const template = await db.mailTemplate.findUnique({ where: { id } });
  if (!template || template.deletedAt) notFound();

  const [versionTotal, versions] = await Promise.all([
    db.mailTemplateVersion.count({ where: { templateId: id } }),
    db.mailTemplateVersion.findMany({
      where: { templateId: id },
      orderBy: { version: "desc" },
      skip: (versionPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={template.name}
        description={`Version ${template.version} · zuletzt geändert ${formatDateTime(template.updatedAt)}`}
        actions={
          <>
            <form action={duplicateTemplateAction}>
              <input type="hidden" name="id" value={template.id} />
              <Button type="submit">Duplizieren</Button>
            </form>
            <form action={deleteTemplateAction}>
              <input type="hidden" name="id" value={template.id} />
              <Button type="submit" variant="error">
                Löschen
              </Button>
            </form>
          </>
        }
      />

      {flags.gespeichert ? (
        <div className="mb-4">
          <Alert variant="success">Die Vorlage wurde gespeichert.</Alert>
        </div>
      ) : null}

      <TemplateEditor
        cancelHref="/vorlagen"
        values={{
          id: template.id,
          name: template.name,
          subject: template.subject,
          body: template.body,
          isHtml: template.isHtml,
          category: template.category ?? "",
        }}
      />

      {versionTotal > 1 ? (
        <div className="mt-6">
          <Card
            title={`Frühere Fassungen (${versionTotal})`}
            description="Wiederherstellen legt eine neue Version an; nichts geht verloren."
          >
            <ul className="divide-y divide-slate-100">
              {versions.map((version) => (
                <li
                  key={version.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      v{version.version} · {version.subject}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(version.createdAt)}
                    </p>
                  </div>
                  {version.version !== template.version ? (
                    <form action={restoreVersionAction}>
                      <input
                        type="hidden"
                        name="versionId"
                        value={version.id}
                      />
                      <Button type="submit">Wiederherstellen</Button>
                    </form>
                  ) : (
                    <span className="text-xs text-slate-500">aktuell</span>
                  )}
                </li>
              ))}
            </ul>

            <Pagination
              page={versionPage}
              pageSize={PAGE_SIZE}
              total={versionTotal}
              params={flags}
              paramName="fassung"
            />
          </Card>
        </div>
      ) : null}
    </div>
  );
}
