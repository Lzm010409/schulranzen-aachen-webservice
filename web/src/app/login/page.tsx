import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/");

  const { next } = await searchParams;

  return (
    <main className="centered-page">
      <div style={{ width: "100%", maxWidth: "22rem" }}>
        <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "var(--lumo-font-size-xl)" }}>
            Schulranzen-Aachen-Webservice
          </h1>
          <p className="view-description">Kundenverwaltung und Mailversand</p>
        </div>
        <div className="card">
          <div className="card-body">
            <LoginForm next={next} />
          </div>
        </div>
        <p
          className="subtle"
          style={{ marginTop: "1.5rem", textAlign: "center" }}
        >
          Interner Zugang. Alle Anmeldungen werden protokolliert.
        </p>
      </div>
    </main>
  );
}
