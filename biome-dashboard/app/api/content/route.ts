import { buildCreate, buildList } from "@/lib/server/resource";

export const dynamic = "force-dynamic";

export const GET = buildList("contentRequests", {
  allowedFilters: ["status", "userId", "type"],
});
export const POST = buildCreate("contentRequests");
