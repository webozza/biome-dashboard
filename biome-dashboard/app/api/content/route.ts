import { NextRequest } from "next/server";
import { buildList } from "@/lib/server/resource";
import { guard } from "@/lib/server/guard";
import { createDoc, getDoc } from "@/lib/server/firestore";
import { buildDualityRequestFromContent } from "@/lib/server/bmid";
import { error, json } from "@/lib/server/response";
import { contentRequests } from "@/lib/data/mock-data";

export const dynamic = "force-dynamic";

type UserDoc = {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  bmidNumber?: string | null;
  verified?: boolean;
};

function pickName(user: UserDoc, fallback: string) {
  return user.name || user.displayName || user.email || fallback;
}

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
  const clientUserName = typeof body.userName === "string" ? body.userName : "";
  if (!userId || !clientUserName) return error("missing_user", 400);

  const owner = await getDoc<UserDoc>("users", userId);
  if (!owner) return error("owner_not_found", 404);

  const taggedUserId =
    type === "own"
      ? userId
      : typeof body.taggedUserId === "string"
        ? body.taggedUserId
        : "";
  const clientTaggedName =
    type === "own"
      ? clientUserName
      : typeof body.taggedUserName === "string"
        ? body.taggedUserName
        : "";

  if (!taggedUserId || !clientTaggedName) return error("missing_tagged_user", 400);

  const tagged = type === "own" ? owner : await getDoc<UserDoc>("users", taggedUserId);
  if (!tagged) return error("tagged_user_not_found", 404);

  const ownerName = pickName(owner, clientUserName);
  const taggedName = type === "own" ? ownerName : pickName(tagged, clientTaggedName);

  const taggedUserAction = type === "own" ? "accepted" : "pending";
  const status = type === "own" ? "pending" : "waiting_tagged";

  try {
    const payload = {
      ...body,
      userId,
      userName: ownerName,
      bmidNumber: owner.bmidNumber ?? null,
      type,
      status,
      taggedUserId,
      taggedUserName: taggedName,
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

    const numericId = 3001 + contentRequests.length + Math.floor(Math.random() * 1000);
    const id = await createDoc("contentRequests", payload, `content-${numericId}`);
    if (type === "duality") {
      await buildDualityRequestFromContent(id, {
        ownerId: userId,
        ownerName,
        taggedUserId,
        taggedUserName: taggedName,
        taggedUserAction: "pending",
      });
    }
    return json({ id }, 201);
  } catch (e) {
    return error("create_failed", 500, { detail: String((e as Error).message) });
  }
}
