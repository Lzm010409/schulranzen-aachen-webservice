"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const ITEMS = [
  { href: "/einstellungen", label: "Mein Konto", exact: true },
  { href: "/einstellungen/mailkonten", label: "Mailkonten" },
  { href: "/einstellungen/benutzer", label: "Benutzer" },
  { href: "/einstellungen/import", label: "Import" },
  { href: "/einstellungen/protokoll", label: "Protokoll" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
