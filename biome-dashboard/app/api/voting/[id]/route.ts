import { buildDelete, buildGetOne, buildPatch } from "@/lib/server/resource";

export const dynamic = "force-dynamic";

export const GET = buildGetOne("votingItems");
export const PATCH = buildPatch("votingItems");
export const DELETE = buildDelete("votingItems");
