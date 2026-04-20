import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { json } from "@/lib/server/response";
import { resetBmidBoxRequests } from "@/lib/server/bmid-box";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const g = guard(req);
  if (g) return g;
  const result = await resetBmidBoxRequests();
  return json(result);
}
