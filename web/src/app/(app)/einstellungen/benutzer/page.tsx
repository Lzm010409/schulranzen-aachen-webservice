import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
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
import { deleteUserAction } from "../actions";
import { UserEditor } from "./user-editor";

export const metadata = { title: "Benutzer" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const current = await requireUser();

  if (current.role !== "ADMIN") {
    return (
      <Alert variant="warning" title="Kein Zugriff">
        Die Benutzerverwaltung ist Administratoren vorbehalten.
      </Alert>
    );
  }

  const users = await db.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <Card
        title="Benutzer"
        description="Jede Person hat ein eigenes Konto — nur so ist im Protokoll nachvollziehbar, wer was geändert hat."
        footer={<UserEditor trigger="Benutzer anlegen" variant="primary" user={null} />}
      >
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>E-Mail</Th>
              <Th>Rolle</Th>
              <Th>Status</Th>
              <Th>Letzte Anmeldung</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50">
                <Td className="font-medium">{user.name}</Td>
                <Td className="text-slate-600">{user.email}</Td>
                <Td>
                  <Badge tone={user.role === "ADMIN" ? "blue" : "slate"}>
                    {user.role === "ADMIN" ? "Administrator" : "Mitarbeiter"}
                  </Badge>
                </Td>
                <Td>
                  {user.active ? (
                    <Badge tone="green">aktiv</Badge>
                  ) : (
                    <Badge tone="red">deaktiviert</Badge>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-slate-600">
                  {formatDateTime(user.lastLoginAt)}
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <UserEditor
                      trigger="Bearbeiten"
                      user={{
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        active: user.active,
                      }}
                    />
                    {user.active && user.id !== current.id ? (
                      <form action={deleteUserAction}>
                        <input type="hidden" name="id" value={user.id} />
                        <Button type="submit" variant="ghost">
                          Deaktivieren
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
