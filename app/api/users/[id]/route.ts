import { buildDelete, buildGetOne, buildPatch } from "@/lib/server/resource";

export const dynamic = "force-dynamic";

export const GET = buildGetOne("users");
export const PATCH = buildPatch("users");
export const DELETE = buildDelete("users");
