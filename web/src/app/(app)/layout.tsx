import { requireUser } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";
import { logoutAction } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav user={user} logoutAction={logoutAction} />
      <main className="mx-auto w-full max-w-[100rem] flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500">
        Schulranzen-Aachen-Webservice · Interne Anwendung
      </footer>
    </div>
  );
}
