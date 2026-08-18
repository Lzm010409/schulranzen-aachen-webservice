"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { can, type Permission } from "@/lib/permissions";

/**
 * Nachbau des Vaadin-AppLayouts: Schublade links mit dem Anwendungsnamen und
 * den Navigationseintraegen, oben eine Leiste mit dem Titel der aktuellen
 * Ansicht — wie @PageTitle im Altsystem.
 */
type NavItem = {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  permission?: Permission;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: "⌂", exact: true },
  { href: "/kunden", label: "Kunden", icon: "☰", permission: "kunden.ansehen" },
  { href: "/produkte", label: "Produkte", icon: "▤", permission: "produkte.ansehen" },
  { href: "/vorlagen", label: "Vorlagen", icon: "✎", permission: "vorlagen.ansehen" },
  { href: "/kampagnen", label: "Mail", icon: "✉", permission: "kampagnen.ansehen" },
  { href: "/einstellungen", label: "Einstellungen", icon: "⚙" },
];

function titleFor(pathname: string): string {
  if (pathname === "/") return "Home";
  if (pathname.startsWith("/kunden")) return "Kunden";
  if (pathname.startsWith("/produkte")) return "Produkte";
  if (pathname.startsWith("/vorlagen")) return "Vorlagen";
  if (pathname.startsWith("/kampagnen")) return "Mail";
  if (pathname.startsWith("/einstellungen")) return "Einstellungen";
  return "";
}

export function AppShell({
  user,
  logoutAction,
  children,
}: {
  user: SessionUser;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Beim Seitenwechsel schliesst die Schublade — auf schmalen Geraeten liegt
  // sie sonst ueber dem Inhalt.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const items = NAV_ITEMS.filter(
    (item) => !item.permission || can(user, item.permission),
  );

  return (
    <div className="app-layout" data-drawer={drawerOpen ? "open" : "closed"}>
      <button
        type="button"
        className="drawer-backdrop"
        aria-label="Menü schließen"
        onClick={() => setDrawerOpen(false)}
      />

      <aside className="app-drawer">
        <header className="app-drawer-header">
          <h1 className="app-drawer-title">Schulranzen-Aachen-Webservice</h1>
        </header>

        <nav className="app-drawer-scroller" aria-label="Hauptnavigation">
          <ul className="app-nav">
            {items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="app-nav-item"
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="app-nav-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <footer className="app-drawer-footer">
          {user.name}
          {user.role === "ADMIN" ? " · Administrator" : ""}
        </footer>
      </aside>

      <div className="app-main">
        <header className="app-navbar">
          <button
            type="button"
            className="drawer-toggle"
            aria-label="Menü"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((open) => !open)}
          >
            ☰
          </button>
          <h2 className="app-view-title">{titleFor(pathname)}</h2>

          <div className="app-navbar-spacer" />
          <span className="app-user">{user.name}</span>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-tertiary">
              Abmelden
            </button>
          </form>
        </header>

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
