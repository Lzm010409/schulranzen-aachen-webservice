import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      // Next.js-Marker; im Test-Runner gibt es keine Server/Client-Trennung.
      "server-only": path.resolve(process.cwd(), "src/lib/__tests__/server-only.stub.ts"),
    },
  },
});
