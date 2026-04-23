import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { json } from "@/lib/server/response";
import { getBmidBoxAuditRows } from "@/lib/server/bmid-box";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g) return g;
  return json({ items: await getBmidBoxAuditRows() });
}
