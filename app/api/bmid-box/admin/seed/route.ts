import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { json } from "@/lib/server/response";
import { seedBmidBoxRequests } from "@/lib/server/bmid-box";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";
  const result = await seedBmidBoxRequests({ force });
  return json(result);
}
