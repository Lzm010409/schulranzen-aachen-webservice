import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Schulranzen-Aachen-Webservice",
    template: "%s · Schulranzen-Aachen",
  },
  description: "Kundenverwaltung und Mailversand",
  robots: { index: false, follow: false },
  // Explizit gesetzt, damit der Browser nicht auf /favicon.ico zurueckfaellt.
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
