"use client";

type Palette = { bg: string; text: string; dot: string; border: string };

const mk = (hex: string): Palette => ({
  bg: `bg-[${hex}]/10`,
  text: `text-[${hex}]`,
  dot: `bg-[${hex}]`,
  border: `border-[${hex}]/20`,
});

const EMERALD: Palette = { bg: "bg-[#059669]/10 dark:bg-[#10b981]/10", text: "text-[#059669] dark:text-[#10b981]", dot: "bg-[#059669] dark:bg-[#10b981]", border: "border-[#059669]/20 dark:border-[#10b981]/20" };
const AMBER: Palette = mk("#f59e0b");
const RED: Palette = mk("#ef4444");
const ORANGE: Palette = mk("#f97316");
const BLUE: Palette = mk("#3b82f6");
const VIOLET: Palette = mk("#8b5cf6");
const GRAY: Palette = mk("#6b7280");
const CYAN: Palette = mk("#06b6d4");
const SKY: Palette = mk("#0ea5e9");
const PURPLE: Palette = mk("#a855f7");
const SLATE: Palette = mk("#64748b");
const ROSE: Palette = mk("#f43f5e");
const FUCHSIA: Palette = mk("#d946ef");
const ZINC: Palette = mk("#71717a");
const NEUTRAL: Palette = mk("#525252");

const statusConfig: Record<string, Palette> = {
  draft: SLATE,
  submitted: { bg: "bg-[#0891b2]/10", text: "text-[#0891b2]", dot: "bg-[#0891b2]", border: "border-[#0891b2]/20" },
  pending: AMBER,
  pending_admin_review: AMBER,
  pending_tagged_user: ORANGE,
  pending_voting: VIOLET,
  approved: EMERALD,
  rejected: RED,
  removed: GRAY,
  appealed: PURPLE,
  in_review: BLUE,
  cancelled: GRAY,
  waiting_tagged: { bg: "bg-[#ec4899]/10", text: "text-[#ec4899]", dot: "bg-[#ec4899]", border: "border-[#ec4899]/20" },
  open: { bg: "bg-[#0ea5e9]/10", text: "text-[#0ea5e9]", dot: "bg-[#0ea5e9]", border: "border-[#0ea5e9]/20" },
  closed: GRAY,
  finalized: EMERALD,
  accepted: EMERALD,
  declined: RED,
  refused: RED,
  ignored: { bg: "bg-[#64748b]/10", text: "text-[#64748b]", dot: "bg-[#64748b]", border: "border-[#64748b]/20" },
  low: SKY,
  medium: AMBER,
  high: RED,
  reviewed: BLUE,
  resolved: EMERALD,
  reported: ORANGE,
  blocked: RED,
  flagged: AMBER,
  warning: AMBER,
  active: EMERALD,
  own: SKY,
  duality: FUCHSIA,
  instagram: ROSE,
  tiktok: NEUTRAL,
  youtube: RED,
  facebook: BLUE,
  note_added: CYAN,
  status_changed: BLUE,
  tagged_user_action: ORANGE,
  voting_opened: VIOLET,
  voting_closed: ZINC,
  notification_sent: CYAN,
  actioned: { bg: "bg-[#6366f1]/10", text: "text-[#6366f1]", dot: "bg-[#6366f1]", border: "border-[#6366f1]/20" },
  dismissed: { bg: "bg-[#64748b]/10", text: "text-[#64748b]", dot: "bg-[#64748b]", border: "border-[#64748b]/20" },
};

const fallback = GRAY;

export function StatusBadge({ status, size = "sm" }: { status: string; size?: "xs" | "sm" }) {
  const config = statusConfig[status] || fallback;
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg font-black tracking-[0.1em] uppercase ${config.bg} ${config.text} ${
        size === "xs" ? "px-2 py-0.5 text-[8px]" : "px-3 py-1.5 text-[9px]"
      } border ${config.border} dark:shadow-[0_0_15px_rgba(0,0,0,0.2)] relative overflow-hidden group`}
    >
      <div className={`absolute inset-0 opacity-0 dark:opacity-30 ${config.bg} dark:blur-md dark:group-hover:opacity-50 transition-opacity`} />
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} dark:shadow-[0_0_10px_currentColor] relative z-10`} />
      <span className="relative z-10">{label}</span>
    </span>
  );
}
