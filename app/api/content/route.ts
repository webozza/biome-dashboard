import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { createDoc, getDoc } from "@/lib/server/firestore";
import { buildDualityRequestFromContent } from "@/lib/server/bmid";
import type { TaggedUserState } from "@/lib/server/bmid";
import { db } from "@/lib/server/firebase";
import { error, json, parsePagination } from "@/lib/server/response";
import { contentRequests } from "@/lib/data/mock-data";
import { notifyAdminRequestCreated } from "@/lib/server/admin-request-email";

export const dynamic = "force-dynamic";

type UserDoc = {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  bmidNumber?: string | null;
  verified?: boolean;
};

type ContentListDoc = {
  id: string;
  createdAt?: unknown;
  status?: unknown;
  votingStatus?: unknown;
  type?: unknown;
  userId?: unknown;
};

function pickName(user: UserDoc, fallback: string) {
  return user.name || user.displayName || user.email || fallback;
}

function parseTaggedUserIds(body: Record<string, unknown>) {
  const raw =
    Array.isArray(body.taggedUserIds)
      ? body.taggedUserIds
      : Array.isArray(body.taggedUsers)
        ? body.taggedUsers.map((user) =>
            typeof user === "string"
              ? user
              : user && typeof user === "object" && "id" in user
                ? (user as { id?: unknown }).id
                : user && typeof user === "object" && "userId" in user
                  ? (user as { userId?: unknown }).userId
                  : null
          )
        : typeof body.taggedUserId === "string"
          ? [body.taggedUserId]
          : [];

  return [...new Set(raw.filter((id): id is string => typeof id === "string" && Boolean(id.trim())).map((id) => id.trim()))];
}

function normalizedParam(url: URL, key: string) {
  const value = url.searchParams.get(key)?.trim();
  return value ? value.toLowerCase() : null;
}

function normalizedValue(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizedContentStatus(row: ContentListDoc) {
  const status = normalizedValue(row.status);
  const votingStatus = normalizedValue(row.votingStatus);
  return status === "in_review" && votingStatus === "open" ? "approved" : status;
}

function normalizeContentRow<T extends ContentListDoc>(row: T): T {
  return normalizedContentStatus(row) === "approved" ? { ...row, status: "approved" } : row;
}

function createdAtTime(value: unknown) {
  if (typeof value !== "string") return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  const url = new URL(req.url);
  const { limit, cursor } = parsePagination(url);
  const status = normalizedParam(url, "status");
  const type = normalizedParam(url, "type");
  const userId = url.searchParams.get("userId")?.trim() || null;

  try {
    const snap = await db().collection("contentRequests").get();
    const rows = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as ContentListDoc))
      .filter((row) => !status || normalizedContentStatus(row) === status)
      .filter((row) => !type || normalizedValue(row.type) === type)
      .filter((row) => !userId || row.userId === userId)
      .sort((a, b) => {
        const byDate = createdAtTime(b.createdAt) - createdAtTime(a.createdAt);
        return byDate || b.id.localeCompare(a.id);
      });

    const start = cursor ? Math.max(rows.findIndex((row) => row.id === cursor) + 1, 0) : 0;
    const page = rows.slice(start, start + limit);

    return json({
      items: page.map(normalizeContentRow),
      nextCursor: start + limit < rows.length ? page[page.length - 1]?.id ?? null : null,
    });
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}

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

  const ownerName = pickName(owner, clientUserName);
  const taggedUserIds = type === "own" ? [userId] : parseTaggedUserIds(body).filter((id) => id !== userId);
  if (type === "duality" && taggedUserIds.length === 0) return error("missing_tagged_user", 400);
  if (type === "duality" && taggedUserIds.length !== parseTaggedUserIds(body).length) {
    return error("tagged_user_same_as_owner", 400);
  }

  const taggedUsers: TaggedUserState[] = [];
  for (const taggedUserId of taggedUserIds) {
    const tagged = type === "own" ? owner : await getDoc<UserDoc>("users", taggedUserId);
    if (!tagged) return error("tagged_user_not_found", 404, { taggedUserId });
    taggedUsers.push({
      userId: taggedUserId,
      name: type === "own" ? ownerName : pickName(tagged, "Tagged User"),
      action: type === "own" ? "accepted" : "pending",
    });
  }

  const primaryTagged = taggedUsers[0];
  const taggedNames = taggedUsers.map((user) => user.name).join(", ");

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
      taggedUserId: primaryTagged.userId,
      taggedUserName: taggedNames,
      taggedUserAction,
      taggedUsers,
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
        taggedUserId: primaryTagged.userId,
        taggedUserName: primaryTagged.name,
        taggedUserAction: "pending",
        taggedUsers,
      });
    }
    const notifyResult = await notifyAdminRequestCreated({
      requestId: id,
      type: "Content",
      userName: ownerName,
      userEmail: owner.email || "",
      details: `Title: ${String(body.postTitle || "N/A")}\nType: ${type}\nContent: ${String(body.postPreview || "N/A")}`,
      dashboardPath: `/dashboard/content/${id}`,
      docPath: `contentRequests/${id}`,
    });
    console.log("[content][create] admin_email_result", { id, notifyResult });
    return json({ id }, 201);
  } catch (e) {
    return error("create_failed", 500, { detail: String((e as Error).message) });
  }
}
