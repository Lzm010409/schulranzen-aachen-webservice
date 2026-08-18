import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <SettingsNav />
        <div>{children}</div>
      </div>
    </div>
  );
}
