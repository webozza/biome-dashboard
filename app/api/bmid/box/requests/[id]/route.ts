import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { error, json } from "@/lib/server/response";
import { getBmidBoxRequestById } from "@/lib/server/bmid-box";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireFirebaseUser(req);
  if (!auth.ok) return error("unauthorized", 401, { reason: auth.reason });

  const { id } = await ctx.params;
  const item = await getBmidBoxRequestById(id);
  if (!item) return error("not_found", 404);

  if (
    item.ownerUserId !== auth.uid &&
    item.taggedUserId !== auth.uid &&
    !auth.isAdmin
  ) {
    return error("forbidden", 403);
  }

  return json(item);
}
