"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, FileText, GitBranch, Loader2, Plus, ShieldCheck } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { UserPicker, type UserPickerOption } from "@/components/ui/user-picker";
import { useAuthStore } from "@/lib/stores/auth-store";
import { readJson } from "@/lib/http";

type UserPostOption = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  createdAt: unknown;
};

const FIELD_CLASS =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-main outline-none transition-colors focus:border-white/20";

export default function BmidTransferPage() {
  const apiToken = useAuthStore((s) => s.apiToken);
  const [requestType, setRequestType] = useState<"own" | "duality">("own");
  const [ownerUser, setOwnerUser] = useState<UserPickerOption | null>(null);
  const [taggedUser, setTaggedUser] = useState<UserPickerOption | null>(null);
  const [postId, setPostId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);

  const postsQuery = useQuery({
    queryKey: ["bmid-transfer", "posts", ownerUser?.id],
    queryFn: async () => {
      const resp = await fetch(`/api/users/${ownerUser!.id}/posts?limit=100`, {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<{ items: UserPostOption[] }>(resp);
    },
    enabled: Boolean(apiToken && ownerUser?.id),
  });

  const selectedPost = useMemo(
    () => (postsQuery.data?.items || []).find((item) => item.id === postId) || null,
    [postId, postsQuery.data?.items]
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!ownerUser || !title.trim() || !description.trim()) throw new Error("missing_fields");
      const resp = await fetch("/api/content", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: ownerUser.id,
          userName: ownerUser.displayName,
          postId: postId || null,
          postTitle: title.trim(),
          postPreview: description.trim(),
          postImageUrl: imageUrl.trim() || null,
          type: requestType,
          taggedUserId: requestType === "duality" ? taggedUser?.id || null : null,
          taggedUserName: requestType === "duality" ? taggedUser?.displayName || null : null,
        }),
      });
      return readJson<{ id: string }>(resp);
    },
    onSuccess: (data) => {
      setCreatedRequestId(data.id);
    },
  });

  function handleOwnerSelect(user: UserPickerOption) {
    setOwnerUser(user);
    setPostId("");
    setTitle("");
    setDescription("");
    setImageUrl("");
    setCreatedRequestId(null);
    if (requestType === "own") {
      setTaggedUser(user);
    }
  }

  function handlePostChange(nextPostId: string) {
    setPostId(nextPostId);
    const post = (postsQuery.data?.items || []).find((item) => item.id === nextPostId);
    setTitle(post?.title || "");
    setDescription(post?.description || "");
    setImageUrl(post?.imageUrl || "");
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl text-primary font-bold">
          <ArrowRightLeft className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-main">BMID Transfer</h1>
          <p className="text-sm text-muted font-medium italic">Simulate the user transfer flow from a normal in-app post</p>
        </div>
      </div>

      <div className="card max-w-4xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(["own", "duality"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setRequestType(type);
                setCreatedRequestId(null);
                if (type === "own" && ownerUser) setTaggedUser(ownerUser);
                if (type === "duality") setTaggedUser(null);
              }}
              className={`rounded-xl border p-4 text-left transition-all ${
                requestType === type
                  ? type === "own"
                    ? "border-blue-500/30 bg-blue-500/10"
                    : "border-purple-500/30 bg-purple-500/10"
                  : "border-white/10 bg-white/[0.02] hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-2">
                {type === "own" ? <FileText className="w-4 h-4 text-blue-300" /> : <GitBranch className="w-4 h-4 text-purple-300" />}
                <span className="text-sm font-bold uppercase text-main">{type}</span>
              </div>
              <p className="mt-2 text-xs text-muted">
                {type === "own"
                  ? "User A transfers their own post into BMID Content."
                  : "User A transfers a post and tags User B for duality approval."}
              </p>
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs text-tertiary">Acting User *</label>
          <UserPicker token={apiToken!} value={ownerUser} onSelect={handleOwnerSelect} disabled={!apiToken || createMutation.isPending} />
        </div>

        {requestType === "duality" ? (
          <div className="space-y-1.5">
            <label className="block text-xs text-tertiary">Tagged User *</label>
            <UserPicker token={apiToken!} value={taggedUser} onSelect={setTaggedUser} disabled={!apiToken || createMutation.isPending} />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label className="block text-xs text-tertiary">Post ID *</label>
          <select
            value={postId}
            onChange={(e) => handlePostChange(e.target.value)}
            disabled={!ownerUser || postsQuery.isLoading || createMutation.isPending}
            className={FIELD_CLASS}
          >
            <option value="">
              {!ownerUser ? "Select a user first" : postsQuery.isLoading ? "Loading posts..." : "Select a post"}
            </option>
            {(postsQuery.data?.items || []).map((post) => (
              <option key={post.id} value={post.id}>
                {post.id} - {post.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs text-tertiary">Post Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD_CLASS} disabled={createMutation.isPending} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-tertiary">Post Image URL</label>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={FIELD_CLASS} disabled={createMutation.isPending} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs text-tertiary">Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={FIELD_CLASS}
            disabled={createMutation.isPending}
          />
        </div>

        {selectedPost?.imageUrl || imageUrl ? (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl || selectedPost?.imageUrl || ""} alt={title || "Selected post"} className="max-h-72 w-full object-cover" />
          </div>
        ) : null}

        {createMutation.isError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {createMutation.error.message}
          </div>
        ) : null}

        {createdRequestId ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">
            Created BMID request `{createdRequestId}`. {requestType === "duality" ? "It is now waiting on the tagged user." : "It is now pending admin review."}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-300 mt-0.5" />
            <p className="text-sm text-muted">
              This page simulates the missing user-facing transfer flow by letting admin choose which user is performing the action.
            </p>
          </div>
          <button
            onClick={() => void createMutation.mutateAsync()}
            disabled={
              createMutation.isPending ||
              !ownerUser ||
              !postId ||
              !title.trim() ||
              !description.trim() ||
              (requestType === "duality" && !taggedUser)
            }
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Request
          </button>
        </div>
      </div>
    </div>
  );
}
