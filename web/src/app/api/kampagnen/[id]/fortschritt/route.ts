import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { campaignProgress } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) {
    return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  if (!can(user, "kampagnen.ansehen")) {
    return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const progress = await campaignProgress(id);

  return Response.json(progress, {
    headers: { "Cache-Control": "no-store" },
  });
}
