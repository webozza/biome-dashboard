import { buildCreate, buildList } from "@/lib/server/resource";

export const dynamic = "force-dynamic";

export const GET = buildList("verificationRequests", {
  allowedFilters: ["status", "platform", "userId"],
});
export const POST = buildCreate("verificationRequests");
