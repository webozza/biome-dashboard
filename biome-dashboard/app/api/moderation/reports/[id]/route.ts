import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

type ReviewedStatus = "reviewed" | "dismissed" | "actioned";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = guard(req);
  if (g) return g;

  const { id } = await ctx.params;
  if (!id) return error("missing_id", 400);

  let body: { status?: string; adminNotes?: string | null; reviewerId?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  const allowed: ReviewedStatus[] = ["reviewed", "dismissed", "actioned"];
  if (!body.status || !allowed.includes(body.status as ReviewedStatus)) {
    return error("invalid_status", 400, { detail: `status must be one of: ${allowed.join(", ")}` });
  }

  try {
    const firestore = db();
    const ref = firestore.collection("reports").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return error("not_found", 404);

    await ref.set(
      {
        status: body.status,
        adminNotes: body.adminNotes ?? null,
        reviewedAt: new Date().toISOString(),
        reviewedBy: body.reviewerId ?? "admin",
      },
      { merge: true }
    );

    const fresh = await ref.get();
    return json({ id, ...(fresh.data() || {}) });
  } catch (e) {
    return error("update_failed", 500, { detail: String((e as Error).message) });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = guard(req);
  if (g) return g;

  const { id } = await ctx.params;
  if (!id) return error("missing_id", 400);

  try {
    const firestore = db();
    await firestore.collection("reports").doc(id).delete();
    return json({ id, deleted: true });
  } catch (e) {
    return error("delete_failed", 500, { detail: String((e as Error).message) });
  }
}
