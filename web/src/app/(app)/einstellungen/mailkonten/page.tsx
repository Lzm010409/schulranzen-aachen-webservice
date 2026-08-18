import { db } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/auth";
import { TestMailForm } from "./test-mail-form";
import {
  Alert,
  Badge,
  Button,
  Card,
  Table,
  Td,
  Th,
  formatDateTime,
} from "@/components/ui";
import {
  deleteMailAccountAction,
  deleteProviderAction,
  sendAccountTestMailAction,
  verifyMailAccountAction,
} from "../actions";
import { AccountEditor } from "./account-editor";
import { ProviderEditor } from "./provider-editor";
import { Pagination } from "@/components/pagination";

export const metadata = { title: "Mailkonten" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function MailAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermissionOrRedirect("mailkonten.verwalten");
  const flags = await searchParams;

  // Zwei Tabellen auf einer Seite, also zwei eigene Seitenzahlen.
  const accountPage = Math.max(1, Number(flags.konten ?? 1) || 1);
  const providerPage = Math.max(1, Number(flags.provider ?? 1) || 1);

  const [accountTotal, accounts, providerTotal, providers, providerChoices] =
    await Promise.all([
      db.mailAccount.count(),
      db.mailAccount.findMany({
        orderBy: [{ isDefault: "desc" }, { label: "asc" }],
        include: { provider: true, _count: { select: { campaigns: true } } },
        skip: (accountPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      db.provider.count(),
      db.provider.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { accounts: true } } },
        skip: (providerPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      // Die Auswahl im Kontoformular braucht alle Provider, nicht nur die
      // gerade angezeigte Seite.
      db.provider.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

  return (
    <div className="space-y-6">
      {flags.fehler ? <Alert variant="error">{flags.fehler}</Alert> : null}
      {flags.test ? (
        <Alert variant="success" title="Testmail versendet">
          Die Testmail ging an <strong>{flags.test}</strong>. Kommt sie nicht an,
          bitte auch den Spam-Ordner prüfen.
        </Alert>
      ) : null}

      <Alert variant="info" title="Wie die Zugangsdaten gespeichert werden">
        Das SMTP-Passwort wird mit AES-256-GCM verschlüsselt in der Datenbank
        abgelegt und nur zum Versandzeitpunkt entschlüsselt. Es erscheint weder
        im Protokoll noch im Browser.
      </Alert>

      <Card
        title={`Absenderkonten (${accountTotal})`}
        description="Ein Konto ist Standard und wird bei neuen Kampagnen vorausgewählt."
        footer={
          <AccountEditor
            trigger="Konto anlegen"
            variant="primary"
            account={null}
            providers={providerChoices}
          />
        }
      >
        {accounts.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Noch kein Absenderkonto. Ohne Konto ist kein Versand möglich.
          </p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Bezeichnung</Th>
                <Th>Absender</Th>
                <Th>Server</Th>
                <Th>Prüfung</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="hover:bg-slate-50">
                  <Td>
                    <span className="font-medium">{account.label}</span>
                    {account.isDefault ? (
                      <span className="ml-2">
                        <Badge tone="blue">Standard</Badge>
                      </span>
                    ) : null}
                    <span className="block text-xs text-slate-500">
                      Benutzer: {account.username}
                    </span>
                  </Td>
                  <Td className="text-slate-600">
                    {account.fromName}
                    <span className="block text-xs">{account.fromEmail}</span>
                  </Td>
                  <Td className="text-slate-600">
                    {account.provider.name}
                    <span className="block text-xs">
                      {account.provider.host}:{account.provider.port} ·{" "}
                      {account.provider.security === "SSL"
                        ? "SSL/TLS"
                        : "STARTTLS"}
                    </span>
                  </Td>
                  <Td>
                    {account.lastVerifiedAt ? (
                      <>
                        <Badge tone="green">geprüft</Badge>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {formatDateTime(account.lastVerifiedAt)}
                        </span>
                      </>
                    ) : account.lastError ? (
                      <>
                        <Badge tone="red">fehlgeschlagen</Badge>
                        <span className="mt-0.5 block max-w-xs text-xs text-red-700">
                          {account.lastError}
                        </span>
                      </>
                    ) : (
                      <Badge tone="amber">nicht geprüft</Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <form action={verifyMailAccountAction}>
                        <input type="hidden" name="id" value={account.id} />
                        <Button type="submit" variant="tertiary">
                          Verbindung prüfen
                        </Button>
                      </form>
                      <TestMailForm
                        accountId={account.id}
                        defaultEmail={user.email}
                        action={sendAccountTestMailAction}
                      />
                      <AccountEditor
                        trigger="Bearbeiten"
                        account={{
                          id: account.id,
                          label: account.label,
                          providerId: account.providerId,
                          username: account.username,
                          fromEmail: account.fromEmail,
                          fromName: account.fromName,
                          isDefault: account.isDefault,
                        }}
                        providers={providerChoices.map((p) => ({
                          id: p.id,
                          name: p.name,
                        }))}
                      />
                      {account._count.campaigns === 0 ? (
                        <form action={deleteMailAccountAction}>
                          <input type="hidden" name="id" value={account.id} />
                          <Button type="submit" variant="tertiary">
                            Löschen
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        <Pagination
          page={accountPage}
          pageSize={PAGE_SIZE}
          total={accountTotal}
          params={flags}
          paramName="konten"
        />
      </Card>

      <Card
        title={`Provider (${providerTotal})`}
        description="Server, Port und Verschlüsselung. Presets füllen die Felder korrekt vor."
        footer={<ProviderEditor trigger="Provider anlegen" provider={null} />}
      >
        {providers.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Noch kein Provider hinterlegt.
          </p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Host</Th>
                <Th>Port</Th>
                <Th>Verschlüsselung</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.id} className="hover:bg-slate-50">
                  <Td className="font-medium">{provider.name}</Td>
                  <Td className="text-slate-600">{provider.host}</Td>
                  <Td className="tabular-nums text-slate-600">
                    {provider.port}
                  </Td>
                  <Td className="text-slate-600">
                    {provider.security === "SSL" ? "SSL/TLS" : "STARTTLS"}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <ProviderEditor
                        trigger="Bearbeiten"
                        provider={{
                          id: provider.id,
                          name: provider.name,
                          host: provider.host,
                          port: provider.port,
                          security: provider.security,
                        }}
                      />
                      {provider._count.accounts === 0 ? (
                        <form action={deleteProviderAction}>
                          <input type="hidden" name="id" value={provider.id} />
                          <Button type="submit" variant="tertiary">
                            Löschen
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        <Pagination
          page={providerPage}
          pageSize={PAGE_SIZE}
          total={providerTotal}
          params={flags}
          paramName="provider"
        />
      </Card>
    </div>
  );
}
