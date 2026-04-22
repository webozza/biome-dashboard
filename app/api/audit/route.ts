import { buildList } from "@/lib/server/resource";

export const dynamic = "force-dynamic";

export const GET = buildList("auditLogs", {
  allowedFilters: ["requestType", "source", "status", "approvedBy"],
});
