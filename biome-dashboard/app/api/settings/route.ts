import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { error, json } from "@/lib/server/response";
import { db } from "@/lib/server/firebase";

export const dynamic = "force-dynamic";

const DOC = () => db().collection("adminSettings").doc("global");

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g) return g;
  try {
    const snap = await DOC().get();
    return json(snap.exists ? { id: snap.id, ...snap.data() } : { id: "global" });
  } catch (e) {
    return error("settings_failed", 500, { detail: String((e as Error).message) });
  }
}

export async function PATCH(req: NextRequest) {
  const g = guard(req);
  if (g) return g;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }
  try {
    await DOC().set({ ...body, updatedAt: new Date().toISOString() }, { merge: true });
    const snap = await DOC().get();
    return json({ id: snap.id, ...snap.data() });
  } catch (e) {
    return error("settings_update_failed", 500, { detail: String((e as Error).message) });
  }
}
