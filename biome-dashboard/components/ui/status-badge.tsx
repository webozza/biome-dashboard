"use client";

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "bg-slate-500/10", text: "text-slate-400", dot: "bg-slate-400" },
  submitted: { bg: "bg-cyan-500/10", text: "text-cyan-400", dot: "bg-cyan-400" },
  pending: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  pending_admin_review: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  pending_tagged_user: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" },
  pending_voting: { bg: "bg-violet-500/10", text: "text-violet-400", dot: "bg-violet-400" },
  approved: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  rejected: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  removed: { bg: "bg-gray-500/10", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-500" },
  appealed: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", dot: "bg-purple-500" },
  in_review: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  cancelled: { bg: "bg-gray-500/10", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400" },
  waiting_tagged: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500" },
  open: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  closed: { bg: "bg-gray-500/10", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400" },
  finalized: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  accepted: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  declined: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  refused: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  ignored: { bg: "bg-gray-500/10", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400" },
  low: { bg: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400", dot: "bg-sky-500" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  high: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  reviewed: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  resolved: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  reported: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500" },
  blocked: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  flagged: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  warning: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  active: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  own: { bg: "bg-sky-500/10", text: "text-sky-400", dot: "bg-sky-400" },
  duality: { bg: "bg-fuchsia-500/10", text: "text-fuchsia-400", dot: "bg-fuchsia-400" },
  instagram: { bg: "bg-rose-500/10", text: "text-rose-400", dot: "bg-rose-400" },
  tiktok: { bg: "bg-white/5", text: "text-white", dot: "bg-white" },
  youtube: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  facebook: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  note_added: { bg: "bg-cyan-500/10", text: "text-cyan-400", dot: "bg-cyan-400" },
  status_changed: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  tagged_user_action: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" },
  voting_opened: { bg: "bg-violet-500/10", text: "text-violet-400", dot: "bg-violet-400" },
  voting_closed: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400" },
  notification_sent: { bg: "bg-cyan-500/10", text: "text-cyan-400", dot: "bg-cyan-400" },
};

const fallback = { bg: "bg-gray-500/10", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400" };

export function StatusBadge({ status, size = "sm" }: { status: string; size?: "xs" | "sm" }) {
  const config = statusConfig[status] || fallback;
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg font-black tracking-[0.1em] uppercase ${config.bg} ${config.text} ${
        size === "xs" ? "px-2 py-0.5 text-[8px]" : "px-3 py-1.5 text-[9px]"
      } border border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.2)] relative overflow-hidden group`}
    >
      <div className={`absolute inset-0 opacity-30 ${config.bg} blur-md group-hover:opacity-50 transition-opacity`} />
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} shadow-[0_0_10px_currentColor] relative z-10`} />
      <span className="relative z-10">{label}</span>
    </span>
  );
}
