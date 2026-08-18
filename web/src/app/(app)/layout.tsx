import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-nav";
import { logoutAction } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <AppShell user={user} logoutAction={logoutAction}>
      {children}
    </AppShell>
  );
}
