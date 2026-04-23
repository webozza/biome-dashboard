import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { error, json } from "@/lib/server/response";
import { applyBmidBoxAction } from "@/lib/server/bmid-box";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = guard(req);
  if (g) return g;

  let body: { actorName?: string; note?: string; rejectionReason?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { id } = await ctx.params;
  const item = await applyBmidBoxAction(id, {
    actorName: body.actorName || "Admin",
    action: "reject_request",
    rejectionReason: body.rejectionReason || "Rejected by admin review",
    note: body.note,
  });
  if (!item) return error("not_found", 404);
  return json(item);
}
