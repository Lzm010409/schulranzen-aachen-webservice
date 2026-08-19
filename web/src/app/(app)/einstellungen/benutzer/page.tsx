import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  Alert,
  Badge,
  Card,
  Table,
  Td,
  Th,
  formatDateTime,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Pagination } from "@/components/pagination";
import { readPaging } from "@/lib/pagination";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteUserAction } from "../actions";
import { UserEditor } from "./user-editor";

export const metadata = { title: "Benutzer" };
export const dynamic = "force-dynamic";

/** Vorgabe, solange nichts anderes gewählt wurde. */
const STANDARD_SEITENGROESSE = 25;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const current = await requireUser();
  const params = await searchParams;
  const { page, pageSize, skip, take } = await readPaging(params, {
    fallbackSize: STANDARD_SEITENGROESSE,
  });

  if (current.role !== "ADMIN") {
    return (
      <Alert variant="warning" title="Kein Zugriff">
        Die Benutzerverwaltung ist Administratoren vorbehalten.
      </Alert>
    );
  }

  const [total, users] = await Promise.all([
    db.user.count(),
    db.user.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      skip,
      take,
    }),
  ]);

  const totalPermissions = PERMISSIONS.reduce(
    (sum, group) => sum + group.items.length,
    0,
  );

  return (
    <div className="space-y-6">
      <Card
        title={`Benutzer (${total})`}
        description="Jede Person bekommt ein eigenes Konto. Die Rechte legen fest, was sie sehen und ändern darf — nur so ist im Protokoll nachvollziehbar, wer was getan hat."
        footer={
          <UserEditor
            trigger="Benutzer anlegen"
            variant="primary"
            user={null}
          />
        }
      >
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>E-Mail</Th>
              <Th>Rolle</Th>
              <Th>Rechte</Th>
              <Th>Status</Th>
              <Th>Letzte Anmeldung</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <Td>
                  <strong>{user.name}</strong>
                </Td>
                <Td className="muted">{user.email}</Td>
                <Td>
                  <Badge tone={user.role === "ADMIN" ? "blue" : "slate"}>
                    {user.role === "ADMIN" ? "Administrator" : "Mitarbeiter"}
                  </Badge>
                </Td>
                <Td className="muted">
                  {user.role === "ADMIN" ? (
                    <span title="Administratoren haben immer alle Rechte.">
                      alle
                    </span>
                  ) : (
                    <span
                      title={user.permissions.join("\n") || "keine Rechte"}
                    >
                      {user.permissions.length} von {totalPermissions}
                    </span>
                  )}
                </Td>
                <Td>
                  {user.active ? (
                    <Badge tone="green">aktiv</Badge>
                  ) : (
                    <Badge tone="red">deaktiviert</Badge>
                  )}
                </Td>
                <Td className="muted">{formatDateTime(user.lastLoginAt)}</Td>
                <Td>
                  <div className="toolbar" style={{ justifyContent: "flex-end" }}>
                    {/* Direkter Weg zu allem, was diese Person angelegt oder
                        geaendert hat — sonst muesste man im Protokoll erst den
                        Namen heraussuchen. */}
                    <a
                      href={`/einstellungen/protokoll?benutzer=${user.id}`}
                      className="btn btn-tertiary"
                    >
                      Protokoll
                    </a>
                    <UserEditor
                      trigger="Bearbeiten"
                      user={{
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        active: user.active,
                        permissions: user.permissions,
                      }}
                    />
                    {user.active && user.id !== current.id ? (
                      <form action={deleteUserAction}>
                        <input type="hidden" name="id" value={user.id} />
                        <SubmitButton variant="tertiary" busyLabel="Wird deaktiviert…">
                          Deaktivieren
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          params={params}
        />
      </Card>

      <Card
        title="Was die Rechte bedeuten"
        description="Administratoren haben immer alle Rechte. Für Mitarbeiter wird jedes Recht einzeln vergeben."
      >
        <div className="permission-groups">
          {PERMISSIONS.map((group) => (
            <div key={group.group} className="permission-group">
              <h3>{group.group}</h3>
              <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {group.items.map((item) => (
                  <li key={item.key} style={{ fontSize: "var(--lumo-font-size-s)" }}>
                    {item.label}
                    {"hint" in item && item.hint ? (
                      <span className="permission-hint">{item.hint}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
