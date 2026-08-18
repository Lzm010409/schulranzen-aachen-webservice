import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Erzeugt einen schlanken, eigenstaendigen Server-Bundle fuer das Docker-Image.
  output: "standalone",
  // Das Repository enthaelt noch die alte Vaadin-package.json im Wurzelverzeichnis;
  // ohne diese Angabe waehlt Next.js sie als Projektwurzel.
  outputFileTracingRoot: path.join(import.meta.dirname),
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["nodemailer", "exceljs", "@prisma/adapter-pg"],
  experimental: {
    // Server Actions bekommen Datei-Anhaenge; der Standard von 1 MB reicht nicht.
    // Import von Dumps und Tabellen; Anhaenge bleiben bei 10 MB gedeckelt.
    serverActions: { bodySizeLimit: "55mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default config;
