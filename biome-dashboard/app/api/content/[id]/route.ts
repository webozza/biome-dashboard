import { buildDelete, buildGetOne, buildPatch } from "@/lib/server/resource";

export const dynamic = "force-dynamic";

export const GET = buildGetOne("contentRequests");
export const PATCH = buildPatch("contentRequests");
export const DELETE = buildDelete("contentRequests");
