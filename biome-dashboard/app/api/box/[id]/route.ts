import { buildDelete, buildGetOne, buildPatch } from "@/lib/server/resource";

export const dynamic = "force-dynamic";

export const GET = buildGetOne("boxRequests");
export const PATCH = buildPatch("boxRequests");
export const DELETE = buildDelete("boxRequests");
