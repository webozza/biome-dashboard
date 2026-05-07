import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { markUserNotificationsRead } from "@/lib/server/notifications";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireFirebaseUser(req);
  if (!user.ok) return error("unauthorized", 401, { reason: user.reason });

  const { id } = await ctx.params;
  let body: { read?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const result = await markUserNotificationsRead(user.uid, {
      ids: [id],
      read: typeof body.read === "boolean" ? body.read : true,
    });
    return json(result);
  } catch (e) {
    return error("update_failed", 500, { detail: String((e as Error).message) });
  }
}
