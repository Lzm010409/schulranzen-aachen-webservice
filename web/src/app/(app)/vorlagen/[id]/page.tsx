import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/auth";
import {
  Card,
  PageHeader,
  formatDateTime,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Pagination } from "@/components/pagination";
import { readPaging } from "@/lib/pagination";
import { TemplateEditor } from "../template-editor";
import {
  deleteTemplateAction,
  duplicateTemplateAction,
  restoreVersionAction,
} from "../actions";

export const dynamic = "force-dynamic";

/** Vorgabe, solange nichts anderes gewählt wurde. */
const STANDARD_SEITENGROESSE = 10;

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

  const fassungen = await readPaging(flags, {
    pageParam: "fassung",
    fallbackSize: STANDARD_SEITENGROESSE,
  });

  const template = await db.mailTemplate.findUnique({ where: { id } });
  if (!template || template.deletedAt) notFound();

  const [versionTotal, versions] = await Promise.all([
    db.mailTemplateVersion.count({ where: { templateId: id } }),
    db.mailTemplateVersion.findMany({
      where: { templateId: id },
      orderBy: { version: "desc" },
      skip: fassungen.skip,
      take: fassungen.take,
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
              <SubmitButton busyLabel="Wird kopiert…">Duplizieren</SubmitButton>
            </form>
            <form action={deleteTemplateAction}>
              <input type="hidden" name="id" value={template.id} />
              <SubmitButton variant="error" busyLabel="Wird gelöscht…">
                Löschen
              </SubmitButton>
            </form>
          </>
        }
      />

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
                      <SubmitButton busyLabel="Wird wiederhergestellt…">
                        Wiederherstellen
                      </SubmitButton>
                    </form>
                  ) : (
                    <span className="text-xs text-slate-500">aktuell</span>
                  )}
                </li>
              ))}
            </ul>

            <Pagination
              page={fassungen.page}
              pageSize={fassungen.pageSize}
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
