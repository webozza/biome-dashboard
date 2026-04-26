import { buildCreate, buildList } from "@/lib/server/resource";

export const dynamic = "force-dynamic";

export const GET = buildList("blockedUsers", {
  orderBy: "blockedAt",
  allowedFilters: ["userId", "blockedBy"],
});
export const POST = buildCreate("blockedUsers");
