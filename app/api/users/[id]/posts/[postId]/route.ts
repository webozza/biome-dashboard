import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; postId: string }> }
) {
  const g = guard(req);
  if (g) return g;

  const { id, postId } = await ctx.params;
  if (!id || !postId) return error("missing_params", 400);

  try {
    const ref = db().collection("users").doc(id).collection("posts").doc(postId);
    const snap = await ref.get();
    if (!snap.exists) return error("not_found", 404);
    await ref.delete();
    return json({ id: postId, ownerId: id, deleted: true });
  } catch (e) {
    return error("delete_failed", 500, { detail: String((e as Error).message) });
  }
}
