import { buildDelete, buildGetOne, buildPatch } from "@/lib/server/resource";

export const dynamic = "force-dynamic";

export const GET = buildGetOne("dualityRequests");
export const PATCH = buildPatch("dualityRequests");
export const DELETE = buildDelete("dualityRequests");
