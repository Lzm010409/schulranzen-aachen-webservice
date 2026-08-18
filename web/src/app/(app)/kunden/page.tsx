import { db } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  buildWhere,
  describeFilter,
  filterToSearchParams,
  isEmptyFilter,
  parseFilter,
} from "@/lib/customer-filter";
import { customerListSelect } from "@/lib/customers";
import {
  Badge,
  Card,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
} from "@/components/ui";
import { CustomerFilterBar } from "./filter-bar";
import { SelectionToolbar } from "./selection-toolbar";
import { Pagination } from "@/components/pagination";
import { readPaging } from "@/lib/pagination";

export const metadata = { title: "Kunden" };
export const dynamic = "force-dynamic";

/** Vorgabe, solange nichts anderes gewählt wurde. */
const STANDARD_SEITENGROESSE = 50;

type SortKey = "name" | "zip" | "city" | "purchase";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermissionOrRedirect("kunden.ansehen");
  const params = await searchParams;

  const filter = parseFilter(params);
  const { page, pageSize, skip, take } = await readPaging(params, {
    fallbackSize: STANDARD_SEITENGROESSE,
  });
  const sort = (String(params.sort ?? "name") as SortKey) ?? "name";
  const dir = params.dir === "desc" ? "desc" : "asc";

  const where = buildWhere(filter);

  const orderBy =
    sort === "zip"
      ? [{ zip: dir as "asc" }, { lastName: "asc" as const }]
      : sort === "city"
        ? [{ city: dir as "asc" }, { lastName: "asc" as const }]
        : sort === "purchase"
          ? [{ createdAt: dir as "asc" }]
          : [{ lastName: dir as "asc" }, { firstName: "asc" as const }];

  const [total, customers, products, categories, seasons, segments] =
    await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      select: customerListSelect,
      orderBy,
      skip,
      take,
    }),
    db.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.productCategory.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    // Nur Jahrgänge anbieten, zu denen es Käufe gibt — eine Liste von 1990 bis
    // 2100 hilft niemandem. `groupBy` statt `distinct`, damit das Zusammenfassen
    // in der Datenbank passiert und nicht zehntausend Zeilen hierher wandern.
    db.purchase.groupBy({
      by: ["season"],
      where: { season: { not: null } },
      orderBy: { season: "desc" },
    }),
    db.segment.findMany({ orderBy: { name: "asc" } }),
  ]);

  const exportParams = filterToSearchParams(filter);
  const productName = products.find((p) => p.id === filter.productId)?.name;
  const categoryName = categories.find((c) => c.id === filter.categoryId)?.name;
  const seasonYears = seasons
    .map((entry) => entry.season)
    .filter((year): year is number => year !== null);

  return (
    <>
      <PageHeader
        description={`${total.toLocaleString("de-DE")} Datensätze · ${describeFilter(filter, productName, categoryName)}`}
        actions={
          <>
            {can(user, "kunden.exportieren") ? (
              <>
                <LinkButton
                  href={`/api/export/kunden?${exportParams}&format=csv`}
                >
                  CSV exportieren
                </LinkButton>
                <LinkButton
                  href={`/api/export/kunden?${exportParams}&format=xlsx`}
                >
                  Excel exportieren
                </LinkButton>
              </>
            ) : null}
            {can(user, "kunden.bearbeiten") ? (
              <LinkButton href="/kunden/neu" variant="primary">
                Kunde anlegen
              </LinkButton>
            ) : null}
          </>
        }
      />

      <div className="mb-4">
        <CustomerFilterBar
          filter={filter}
          products={products}
          categories={categories}
          seasons={seasonYears}
          segments={segments.map((s) => ({
            id: s.id,
            name: s.name,
            filter: s.filter as Record<string, string>,
          }))}
        />
      </div>

      <Card className="overflow-hidden">
        {customers.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            {isEmptyFilter(filter)
              ? "Es sind noch keine Kunden erfasst."
              : "Keine Treffer für diesen Filter."}
          </p>
        ) : (
          <SelectionToolbar
            total={total}
            filterQuery={exportParams.toString()}
            ids={customers.map((c) => c.id)}
            canCreateCampaign={can(user, "kampagnen.erstellen")}
          >
            <Table>
              <thead>
                <tr>
                  <Th className="w-10" />
                  <SortableHeader
                    label="Name"
                    value="name"
                    current={sort}
                    dir={dir}
                    params={params}
                  />
                  <Th>Adresse</Th>
                  <SortableHeader
                    label="PLZ"
                    value="zip"
                    current={sort}
                    dir={dir}
                    params={params}
                  />
                  <SortableHeader
                    label="Stadt"
                    value="city"
                    current={sort}
                    dir={dir}
                    params={params}
                  />
                  <Th>E-Mail</Th>
                  <Th>Telefon</Th>
                  <Th>Käufe</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50">
                    <Td>
                      <input
                        type="checkbox"
                        name="selected"
                        value={customer.id}
                        className="size-4 rounded border-slate-300"
                        aria-label={`${customer.firstName} ${customer.lastName} auswählen`}
                      />
                    </Td>
                    <Td>
                      <a
                        href={`/kunden/${customer.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {customer.lastName}, {customer.firstName}
                      </a>
                    </Td>
                    <Td className="text-slate-600">{customer.street}</Td>
                    <Td className="tabular-nums text-slate-600">{customer.zip}</Td>
                    <Td className="text-slate-600">{customer.city}</Td>
                    <Td className="text-slate-600">
                      {customer.email ?? (
                        <span className="text-slate-400">—</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-slate-600">
                      {customer.phone ?? <span className="text-slate-400">—</span>}
                    </Td>
                    <Td className="text-slate-600">
                      {customer.purchases.length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span title={customer.purchases
                          .map(
                            (p) =>
                              `${p.product.name} (${formatDate(p.purchasedAt)})`,
                          )
                          .join(", ")}>
                          {customer.purchases[0].product.name}
                          {customer.purchases.length > 1
                            ? ` +${customer.purchases.length - 1}`
                            : ""}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <StatusBadges customer={customer} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </SelectionToolbar>
        )}
      </Card>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        params={params}
      />
    </>
  );
}

function StatusBadges({
  customer,
}: {
  customer: {
    email: string | null;
    unsubscribedAt: Date | null;
    bouncedAt: Date | null;
    deletedAt: Date | null;
  };
}) {
  const badges = [];
  if (customer.deletedAt) badges.push(<Badge key="d" tone="red">gelöscht</Badge>);
  if (customer.unsubscribedAt)
    badges.push(<Badge key="u" tone="amber">abgemeldet</Badge>);
  if (customer.bouncedAt) badges.push(<Badge key="b" tone="red">Bounce</Badge>);
  if (!customer.email)
    badges.push(<Badge key="n" tone="slate">keine E-Mail</Badge>);
  if (badges.length === 0)
    badges.push(<Badge key="o" tone="green">erreichbar</Badge>);
  return <div className="flex flex-wrap gap-1">{badges}</div>;
}

function SortableHeader({
  label,
  value,
  current,
  dir,
  params,
}: {
  label: string;
  value: SortKey;
  current: SortKey;
  dir: string;
  params: Record<string, string | string[] | undefined>;
}) {
  const next = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (typeof val === "string" && key !== "sort" && key !== "dir" && key !== "seite") {
      next.set(key, val);
    }
  }
  next.set("sort", value);
  next.set("dir", current === value && dir === "asc" ? "desc" : "asc");

  const arrow = current === value ? (dir === "asc" ? " ↑" : " ↓") : "";

  return (
    <Th>
      <a href={`/kunden?${next}`} className="hover:text-slate-900">
        {label}
        {arrow}
      </a>
    </Th>
  );
}
