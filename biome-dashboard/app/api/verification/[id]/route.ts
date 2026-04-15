import { buildDelete, buildGetOne, buildPatch } from "@/lib/server/resource";

export const dynamic = "force-dynamic";

export const GET = buildGetOne("verificationRequests");
export const PATCH = buildPatch("verificationRequests");
export const DELETE = buildDelete("verificationRequests");
