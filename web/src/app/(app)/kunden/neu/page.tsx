import { db } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "../customer-form";

export const metadata = { title: "Kunde anlegen" };
export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  await requirePermissionOrRedirect("kunden.bearbeiten");
  const products = await db.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { name: true },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Kunde anlegen"
        description="Pflichtfelder sind Name, Adresse, PLZ und Stadt."
      />
      <CustomerForm
        cancelHref="/kunden"
        products={products.map((p) => p.name)}
        values={{
          salutation: "UNBEKANNT",
          firstName: "",
          lastName: "",
          street: "",
          zip: "",
          city: "",
          email: "",
          phone: "",
          notes: "",
          purchases: [],
        }}
      />
    </div>
  );
}
