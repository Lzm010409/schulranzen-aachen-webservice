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
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card p-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">
            Newsletter von Schulranzen-Aachen
          </h1>

          {!customer ? (
            <p className="mt-4 text-sm text-slate-600">
              Dieser Abmeldelink ist ungültig oder nicht mehr gültig. Bitte
              antworten Sie auf die E-Mail, dann tragen wir Sie manuell aus.
            </p>
          ) : ok === "1" || customer.unsubscribedAt ? (
            <>
              <p className="mt-4 text-sm text-slate-700">
                Sie wurden abgemeldet. Von uns kommen keine weiteren
                Werbe-E-Mails an{" "}
                <strong>{customer.email ?? "diese Adresse"}</strong>.
              </p>
              <p className="mt-3 text-xs text-slate-500">
                Ihre Kundendaten bleiben für die Abwicklung bereits getätigter
                Käufe gespeichert. Eine vollständige Löschung können Sie
                jederzeit per E-Mail verlangen.
              </p>
            </>
          ) : (
            <>
              <p className="mt-4 text-sm text-slate-700">
                Hallo {customer.firstName} {customer.lastName}, möchten Sie sich
                von unseren E-Mails abmelden?
              </p>
              <div className="mt-5">
                <UnsubscribeButton
                  token={token}
                  action={unsubscribeAction}
                />
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Schulranzen-Aachen
        </p>
      </div>
    </main>
  );
}
