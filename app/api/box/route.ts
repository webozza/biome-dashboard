import { buildCreate, buildList } from "@/lib/server/resource";

export const dynamic = "force-dynamic";

export const GET = buildList("boxRequests", {
  allowedFilters: ["status", "userId", "platform"],
});
export const POST = buildCreate("boxRequests");
