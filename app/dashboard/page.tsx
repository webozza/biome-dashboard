"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Users,
  ShieldCheck,
  Clock,
  FileText,
  Box,
  GitBranch,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Vote,
  ArrowUpRight,
} from "lucide-react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth-store";
import { AuthGate } from "@/components/ui/auth-gate";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricCard } from "@/components/ui/metric-card";

type DashboardSummary = {
  kpi: {
    totalUsers: number;
    verifiedUsers: number;
    pendingVerification: number;
    pendingContent: number;
    pendingBox: number;
    pendingDuality: number;
    approvedTotal: number;
    refusedTotal: number;
  };
  bmidBox: {
    total: number;
    pendingAdminReview: number;
    pendingTaggedUser: number;
    pendingVoting: number;
    approved: number;
    refused: number;
    removed: number;
  };
  content: {
    total: number;
    pending: number;
    waitingTagged: number;
    inReview: number;
    approved: number;
    rejected: number;
    cancelled: number;
  };
  volume: { date: string; verification: number; content: number; box: number; duality: number }[];
  breakdown: { name: string; value: number; color: string }[];
  breakdownPendingTotal: number;
  activity: {
    id: string;
    type: string;
    description: string;
    user: string;
    timestamp: string;
  }[];
  flagged: {
    id: string;
    type: string;
    description: string;
    severity: string;
    status: string;
    flaggedAt: string;
  }[];
  pendingActions: {
    verification: number;
    contentOwn: number;
    dualityWaitingTagged: number;
    votingOpen: number;
    flaggedOpen: number;
  };
};

