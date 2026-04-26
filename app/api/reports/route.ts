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
      verificationApproved,
      verificationRejected,
      contentApproved,
      contentRejected,
      boxApproved,
      boxRejected,
      dualityApproved,
      dualityRejected,
      votesFinalized,
    ] = await Promise.all([
      countCollection("verificationRequests", [{ field: "status", op: "==", value: "approved" }]),
      countCollection("verificationRequests", [{ field: "status", op: "==", value: "rejected" }]),
      countCollection("contentRequests", [{ field: "status", op: "==", value: "approved" }]),
      countCollection("contentRequests", [{ field: "status", op: "==", value: "rejected" }]),
      countCollection("boxRequests", [{ field: "status", op: "==", value: "approved" }]),
      countCollection("boxRequests", [{ field: "status", op: "==", value: "rejected" }]),
      countCollection("dualityRequests", [{ field: "status", op: "==", value: "approved" }]),
      countCollection("dualityRequests", [{ field: "status", op: "==", value: "rejected" }]),
      countCollection("votingItems", [{ field: "status", op: "==", value: "finalized" }]),
    ]);

    return json({
      verification: { approved: verificationApproved, rejected: verificationRejected },
      content: { approved: contentApproved, rejected: contentRejected },
      box: { approved: boxApproved, rejected: boxRejected },
      duality: { approved: dualityApproved, rejected: dualityRejected },
      voting: { finalized: votesFinalized },
    });
  } catch (e) {
    return error("reports_failed", 500, { detail: String((e as Error).message) });
  }
}
