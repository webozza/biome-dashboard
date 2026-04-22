"use client";

const EMERALD = "bg-emerald-500/20 dark:bg-emerald-500/10";
const AMBER = "bg-amber-500/20 dark:bg-amber-500/10";
const RED = "bg-red-500/20 dark:bg-red-500/10";
const ORANGE = "bg-orange-500/20 dark:bg-orange-500/10";
const BLUE = "bg-blue-500/20 dark:bg-blue-500/10";
const VIOLET = "bg-violet-500/20 dark:bg-violet-500/10";
const GRAY = "bg-gray-500/15 dark:bg-gray-500/10";
const CYAN = "bg-cyan-500/20 dark:bg-cyan-500/10";
const SKY = "bg-sky-500/20 dark:bg-sky-500/10";
const PURPLE = "bg-purple-500/20 dark:bg-purple-500/10";
const SLATE = "bg-slate-500/20 dark:bg-slate-500/10";
const ROSE = "bg-rose-500/20 dark:bg-rose-500/10";
const FUCHSIA = "bg-fuchsia-500/20 dark:bg-fuchsia-500/10";

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: SLATE, text: "text-slate-700 dark:text-slate-300", dot: "bg-slate-500" },
  submitted: { bg: CYAN, text: "text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500" },
  pending: { bg: AMBER, text: "text-amber-800 dark:text-amber-300", dot: "bg-amber-600" },
  pending_admin_review: { bg: AMBER, text: "text-amber-800 dark:text-amber-300", dot: "bg-amber-600" },
  pending_tagged_user: { bg: ORANGE, text: "text-orange-800 dark:text-orange-300", dot: "bg-orange-500" },
  pending_voting: { bg: VIOLET, text: "text-violet-800 dark:text-violet-300", dot: "bg-violet-500" },
  approved: { bg: EMERALD, text: "text-emerald-800 dark:text-emerald-300", dot: "bg-emerald-600" },
  rejected: { bg: RED, text: "text-red-800 dark:text-red-300", dot: "bg-red-600" },
  removed: { bg: GRAY, text: "text-gray-700 dark:text-gray-300", dot: "bg-gray-500" },
  appealed: { bg: PURPLE, text: "text-purple-800 dark:text-purple-300", dot: "bg-purple-500" },
  in_review: { bg: BLUE, text: "text-blue-800 dark:text-blue-300", dot: "bg-blue-600" },
  cancelled: { bg: GRAY, text: "text-gray-700 dark:text-gray-300", dot: "bg-gray-500" },
  waiting_tagged: { bg: ORANGE, text: "text-orange-800 dark:text-orange-300", dot: "bg-orange-600" },
  open: { bg: BLUE, text: "text-blue-800 dark:text-blue-300", dot: "bg-blue-600" },
  closed: { bg: GRAY, text: "text-gray-700 dark:text-gray-300", dot: "bg-gray-500" },
  finalized: { bg: EMERALD, text: "text-emerald-800 dark:text-emerald-300", dot: "bg-emerald-600" },
  accepted: { bg: EMERALD, text: "text-emerald-800 dark:text-emerald-300", dot: "bg-emerald-600" },
  declined: { bg: RED, text: "text-red-800 dark:text-red-300", dot: "bg-red-600" },
  refused: { bg: RED, text: "text-red-800 dark:text-red-300", dot: "bg-red-600" },
  ignored: { bg: GRAY, text: "text-gray-700 dark:text-gray-300", dot: "bg-gray-500" },
  low: { bg: SKY, text: "text-sky-800 dark:text-sky-300", dot: "bg-sky-600" },
  medium: { bg: AMBER, text: "text-amber-800 dark:text-amber-300", dot: "bg-amber-600" },
  high: { bg: RED, text: "text-red-800 dark:text-red-300", dot: "bg-red-600" },
  reviewed: { bg: BLUE, text: "text-blue-800 dark:text-blue-300", dot: "bg-blue-600" },
  resolved: { bg: EMERALD, text: "text-emerald-800 dark:text-emerald-300", dot: "bg-emerald-600" },
  reported: { bg: ORANGE, text: "text-orange-800 dark:text-orange-300", dot: "bg-orange-600" },
  blocked: { bg: RED, text: "text-red-800 dark:text-red-300", dot: "bg-red-600" },
  flagged: { bg: AMBER, text: "text-amber-800 dark:text-amber-300", dot: "bg-amber-600" },
  warning: { bg: AMBER, text: "text-amber-800 dark:text-amber-300", dot: "bg-amber-600" },
  active: { bg: EMERALD, text: "text-emerald-800 dark:text-emerald-300", dot: "bg-emerald-600" },
  own: { bg: SKY, text: "text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  duality: { bg: FUCHSIA, text: "text-fuchsia-700 dark:text-fuchsia-300", dot: "bg-fuchsia-500" },
  instagram: { bg: ROSE, text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  tiktok: { bg: "bg-neutral-500/20 dark:bg-white/5", text: "text-neutral-800 dark:text-white", dot: "bg-neutral-600 dark:bg-white" },
  youtube: { bg: RED, text: "text-red-700 dark:text-red-300", dot: "bg-red-500" },
  facebook: { bg: BLUE, text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  note_added: { bg: CYAN, text: "text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500" },
  status_changed: { bg: BLUE, text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  tagged_user_action: { bg: ORANGE, text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  voting_opened: { bg: VIOLET, text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  voting_closed: { bg: "bg-zinc-500/20 dark:bg-zinc-500/10", text: "text-zinc-700 dark:text-zinc-300", dot: "bg-zinc-500" },
  notification_sent: { bg: CYAN, text: "text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500" },
};

const fallback = { bg: GRAY, text: "text-gray-700 dark:text-gray-300", dot: "bg-gray-500" };

export function StatusBadge({ status, size = "sm" }: { status: string; size?: "xs" | "sm" }) {
  const config = statusConfig[status] || fallback;
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg font-black tracking-[0.1em] uppercase ${config.bg} ${config.text} ${
        size === "xs" ? "px-2 py-0.5 text-[8px]" : "px-3 py-1.5 text-[9px]"
      } border border-black/5 dark:border-white/10 dark:shadow-[0_0_15px_rgba(0,0,0,0.2)] relative overflow-hidden group`}
    >
      <div className={`absolute inset-0 opacity-0 dark:opacity-30 ${config.bg} dark:blur-md dark:group-hover:opacity-50 transition-opacity`} />
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} dark:shadow-[0_0_10px_currentColor] relative z-10`} />
      <span className="relative z-10">{label}</span>
    </span>
  );
}