const activityDotColor: Record<string, string> = {
  verification: "bg-blue-500",
  approval: "bg-emerald-500",
  refusal: "bg-red-500",
  duality: "bg-orange-500",
  removal: "bg-gray-500",
  flag: "bg-amber-500",
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-xl px-4 py-3 bg-tooltip shadow-lg">
      <p className="text-[10px] text-white opacity-50 mb-1.5 font-medium uppercase tracking-wider">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: <span className="font-bold">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const apiToken = useAuthStore((s) => s.apiToken);
  const [summaryTab, setSummaryTab] = useState<"content" | "box">("content");

  const query = useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/summary", {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      if (!res.ok) throw new Error("summary_failed");
      return res.json();
    },
    enabled: Boolean(apiToken),
    refetchInterval: 30_000,
  });

  if (!apiToken) {
    return <AuthGate icon={TrendingUp} title="Dashboard Overview" subtitle="Sign in to view live platform metrics" />;
  }

  const data = query.data;
  const loading = query.isLoading || !data;

  const kpiCards = data
    ? [
        { label: "Total Users", value: data.kpi.totalUsers, icon: Users, color: "#3b82f6", href: "/dashboard/users" },
        { label: "Verified BMID", value: data.kpi.verifiedUsers, icon: ShieldCheck, color: "#10b981", href: "/dashboard/verification?status=approved" },
        { label: "Pending Verify", value: data.kpi.pendingVerification, icon: Clock, color: "#f59e0b", href: "/dashboard/verification?status=pending" },
        { label: "Content Req", value: data.kpi.pendingContent, icon: FileText, color: "#8b5cf6", href: "/dashboard/content?status=pending" },
        { label: "Box Req", value: data.kpi.pendingBox, icon: Box, color: "#06b6d4", href: "/dashboard/bmid-box?status=pending" },
        { label: "Duality", value: data.kpi.pendingDuality, icon: GitBranch, color: "#f97316", href: "/dashboard/duality" },
        { label: "Approved", value: data.kpi.approvedTotal, icon: CheckCircle, color: "#22c55e", href: undefined },
        { label: "Refused", value: data.kpi.refusedTotal, icon: XCircle, color: "#ef4444", href: undefined },
      ]
    : [];

  const pendingActions = data
    ? [
        { label: "Pending verifications", count: data.pendingActions.verification, icon: ShieldCheck, color: "text-amber-500", href: "/dashboard/verification?status=pending" },
        { label: "Pending content reviews", count: data.pendingActions.contentOwn, icon: FileText, color: "text-blue-500", href: "/dashboard/content?status=pending" },
        { label: "Waiting on tagged user", count: data.pendingActions.dualityWaitingTagged, icon: GitBranch, color: "text-orange-500", href: "/dashboard/duality" },
        { label: "Voting sessions open", count: data.pendingActions.votingOpen, icon: Vote, color: "text-purple-500", href: "/dashboard/voting" },
        { label: "Flagged items", count: data.pendingActions.flaggedOpen, icon: AlertTriangle, color: "text-red-500", href: "/dashboard/moderation" },
      ]
    : [];

  const pendingActionsTotal = pendingActions.reduce((s, a) => s + a.count, 0);
  const activeSummary =
    summaryTab === "content"
      ? {
          title: "BMID Content Summary",
          subtitle: "Live content request counts from Firestore",
          icon: FileText,
          href: "/dashboard/content",
          accent: "#8b5cf6",
          total: data?.content.total ?? "—",
          rows: data
            ? ([
                { label: "Total requests", value: data.content.total, href: "/dashboard/content" },
                { label: "Pending review", value: data.content.pending, href: "/dashboard/content?status=pending" },
                { label: "Waiting tagged", value: data.content.waitingTagged, href: "/dashboard/content?status=waiting_tagged" },
                { label: "Approved", value: data.content.approved + data.content.inReview, href: "/dashboard/content?status=approved" },
                { label: "Rejected", value: data.content.rejected, href: "/dashboard/content?status=rejected" },
                { label: "Cancelled", value: data.content.cancelled, href: "/dashboard/content?status=cancelled" },
              ] as const)
            : Array.from({ length: 6 }).map(() => ({ label: "—", value: "—", href: "/dashboard/content" })),
        }
      : {
          title: "BMID Box Summary",
          subtitle: "Live box request queue counts from Firestore",
          icon: Box,
          href: "/dashboard/bmid-box",
          accent: "#06b6d4",
          total: data?.bmidBox.total ?? "—",
          rows: data
            ? ([
                { label: "Total requests", value: data.bmidBox.total, href: "/dashboard/bmid-box" },
                { label: "Admin review", value: data.bmidBox.pendingAdminReview, href: "/dashboard/bmid-box?status=pending_admin_review" },
                { label: "Tagged user", value: data.bmidBox.pendingTaggedUser, href: "/dashboard/bmid-box?status=pending_tagged_user" },
                { label: "Voting", value: data.bmidBox.pendingVoting, href: "/dashboard/bmid-box?status=pending_voting" },
                { label: "Approved", value: data.bmidBox.approved, href: "/dashboard/bmid-box?status=approved" },
                { label: "Refused", value: data.bmidBox.refused, href: "/dashboard/bmid-box?status=refused" },
                { label: "Removed", value: data.bmidBox.removed, href: "/dashboard/bmid-box?status=removed" },
              ] as const)
            : Array.from({ length: 7 }).map(() => ({ label: "—", value: "—", href: "/dashboard/bmid-box" })),
        };
  const summaryTabs = [
    {
      key: "content" as const,
      label: "Content",
      icon: FileText,
      total: data?.content.total ?? "—",
      pending: data?.content.pending ?? "—",
      color: "#8b5cf6",
    },
    {
      key: "box" as const,
      label: "Box",
      icon: Box,
      total: data?.bmidBox.total ?? "—",
      pending: data?.kpi.pendingBox ?? "—",
      color: "#06b6d4",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
            <TrendingUp className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-main">Dashboard Overview</h1>
            <p className="text-muted text-sm font-medium">
              Monitor activity and manage your platform at a glance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-60"
          >
            <TrendingUp className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {query.isError && (
        <div className="card p-4 border border-red-500/30 bg-red-500/5 text-sm text-red-400">
          Failed to load dashboard data. <button onClick={() => query.refetch()} className="underline ml-2">Retry</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-4 pb-2">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card p-5 h-[120px] animate-pulse bg-surface-hover/40" />
            ))
          : kpiCards.map((card) => (
              <MetricCard
                key={card.label}
                title={card.label}
                value={card.value}
                icon={card.icon}
                color={card.color}
                href={card.href}
              />
            ))}
      </div>

      {/* BMID Summary */}
      <div className="rounded-2xl border border-border bg-surface">
        <div className="flex flex-col gap-4 border-b border-border p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="font-extrabold tracking-tight text-main">{activeSummary.title}</h3>
            <p className="mt-1 text-xs font-medium text-muted">{activeSummary.subtitle}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-grid grid-cols-2 rounded-xl border border-border bg-background p-1">
              {summaryTabs.map((tab) => {
                const Icon = tab.icon;
                const active = summaryTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSummaryTab(tab.key)}
                    className={`flex min-w-[150px] items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                      active
                        ? "bg-surface-hover text-main ring-1 ring-border"
                        : "text-muted hover:bg-surface hover:text-main"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-black uppercase tracking-[0.14em]">{tab.label}</span>
                    </span>
                    <span className="text-sm font-black tabular-nums">{tab.total}</span>
                  </button>
                );
              })}
            </div>
            <Link
              href={activeSummary.href}
              className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted transition hover:text-main"
            >
              View all
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-3">
          {activeSummary.rows.map((row, idx) => (
            <Link
              key={`${row.label}-${idx}`}
              href={row.href}
              className="group flex min-h-[86px] items-center justify-between gap-4 bg-surface p-4 transition hover:bg-surface-hover"
            >
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">{row.label}</p>
                <p className="mt-1 text-[10px] font-medium text-muted">
                  {idx === 0 ? "All records" : "Filtered view"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-2xl font-extrabold tracking-tight text-main tabular-nums">{row.value}</p>
                <ArrowUpRight className="h-4 w-4 text-muted opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Charts Row 1: Area Line + Donut */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 min-w-0 card overflow-hidden p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-primary rounded-full" />
              <div>
                <h3 className="font-extrabold text-main tracking-tight">Request Volume</h3>
                <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Last 6 months</p>
              </div>
            </div>
          </div>
          <div className="h-80">
            {data && data.volume.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.volume}>
                  <defs>
                    <linearGradient id="gVerif" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gContent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--primary)", strokeWidth: 1 }} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{
                      fontSize: "10px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      paddingTop: "20px",
                    }}
                  />
                  <Area type="monotone" dataKey="verification" name="Verification" stroke="#10b981" strokeWidth={3} fill="url(#gVerif)" />
                  <Area type="monotone" dataKey="content" name="Content" stroke="#8b5cf6" strokeWidth={3} fill="url(#gContent)" />
                  <Line type="monotone" dataKey="box" name="Box" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)" }} />
                  <Line type="monotone" dataKey="duality" name="Duality" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)" }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState loading={loading} message="No request activity yet." />
            )}
          </div>
        </div>

        {/* Status Breakdown Donut */}
        <div className="card p-6 min-w-0">
          <div className="mb-6">
            <h3 className="font-extrabold text-main tracking-tight">Status Breakdown</h3>
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Across all requests</p>
          </div>
          <div className="h-56 relative">
            {data && data.breakdown.some((b) => b.value > 0) ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.breakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={6}
                      dataKey="value"
                      stroke="none"
                    >
                      {data.breakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.[0] ? (
                          <div className="rounded-xl px-4 py-2 bg-tooltip shadow-2xl border border-white/10">
                            <p className="text-xs font-bold text-white uppercase tracking-widest">
                              {payload[0].name}: <span className="text-primary">{String(payload[0].value)}</span>
                            </p>
                          </div>
                        ) : null
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-4xl font-black text-main leading-none">{data.breakdownPendingTotal}</p>
                    <p className="text-[10px] text-muted font-bold uppercase tracking-[0.2em] mt-1">Pending</p>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState loading={loading} message="No request data yet." />
            )}
          </div>
          {data && (
            <div className="grid grid-cols-2 gap-4 mt-8">
              {data.breakdown.map((item) => (
                <div key={item.name} className="flex items-center gap-3 p-2 rounded-lg bg-surface-hover/50 border border-border/50">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-tighter truncate">{item.name}</p>
                    <p className="text-xs font-black text-main">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Pending Actions + Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Pending Action Queue */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-extrabold text-main tracking-tight">Action Backlog</h3>
              <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-0.5">Items awaiting review</p>
            </div>
            <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 ring-1 ring-red-500/20">
              {pendingActionsTotal} TOTAL
            </span>
          </div>
          <div className="space-y-2.5">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-xl animate-pulse bg-surface-hover/40" />
                ))
              : pendingActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="group flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all bg-surface hover:bg-surface-hover border border-border hover:border-primary/30 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-background ${action.color.replace("text-", "bg-").replace("-500", "-500/10")} ${action.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-main group-hover:text-primary transition-colors">{action.label}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-black text-main">{action.count}</span>
                        <ArrowUpRight className="w-4 h-4 text-muted group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </div>
                    </Link>
                  );
                })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="xl:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-extrabold text-main tracking-tight">Recent Activity</h3>
              <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Latest audit log entries</p>
            </div>
          </div>
          <div className="space-y-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl animate-pulse bg-surface-hover/40" />
              ))
            ) : data && data.activity.length > 0 ? (
              data.activity.map((activity) => (
                <Link
                  key={activity.id}
                  href="/dashboard/audit"
                  className="flex items-start gap-5 p-4 rounded-xl transition-all cursor-pointer hover:bg-surface-hover group border border-transparent hover:border-border"
                >
                  <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ring-4 ring-background ${activityDotColor[activity.type] || "bg-muted opacity-50"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-main font-medium group-hover:text-primary transition-colors">{activity.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted uppercase tracking-widest">
                        <Clock className="w-3 h-3" />
                        {new Date(activity.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <span className="w-1 h-1 bg-border rounded-full" />
                      <span className="text-[10px] font-black text-primary uppercase tracking-tighter">{activity.user}</span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted italic">No recent activity.</p>
            )}
          </div>
        </div>
      </div>

      {/* Flagged Items */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-border bg-surface-hover/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500 ring-1 ring-amber-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-main tracking-tight">Flagged &amp; Moderation Queue</h3>
                <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-0.5">Open issues that need attention</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-amber-500">
                {data?.flagged.length ?? 0} OPEN
              </span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface border-b border-border">
                {["Type", "Description", "Severity", "Status", "Reported"].map((h) => (
                  <th key={h} className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-6 py-4">
                      <div className="h-6 rounded animate-pulse bg-surface-hover/40" />
                    </td>
                  </tr>
                ))
              ) : data && data.flagged.length > 0 ? (
                data.flagged.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => {
                      window.location.href = "/dashboard/moderation";
                    }}
                    className="group hover:bg-surface-hover/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4.5">
                      <span className="text-[10px] font-black text-main uppercase bg-surface-hover px-2.5 py-1 rounded-md border border-border group-hover:border-primary/20">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4.5">
                      <p className="text-sm font-semibold text-main max-w-md truncate group-hover:text-primary transition-colors">
                        {item.description}
                      </p>
                    </td>
                    <td className="px-6 py-4.5">
                      <StatusBadge status={item.severity} />
                    </td>
                    <td className="px-6 py-4.5">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-6 py-4.5 text-[11px] font-bold text-muted tabular-nums">
                      {item.flaggedAt ? new Date(item.flaggedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-muted italic">
                    No open flags. Everything looks calm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ loading, message }: { loading: boolean; message: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center">
      {loading ? (
        <div className="w-full h-full animate-pulse bg-surface-hover/30 rounded-xl" />
      ) : (
        <p className="text-xs text-muted italic">{message}</p>
      )}
    </div>
  );
}
