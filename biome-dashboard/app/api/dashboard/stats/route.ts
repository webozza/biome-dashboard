import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { error, json } from "@/lib/server/response";
import { countCollection } from "@/lib/server/firestore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  try {
    const [
      totalUsers,
      verifiedUsers,
      pendingVerification,
      pendingContent,
      pendingBox,
      pendingDuality,
      openFlags,
      openVotes,
    ] = await Promise.all([
      countCollection("users"),
      countCollection("users", [{ field: "verified", op: "==", value: true }]),
      countCollection("verificationRequests", [{ field: "status", op: "==", value: "pending" }]),
      countCollection("contentRequests", [{ field: "status", op: "==", value: "pending" }]),
      countCollection("boxRequests", [{ field: "status", op: "==", value: "pending" }]),
      countCollection("dualityRequests", [{ field: "status", op: "==", value: "pending" }]),
      countCollection("flaggedItems", [{ field: "status", op: "==", value: "open" }]),
      countCollection("votingItems", [{ field: "status", op: "==", value: "open" }]),
    ]);

    return json({
      totals: { users: totalUsers, verifiedUsers },
      pending: {
        verification: pendingVerification,
        content: pendingContent,
        box: pendingBox,
        duality: pendingDuality,
      },
      open: { flags: openFlags, votes: openVotes },
    });
  } catch (e) {
    return error("stats_failed", 500, { detail: String((e as Error).message) });
  }
}
