import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { error, json } from "@/lib/server/response";
import { getBmidBoxSettings, patchBmidBoxSettings } from "@/lib/server/bmid-box";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g) return g;
  return json(await getBmidBoxSettings());
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

  return json(await patchBmidBoxSettings(body));
}
