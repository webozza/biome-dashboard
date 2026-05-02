import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { error, json } from "@/lib/server/response";
import { getBmidBoxRequestById } from "@/lib/server/bmid-box";
import { getDoc, updateDoc } from "@/lib/server/firestore";

const CANCELABLE_STATES = new Set([
  "submitted",
  "pending_admin_review",
  "pending_tagged_user",
]);

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireFirebaseUser(req);
  if (!auth.ok) return error("unauthorized", 401, { reason: auth.reason });

  const { id } = await ctx.params;
  const item = await getBmidBoxRequestById(id);
  if (!item) return error("not_found", 404);
  if (item.ownerUserId !== auth.uid) return error("forbidden", 403);
  if (!CANCELABLE_STATES.has(item.currentStatus)) {
    return error("not_cancelable", 400, {
      detail: `Cannot cancel request in state: ${item.currentStatus}`,
    });
  }

  let body: { note?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const userDoc = await getDoc<{ name?: string; displayName?: string; email?: string }>(
    "users",
    auth.uid
  );
  const actorName =
    userDoc?.name || userDoc?.displayName || userDoc?.email || auth.email || "User";

  const now = new Date().toISOString();
  const historyEntry = {
    id: `${id}-h${(item.history?.length || 0) + 1}-${Date.now()}`,
    requestId: id,
    actionType: "status_changed" as const,
    actorId: auth.uid,
    actorName,
    note: body.note?.trim() || "Cancelled by owner",
    createdAt: now,
  };

  await updateDoc("bmidBoxRequests", id, {
    currentStatus: "cancelled",
    finalizedAt: now,
    history: [...(item.history || []), historyEntry],
  });

  if (item.type === "duality") {
    const dualityDoc = await getDoc<Record<string, unknown>>("dualityRequests", id);
    if (dualityDoc) {
      const timeline =
        (dualityDoc.timeline as { event: string; at: string }[] | undefined) || [];
      await updateDoc("dualityRequests", id, {
        status: "cancelled",
        timeline: [
          ...timeline,
          { event: "Owner cancelled box request", at: now.split("T")[0] },
        ],
      });
    }
  }

  const fresh = await getBmidBoxRequestById(id);
  return json(fresh);
}
