"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase-client";

type Me = {
  id: string;
  name: string;
  email: string;
  bmidNumber: string | null;
  verified: boolean;
};

type UserPost = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
};

async function authedFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const resp = await fetch(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
  const data = (await resp.json().catch(() => null)) as T & { error?: string; reason?: string };
  if (!resp.ok) throw new Error(data?.error || "request_failed");
  return data;
}

const FIELD_CLASS = "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-main outline-none transition-colors focus:border-white/20";

export default function UserTransferPage() {
  const [type, setType] = useState<"own" | "duality">("own");
  const [taggedUserId, setTaggedUserId] = useState("");
  const [postId, setPostId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ["bmid", "me"],
    queryFn: () => authedFetch<Me>("/api/bmid/me"),
  });

  const postsQuery = useQuery({
    queryKey: ["bmid", "me", "posts"],
    queryFn: () => authedFetch<{ items: UserPost[] }>("/api/bmid/me/posts?limit=100"),
  });

  const usersQuery = useQuery({
    queryKey: ["bmid", "users", "lookup"],
    queryFn: () => authedFetch<{ items: Array<{ id: string; displayName: string; email: string }> }>("/api/bmid/users/lookup?limit=200"),
    enabled: type === "duality",
  });

  const selectedPost = useMemo(
    () => (postsQuery.data?.items || []).find((item) => item.id === postId) || null,
    [postId, postsQuery.data?.items]
  );

  const transferMutation = useMutation({
    mutationFn: () =>
      authedFetch<{ id: string }>("/api/bmid/transfer", {
        method: "POST",
        body: JSON.stringify({
          type,
          postId,
          postTitle: title,
          postPreview: description,
          postImageUrl: imageUrl,
          taggedUserId: type === "duality" ? taggedUserId : undefined,
        }),
      }),
    onSuccess: (data) => setCreatedId(data.id),
  });

  function selectPost(nextPostId: string) {
    setPostId(nextPostId);
    const post = (postsQuery.data?.items || []).find((item) => item.id === nextPostId);
    setTitle(post?.title || "");
    setDescription(post?.description || "");
    setImageUrl(post?.imageUrl || "");
    setCreatedId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary"><ArrowRightLeft className="w-5 h-5" /></div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Transfer To BMID</h1>
          <p className="text-sm text-muted">Start from one of your normal posts and create an Own or Duality BMID request.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-5 max-w-4xl">
        {!meQuery.data?.verified ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
            Only verified users can transfer posts into BMID Content.
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          {(["own", "duality"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              className={`rounded-xl border p-4 text-left ${type === option ? "border-primary/30 bg-primary/5" : "border-white/10 bg-white/[0.02]"}`}
            >
              <p className="text-sm font-bold uppercase">{option}</p>
              <p className="mt-1 text-xs text-muted">{option === "own" ? "Transfer as your own BMID request." : "Tag another user for duality review."}</p>
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs text-tertiary">Your Post</label>
          <select value={postId} onChange={(e) => selectPost(e.target.value)} className={FIELD_CLASS}>
            <option value="">{postsQuery.isLoading ? "Loading posts..." : "Select a post"}</option>
            {(postsQuery.data?.items || []).map((post) => (
              <option key={post.id} value={post.id}>{post.id} - {post.title}</option>
            ))}
          </select>
        </div>

        {type === "duality" ? (
          <div className="space-y-1.5">
            <label className="block text-xs text-tertiary">Tagged User</label>
            <select value={taggedUserId} onChange={(e) => setTaggedUserId(e.target.value)} className={FIELD_CLASS}>
              <option value="">{usersQuery.isLoading ? "Loading users..." : "Select tagged user"}</option>
              {(usersQuery.data?.items || []).map((user) => (
                <option key={user.id} value={user.id}>{user.displayName} {user.email ? `(${user.email})` : ""}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD_CLASS} placeholder="Title" />
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={FIELD_CLASS} placeholder="Image URL" />
        </div>

        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={FIELD_CLASS} placeholder="Description" />

        {selectedPost?.imageUrl || imageUrl ? (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl || selectedPost?.imageUrl || ""} alt={title || "Post"} className="max-h-80 w-full object-cover" />
          </div>
        ) : null}

        {transferMutation.isError ? <div className="text-sm text-red-300">{transferMutation.error.message}</div> : null}
        {createdId ? <div className="text-sm text-emerald-300">Created request `{createdId}`.</div> : null}

        <button
          onClick={() => void transferMutation.mutate()}
          disabled={!meQuery.data?.verified || transferMutation.isPending || !postId || !title.trim() || !description.trim() || (type === "duality" && !taggedUserId)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {transferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Create BMID Request
        </button>
      </div>
    </div>
  );
}
