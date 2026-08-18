import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/auth";
import { PageHeader, toDateInput } from "@/components/ui";
import { CustomerForm } from "../../customer-form";

export const metadata = { title: "Kunde bearbeiten" };
export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermissionOrRedirect("kunden.bearbeiten");
  const { id } = await params;

  const [customer, products] = await Promise.all([
    db.customer.findUnique({
      where: { id },
      include: {
        purchases: {
          orderBy: [{ purchasedAt: "desc" }, { createdAt: "desc" }],
          include: { product: true },
        },
      },
    }),
    db.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`${customer.firstName} ${customer.lastName} bearbeiten`}
      />
      <CustomerForm
        cancelHref={`/kunden/${id}`}
        products={products.map((p) => p.name)}
        values={{
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          street: customer.street,
          zip: customer.zip,
          city: customer.city,
          email: customer.email ?? "",
          phone: customer.phone ?? "",
          notes: customer.notes ?? "",
          purchases: customer.purchases.map((purchase) => ({
            id: purchase.id,
            productName: purchase.product.name,
            date: toDateInput(purchase.purchasedAt),
            season: purchase.season?.toString() ?? "",
          })),
        }}
      />
    </div>
  );
}
