import { buildCreate, buildList } from "@/lib/server/resource";

export const dynamic = "force-dynamic";

export const GET = buildList("postReports", {
  allowedFilters: ["status", "reason", "postId", "reporterId"],
});
export const POST = buildCreate("postReports");
