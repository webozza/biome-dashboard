import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { json } from "@/lib/server/response";
import { getDoc, listCollection, updateDoc } from "@/lib/server/firestore";

export const dynamic = "force-dynamic";

type UserDoc = {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  bmidNumber?: string | null;
  verified?: boolean;
};

function pickName(user: UserDoc | null, fallback: string) {
  if (!user) return fallback;
  return user.name || user.displayName || user.email || fallback;
}

async function resolveUser(cache: Map<string, UserDoc | null>, userId: string | null | undefined) {
  if (!userId) return null;
  if (cache.has(userId)) return cache.get(userId) ?? null;
  const user = await getDoc<UserDoc>("users", userId);
  cache.set(userId, user);
  return user;
}

async function backfillContentRequests(cache: Map<string, UserDoc | null>) {
  const { items } = await listCollection<Record<string, unknown>>("contentRequests", { limit: 500 });
  let updated = 0;
  for (const request of items) {
    const userId = typeof request.userId === "string" ? request.userId : "";
    const taggedUserId = typeof request.taggedUserId === "string" ? request.taggedUserId : "";
    const owner = await resolveUser(cache, userId);
    const tagged = taggedUserId === userId ? owner : await resolveUser(cache, taggedUserId);

    const patch: Record<string, unknown> = {};
    if (owner) {
      const ownerName = pickName(owner, (request.userName as string) || "Unknown user");
      if (request.userName !== ownerName) patch.userName = ownerName;
      const bmid = owner.bmidNumber ?? null;
      if (request.bmidNumber !== bmid) patch.bmidNumber = bmid;
    }
    if (tagged) {
      const taggedName = pickName(tagged, (request.taggedUserName as string) || "Unknown user");
      if (request.taggedUserName !== taggedName) patch.taggedUserName = taggedName;
    }

    if (Object.keys(patch).length > 0) {
      await updateDoc("contentRequests", request.id, patch);
      updated += 1;
    }
  }
  return { scanned: items.length, updated };
}

async function backfillBmidBoxRequests(cache: Map<string, UserDoc | null>) {
  const { items } = await listCollection<Record<string, unknown>>("bmidBoxRequests", { limit: 500 });
  let updated = 0;
  for (const request of items) {
    const ownerUserId = typeof request.ownerUserId === "string" ? request.ownerUserId : "";
    const taggedUserId = typeof request.taggedUserId === "string" ? request.taggedUserId : "";
    const owner = await resolveUser(cache, ownerUserId);
    const tagged = taggedUserId === ownerUserId ? owner : await resolveUser(cache, taggedUserId);

    const patch: Record<string, unknown> = {};
    if (owner) {
      patch.ownerSnapshot = {
        userId: ownerUserId,
        name: pickName(owner, "Unknown owner"),
        bmidNumber: owner.bmidNumber ?? null,
        verified: Boolean(owner.verified),
      };
      patch.ownerVerified = Boolean(owner.verified);
    }
    if (tagged) {
      patch.taggedSnapshot = {
        userId: taggedUserId || ownerUserId,
        name: pickName(tagged, "Unknown tagged user"),
        bmidNumber: tagged.bmidNumber ?? null,
        verified: Boolean(tagged.verified),
      };
      patch.taggedUserVerified = Boolean(tagged.verified);
    }

    if (Object.keys(patch).length > 0) {
      await updateDoc("bmidBoxRequests", request.id, patch);
      updated += 1;
    }
  }
  return { scanned: items.length, updated };
}

async function backfillDualityRequests(cache: Map<string, UserDoc | null>) {
  const { items } = await listCollection<Record<string, unknown>>("dualityRequests", { limit: 500 });
  let updated = 0;
  for (const request of items) {
    const ownerId = typeof request.ownerId === "string" ? request.ownerId : "";
    const taggedUserId = typeof request.taggedUserId === "string" ? request.taggedUserId : "";
    const owner = await resolveUser(cache, ownerId);
    const tagged = taggedUserId === ownerId ? owner : await resolveUser(cache, taggedUserId);

    const patch: Record<string, unknown> = {};
    if (owner) {
      const ownerName = pickName(owner, (request.ownerName as string) || "Unknown owner");
      if (request.ownerName !== ownerName) patch.ownerName = ownerName;
    }
    if (tagged) {
      const taggedName = pickName(tagged, (request.taggedUserName as string) || "Unknown tagged user");
      if (request.taggedUserName !== taggedName) patch.taggedUserName = taggedName;
    }

    if (Object.keys(patch).length > 0) {
      await updateDoc("dualityRequests", request.id, patch);
      updated += 1;
    }
  }
  return { scanned: items.length, updated };
}

export async function POST(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  const cache = new Map<string, UserDoc | null>();
  const content = await backfillContentRequests(cache);
  const box = await backfillBmidBoxRequests(cache);
  const duality = await backfillDualityRequests(cache);

  return json({ content, box, duality });
}
