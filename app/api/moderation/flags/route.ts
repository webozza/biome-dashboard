import { buildCreate, buildList } from "@/lib/server/resource";

export const dynamic = "force-dynamic";

export const GET = buildList("flaggedItems", {
  orderBy: "flaggedAt",
  allowedFilters: ["status", "type", "severity"],
});
export const POST = buildCreate("flaggedItems");
