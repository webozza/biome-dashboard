import { NextRequest } from "next/server";
import { buildList } from "@/lib/server/resource";
import { guard } from "@/lib/server/guard";
import { createDoc } from "@/lib/server/firestore";
import { buildDualityRequestFromContent } from "@/lib/server/bmid";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export const GET = buildList("contentRequests", {
  allowedFilters: ["status", "userId", "type"],
});

export async function POST(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  const type = body.type === "duality" ? "duality" : "own";
  const userId = typeof body.userId === "string" ? body.userId : "";
  const userName = typeof body.userName === "string" ? body.userName : "";
  if (!userId || !userName) return error("missing_user", 400);

  const taggedUserId =
    type === "own"
      ? userId
      : typeof body.taggedUserId === "string"
        ? body.taggedUserId
        : "";
  const taggedUserName =
    type === "own"
      ? userName
      : typeof body.taggedUserName === "string"
        ? body.taggedUserName
        : "";

  if (!taggedUserId || !taggedUserName) return error("missing_tagged_user", 400);

  const taggedUserAction = type === "own" ? "accepted" : "pending";
  const status = type === "own" ? "pending" : "waiting_tagged";

  try {
    const payload = {
      ...body,
      type,
      status,
      taggedUserId,
      taggedUserName,
      taggedUserAction,
      reviewedBy: null,
      rejectionReason: null,
      adminNotes: Array.isArray(body.adminNotes) ? body.adminNotes : [],
      voteAccept: 0,
      voteIgnore: 0,
      voteRefuse: 0,
      votingStatus: null,
      votingOutcome: null,
    };

    const id = await createDoc("contentRequests", payload);
    if (type === "duality") {
      await buildDualityRequestFromContent(id, {
        ownerId: userId,
        ownerName: userName,
        taggedUserId,
        taggedUserName,
        taggedUserAction: "pending",
      });
    }
    return json({ id }, 201);
  } catch (e) {
    return error("create_failed", 500, { detail: String((e as Error).message) });
  }
}
