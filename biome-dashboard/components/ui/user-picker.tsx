"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";

export type UserPickerOption = {
  id: string;
  displayName: string;
  email: string;
};

async function fetchUserOptions(token: string) {
  const resp = await fetch("/api/users/lookup?limit=200", {
    headers: { authorization: `Bearer ${token}` },
  });
  const data = (await resp.json().catch(() => null)) as
    | { items?: UserPickerOption[]; error?: string }
    | null;
  if (!resp.ok) throw new Error(data?.error || "users_lookup_failed");
  return data?.items || [];
}

interface UserPickerProps {
  token: string;
  value: UserPickerOption | null;
  onSelect: (user: UserPickerOption) => void;
  disabled?: boolean;
  verifiedOnly?: boolean;
}

async function fetchVerifiedUserOptions(token: string) {
  const resp = await fetch("/api/users/lookup?limit=200&verified=true", {
    headers: { authorization: `Bearer ${token}` },
  });
  const data = (await resp.json().catch(() => null)) as
    | { items?: UserPickerOption[]; error?: string }
    | null;
  if (!resp.ok) throw new Error(data?.error || "users_lookup_failed");
  return data?.items || [];
}

export function UserPicker({ token, value, onSelect, disabled = false, verifiedOnly = false }: UserPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const usersQuery = useQuery({
    queryKey: ["users", "lookup", verifiedOnly ? "verified" : "all"],
    queryFn: () => (verifiedOnly ? fetchVerifiedUserOptions(token) : fetchUserOptions(token)),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return usersQuery.data || [];
    return (usersQuery.data || []).filter(
      (user) =>
        user.displayName.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q)
    );
  }, [query, usersQuery.data]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-sm text-main outline-none transition-colors hover:border-white/15 disabled:opacity-60"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={`truncate ${value ? "text-main" : "text-muted"}`}>
              {value ? value.displayName : "Select a user"}
            </p>
            {value ? <p className="truncate text-xs text-muted">{value.email}</p> : null}
          </div>
          <ChevronDown className={`w-4 h-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[120] overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl">
          <div className="border-b border-white/5 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-main outline-none focus:border-white/20"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto custom-scrollbar p-2">
            {usersQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading users...
              </div>
            ) : usersQuery.isError ? (
              <div className="px-3 py-6 text-sm text-red-300">Failed to load users.</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-6 text-sm text-muted">{verifiedOnly ? "No verified users found." : "No active users found."}</div>
            ) : (
              filtered.map((user) => {
                const active = value?.id === user.id;
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      onSelect(user);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-main">{user.displayName}</p>
                      <p className="truncate text-xs text-muted">{user.email}</p>
                    </div>
                    {active ? <Check className="w-4 h-4 shrink-0 text-emerald-300" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
