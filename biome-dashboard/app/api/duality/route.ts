import { buildCreate, buildList } from "@/lib/server/resource";

export const dynamic = "force-dynamic";

export const GET = buildList("dualityRequests", {
  allowedFilters: ["status", "ownerId", "taggedUserId", "source", "taggedUserAction"],
});
export const POST = buildCreate("dualityRequests");
