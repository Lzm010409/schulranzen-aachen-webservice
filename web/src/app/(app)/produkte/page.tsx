import { db } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  Badge,
  Card,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Pagination } from "@/components/pagination";
import { deleteProductAction } from "./actions";
import { ProductEditor } from "./product-editor";
import { MergeForm } from "./merge-form";
import { CategoryManager } from "./category-manager";
import { CategoryFilter } from "./category-filter";

export const metadata = { title: "Produkte" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermissionOrRedirect("produkte.ansehen");
  const mayManage = can(user, "produkte.verwalten");
  const params = await searchParams;
  const page = Math.max(1, Number(params.seite ?? 1) || 1);

  // Nach Warengruppe filtern — die häufigste Frage am Katalog.
  const categoryId = typeof params.gruppe === "string" ? params.gruppe : "";
  const where = categoryId ? { categoryId } : {};

  const [total, products, mergeChoices, categories] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { purchases: true } },
        category: { select: { id: true, name: true } },
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    // Zum Zusammenführen braucht die Auswahl alle Produkte, nicht nur die
    // Seite — sonst liesse sich nur innerhalb einer Seite zusammenfassen.
    db.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        _count: { select: { purchases: true } },
      },
    }),
    // Auch inaktive zeigen: sie stehen noch an Produkten und sollen sich
    // wieder aktivieren lassen.
    db.productCategory.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        sortOrder: true,
        active: true,
        _count: { select: { products: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        description={`${total.toLocaleString("de-DE")} Produkte · Der Katalog hinter den Käufen. Gleiche Namen werden über einen normalisierten Schlüssel zusammengehalten.`}
        actions={<CategoryFilter categories={categories} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            {products.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Noch keine Produkte. Sie entstehen automatisch, sobald ein Kauf
                erfasst wird.
              </p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Warengruppe</Th>
                    <Th>Modelljahr</Th>
                    <Th className="text-right">Käufe</Th>
                    <Th>Status</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50">
                      <Td>
                        <span className="font-medium text-slate-900">
                          {product.name}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {product.slug}
                        </span>
                      </Td>
                      <Td className="text-slate-600">
                        {product.category?.name ?? "—"}
                      </Td>
                      <Td className="tabular-nums text-slate-600">
                        {product.modelYear ?? "—"}
                      </Td>
                      <Td className="text-right tabular-nums">
                        <a
                          href={`/kunden?productId=${product.id}`}
                          className="text-brand-700 hover:underline"
                        >
                          {product._count.purchases}
                        </a>
                      </Td>
                      <Td>
                        {product.active ? (
                          <Badge tone="green">aktiv</Badge>
                        ) : (
                          <Badge tone="slate">inaktiv</Badge>
                        )}
                      </Td>
                      <Td className="text-right">
                        {mayManage ? (
                        <div className="flex justify-end gap-1">
                          <ProductEditor
                            trigger="Bearbeiten"
                            categories={categories}
                            product={{
                              id: product.id,
                              name: product.name,
                              categoryId: product.categoryId ?? "",
                              modelYear: product.modelYear?.toString() ?? "",
                              active: product.active,
                            }}
                          />
                          <form action={deleteProductAction}>
                            <input
                              type="hidden"
                              name="id"
                              value={product.id}
                            />
                            <SubmitButton variant="tertiary" busyLabel="Einen Moment…">
                              {product._count.purchases > 0
                                ? "Deaktivieren"
                                : "Löschen"}
                            </SubmitButton>
                          </form>
                        </div>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            params={params}
          />
        </div>

        {mayManage ? (
        <div className="space-y-6">
          <Card title="Neues Produkt">
            <ProductEditor
              trigger="Produkt anlegen"
              variant="primary"
              product={null}
              categories={categories}
            />
          </Card>

          <Card
            title="Warengruppen"
            description="Kurze, gepflegte Liste statt Freitext — sonst stehen „Ranzen“ und „Schulranzen“ nebeneinander."
          >
            <CategoryManager
              categories={categories.map((entry) => ({
                id: entry.id,
                name: entry.name,
                sortOrder: entry.sortOrder,
                active: entry.active,
                products: entry._count.products,
              }))}
            />
          </Card>

          <Card
            title="Duplikate zusammenführen"
            description="Alle Käufe der Quelle wandern zum Ziel, die Quelle wird gelöscht."
          >
            <MergeForm
              products={mergeChoices.map((p) => ({
                id: p.id,
                name: p.name,
                count: p._count.purchases,
              }))}
            />
          </Card>
        </div>
        ) : null}
      </div>
    </div>
  );
}
