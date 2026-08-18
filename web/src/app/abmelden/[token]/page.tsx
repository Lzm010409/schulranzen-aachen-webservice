import { db } from "@/lib/db";
import { readUnsubscribeToken } from "@/lib/mailer";
import { UnsubscribeButton } from "./unsubscribe-button";
import { unsubscribeAction } from "./actions";

export const metadata = { title: "Newsletter abmelden" };
export const dynamic = "force-dynamic";

/**
 * Oeffentliche Seite — bewusst ohne Anmeldung erreichbar. Der Token ist
 * signiert und enthaelt die Kunden-ID; ohne gueltige Signatur passiert nichts.
 */
export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { token } = await params;
  const { ok } = await searchParams;

  const customerId = await readUnsubscribeToken(token);
  const customer = customerId
    ? await db.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          unsubscribedAt: true,
        },
      })
    : null;

  return (
    <main className="centered-page">
      <div style={{ width: "100%", maxWidth: "28rem" }}>
        <div className="card" style={{ padding: "var(--lumo-space-l)", textAlign: "center" }}>
          <h1 style={{ fontSize: "var(--lumo-font-size-xl)" }}>
            Newsletter von Schulranzen-Aachen
          </h1>

          {!customer ? (
            <p className="view-description">
              Dieser Abmeldelink ist ungültig oder nicht mehr gültig. Bitte
              antworten Sie auf die E-Mail, dann tragen wir Sie manuell aus.
            </p>
          ) : ok === "1" || customer.unsubscribedAt ? (
            <>
              <p style={{ marginTop: "1rem" }}>
                Sie wurden abgemeldet. Von uns kommen keine weiteren
                Werbe-E-Mails an{" "}
                <strong>{customer.email ?? "diese Adresse"}</strong>.
              </p>
              <p className="subtle" style={{ marginTop: "0.75rem" }}>
                Ihre Kundendaten bleiben für die Abwicklung bereits getätigter
                Käufe gespeichert. Eine vollständige Löschung können Sie
                jederzeit per E-Mail verlangen.
              </p>
            </>
          ) : (
            <>
              <p style={{ marginTop: "1rem" }}>
                Hallo {customer.firstName} {customer.lastName}, möchten Sie sich
                von unseren E-Mails abmelden?
              </p>
              <div style={{ marginTop: "1.25rem" }}>
                <UnsubscribeButton
                  token={token}
                  action={unsubscribeAction}
                />
              </div>
            </>
          )}
        </div>

        <p className="subtle" style={{ marginTop: "1.5rem", textAlign: "center" }}>
          Schulranzen-Aachen
        </p>
      </div>
    </main>
  );
}
