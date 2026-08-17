import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Health-Check fuer Coolify. Prueft auch die Datenbankverbindung — ein
 * laufender Prozess ohne DB ist fuer diese Anwendung nicht "gesund".
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", time: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { status: "error", error: (error as Error).message },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
