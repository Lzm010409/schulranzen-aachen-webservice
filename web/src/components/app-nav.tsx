"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cx } from "./ui";
import type { SessionUser } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/", label: "Übersicht", exact: true },
  { href: "/kunden", label: "Kunden" },
  { href: "/produkte", label: "Produkte" },
  { href: "/vorlagen", label: "Vorlagen" },
  { href: "/kampagnen", label: "Mailversand" },
  { href: "/einstellungen", label: "Einstellungen" },
];

export function AppNav({
  user,
  logoutAction,
}: {
  user: SessionUser;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(item: (typeof NAV_ITEMS)[number]) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-[100rem] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0 font-semibold text-slate-900">
          Schulranzen<span className="text-brand-600">-Aachen</span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                isActive(item)
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-slate-600 sm:inline">
            {user.name}
            {user.role === "ADMIN" ? (
              <span className="ml-2 badge bg-slate-100 text-slate-600">
                Admin
              </span>
            ) : null}
          </span>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-ghost">
              Abmelden
            </button>
          </form>
          <button
            type="button"
            className="btn btn-ghost md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Menü"
          >
            ☰
          </button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-slate-200 px-4 py-2 md:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cx(
                "block rounded-md px-3 py-2 text-sm font-medium",
                isActive(item)
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
