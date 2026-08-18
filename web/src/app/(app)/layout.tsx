import { requireUser } from "@/lib/auth";
import { readFlash } from "@/lib/flash";
import { AppShell } from "@/components/app-nav";
import { logoutAction } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const flash = await readFlash();

  return (
    <AppShell user={user} logoutAction={logoutAction} flash={flash}>
      {children}
    </AppShell>
  );
}
