import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { listUserNotifications, markUserNotificationsRead } from "@/lib/server/notifications";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireFirebaseUser(req);
  if (!user.ok) return error("unauthorized", 401, { reason: user.reason });

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") || "50");
  const limit = Math.max(1, Math.min(100, Number.isFinite(limitParam) ? limitParam : 50));

  try {
    return json(await listUserNotifications(user.uid, limit));
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requireFirebaseUser(req);
  if (!user.ok) return error("unauthorized", 401, { reason: user.reason });

  let body: { ids?: string[]; read?: boolean; all?: boolean };
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  try {
    const result = await markUserNotificationsRead(user.uid, {
      ids: Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0) : undefined,
      read: typeof body.read === "boolean" ? body.read : true,
      all: body.all === true,
    });
    return json(result);
  } catch (e) {
    return error("update_failed", 500, { detail: String((e as Error).message) });
  }
}
