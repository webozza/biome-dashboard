import { buildCreate, buildList } from "@/lib/server/resource";

export const dynamic = "force-dynamic";

export const GET = buildList("users", {
  allowedFilters: ["role", "verified"],
});
export const POST = buildCreate("users");
