import { db } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/auth";
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
  formatDateTime,
} from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { readPaging } from "@/lib/pagination";

export const metadata = { title: "Vorlagen" };
export const dynamic = "force-dynamic";

/** Vorgabe, solange nichts anderes gewählt wurde. */
const STANDARD_SEITENGROESSE = 25;

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermissionOrRedirect("vorlagen.ansehen");
  const params = await searchParams;
  const { page, pageSize, skip, take } = await readPaging(params, {
    fallbackSize: STANDARD_SEITENGROESSE,
  });

  const where = { deletedAt: null };
  const [total, templates] = await Promise.all([
    db.mailTemplate.count({ where }),
    db.mailTemplate.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: { _count: { select: { campaigns: true } } },
      skip,
      take,
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        description={`${total.toLocaleString("de-DE")} Vorlagen · Wiederverwendbare Layouts. Der Kampagnentext wird an der Stelle {{content}} eingesetzt.`}
        actions={
          <LinkButton href="/vorlagen/neu" variant="primary">
            Vorlage anlegen
          </LinkButton>
        }
      />

      <Card className="overflow-hidden">
        {templates.length === 0 ? (
          <EmptyState
            title="Noch keine Vorlage"
            description="Legen Sie ein Grundlayout mit Logo, Farben und Impressum an — jede Kampagne setzt dann nur noch ihren Text ein."
            action={
              <LinkButton href="/vorlagen/neu" variant="primary">
                Vorlage anlegen
              </LinkButton>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Betreff</Th>
                <Th>Kategorie</Th>
                <Th>Format</Th>
                <Th className="text-right">Verwendet</Th>
                <Th>Version</Th>
                <Th>Geändert</Th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-slate-50">
                  <Td>
                    <a
                      href={`/vorlagen/${template.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {template.name}
                    </a>
                  </Td>
                  <Td className="text-slate-600">{template.subject}</Td>
                  <Td className="text-slate-600">{template.category ?? "—"}</Td>
                  <Td>
                    {template.isHtml ? (
                      <Badge tone="blue">HTML</Badge>
                    ) : (
                      <Badge tone="slate">Text</Badge>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums text-slate-600">
                    {template._count.campaigns}
                  </Td>
                  <Td className="tabular-nums text-slate-600">
                    v{template.version}
                  </Td>
                  <Td className="whitespace-nowrap text-slate-600">
                    {formatDateTime(template.updatedAt)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        params={params}
      />
    </div>
  );
}
