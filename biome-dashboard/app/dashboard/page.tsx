"use client";

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
        { label: "Total Users", value: data.kpi.totalUsers, icon: Users, color: "#3b82f6" },
        { label: "Verified BMID", value: data.kpi.verifiedUsers, icon: ShieldCheck, color: "#10b981" },
        { label: "Pending Verify", value: data.kpi.pendingVerification, icon: Clock, color: "#f59e0b" },
        { label: "Content Req", value: data.kpi.pendingContent, icon: FileText, color: "#8b5cf6" },
        { label: "Box Req", value: data.kpi.pendingBox, icon: Box, color: "#06b6d4" },
        { label: "Duality", value: data.kpi.pendingDuality, icon: GitBranch, color: "#f97316" },
        { label: "Approved", value: data.kpi.approvedTotal, icon: CheckCircle, color: "#22c55e" },
        { label: "Refused", value: data.kpi.refusedTotal, icon: XCircle, color: "#ef4444" },
      ]
    : [];

  const pendingActions = data
    ? [
        { label: "Pending verifications", count: data.pendingActions.verification, icon: ShieldCheck, color: "text-amber-500" },
        { label: "Pending content reviews", count: data.pendingActions.contentOwn, icon: FileText, color: "text-blue-500" },
        { label: "Waiting on tagged user", count: data.pendingActions.dualityWaitingTagged, icon: GitBranch, color: "text-orange-500" },
        { label: "Voting sessions open", count: data.pendingActions.votingOpen, icon: Vote, color: "text-purple-500" },
        { label: "Flagged items", count: data.pendingActions.flaggedOpen, icon: AlertTriangle, color: "text-red-500" },
      ]
    : [];

  const pendingActionsTotal = pendingActions.reduce((s, a) => s + a.count, 0);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 pb-2">
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
              />
            ))}
      </div>

      {/* BMID Box Summary */}
      <div className="card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold tracking-tight text-main">BMID Box Summary</h3>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
              Live queue counts from Firestore
            </p>
          </div>
          <Box className="h-5 w-5 text-primary" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-7">
          {(data
            ? ([
                ["Total Box requests", data.bmidBox.total],
                ["Pending admin review", data.bmidBox.pendingAdminReview],
                ["Pending tagged user", data.bmidBox.pendingTaggedUser],
                ["Pending voting", data.bmidBox.pendingVoting],
                ["Approved", data.bmidBox.approved],
                ["Refused", data.bmidBox.refused],
                ["Removed", data.bmidBox.removed],
              ] as const)
            : Array.from({ length: 7 }).map(() => ["", "—"] as const)
          ).map(([label, value], idx) => (
            <div key={String(label) || idx} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted">{label || "—"}</p>
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-main">{value}</p>
            </div>
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
                    <div
                      key={action.label}
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
                    </div>
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
                <div
                  key={activity.id}
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
                </div>
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
                  <tr key={item.id} className="group hover:bg-surface-hover/50 transition-colors cursor-pointer">
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
