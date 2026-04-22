import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { error, json } from "@/lib/server/response";
import { getBmidBoxRequestById } from "@/lib/server/bmid-box";
import { updateDoc } from "@/lib/server/firestore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = guard(req);
  if (g) return g;

  const { id } = await ctx.params;
  const item = await getBmidBoxRequestById(id);
  if (!item) return error("not_found", 404);
  return json(item);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = guard(req);
  if (g) return g;

  const { id } = await ctx.params;
  const item = await getBmidBoxRequestById(id);
  if (!item) return error("not_found", 404);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  await updateDoc("bmidBoxRequests", id, body);
  const fresh = await getBmidBoxRequestById(id);
  return json(fresh);
}
