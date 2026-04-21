import type { BmidBoxRequest, BmidBoxSettings } from "@/lib/data/bmid-box";
import { readJson } from "@/lib/http";

export { readJson };

export type BmidBoxListResponse = {
  items: Array<BmidBoxRequest & { id: string }>;
  summary: {
    total: number;
    pendingAdminReview: number;
    pendingTaggedUser: number;
    pendingVoting: number;
    approved: number;
    refused: number;
    removed: number;
  };
};

export type BmidBoxAuditRow = {
  id: string;
  requestId: string;
  ownerName: string;
  taggedName: string | null;
  requestType: "own" | "duality";
  sourcePlatform: string;
  requestStatus: string;
  votingStatus: string | null;
  actionType: string;
  actorName: string;
  note: string;
  rejectionReason: string | null;
  removalReason: string | null;
  createdAt: string;
};

export async function fetchBmidBoxRequests(apiToken: string, params?: URLSearchParams) {
  const resp = await fetch(`/api/bmid-box/requests${params ? `?${params.toString()}` : ""}`, {
    headers: { authorization: `Bearer ${apiToken}` },
  });
  return readJson<BmidBoxListResponse>(resp);
}

export async function fetchBmidBoxRequest(apiToken: string, id: string) {
  const resp = await fetch(`/api/bmid-box/requests/${id}`, {
    headers: { authorization: `Bearer ${apiToken}` },
  });
  return readJson<BmidBoxRequest & { id: string }>(resp);
}

export async function postBmidBoxAction<T>(
  apiToken: string,
  path: string,
  body: Record<string, unknown> = {}
) {
  const resp = await fetch(path, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return readJson<T>(resp);
}

export async function createBmidBoxRequest(
  apiToken: string,
  body: Record<string, unknown>
) {
  const resp = await fetch("/api/bmid-box/requests", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return readJson<{ id: string }>(resp);
}

export async function seedBmidBoxRequestsApi(apiToken: string, force = false) {
  const resp = await fetch(`/api/bmid-box/admin/seed${force ? "?force=true" : ""}`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiToken}` },
  });
  return readJson<{
    insertedCount: number;
    skippedCount: number;
    totalSeedFixtures: number;
    forced: boolean;
  }>(resp);
}

export async function castBmidBoxVoteApi(
  apiToken: string,
  requestId: string,
  body: { voterUserId: string; voterName: string; voteType: "accept" | "ignore" | "refuse" }
) {
  const resp = await fetch(`/api/bmid-box/voting/${requestId}/cast`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return readJson<BmidBoxRequest & { id: string }>(resp);
}

export async function resetBmidBoxRequestsApi(apiToken: string) {
  const resp = await fetch("/api/bmid-box/admin/reset", {
    method: "POST",
    headers: { authorization: `Bearer ${apiToken}` },
  });
  return readJson<{ deletedCount: number }>(resp);
}

export async function patchBmidBoxSettingsRequest(
  apiToken: string,
  patch: Partial<BmidBoxSettings>
) {
  const resp = await fetch("/api/bmid-box/settings", {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(patch),
  });
  return readJson<BmidBoxSettings & { id: string }>(resp);
}
