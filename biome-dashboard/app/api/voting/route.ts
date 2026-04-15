import { buildCreate, buildList } from "@/lib/server/resource";

export const dynamic = "force-dynamic";

export const GET = buildList("votingItems", {
  orderBy: "openedAt",
  allowedFilters: ["status", "requestType", "outcome"],
});
export const POST = buildCreate("votingItems");
