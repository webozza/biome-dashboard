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
import {
  dashboardStats,
  requestVolumeData,
  statusBreakdownData,
  recentActivities,
  flaggedItems,
  verificationRequests,
  dualityRequests,
  votingItems,
} from "@/lib/data/mock-data";
import { getBmidBoxSummary } from "@/lib/data/bmid-box";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricCard } from "@/components/ui/metric-card";

const kpiCards = [
  { label: "Total Users", value: dashboardStats.totalUsers, icon: Users, color: "#3b82f6", trend: { value: "12%", isUp: true } },
  { label: "Verified BMID", value: dashboardStats.totalVerifiedUsers, icon: ShieldCheck, color: "#10b981", trend: { value: "8%", isUp: true } },
  { label: "Pending", value: dashboardStats.pendingVerifications, icon: Clock, color: "#f59e0b", trend: undefined },
  { label: "Content Req", value: dashboardStats.totalContentRequests, icon: FileText, color: "#8b5cf6", trend: { value: "5%", isUp: true } },
  { label: "Box Req", value: dashboardStats.totalBoxRequests, icon: Box, color: "#06b6d4", trend: { value: "3%", isUp: true } },
  { label: "Duality", value: dashboardStats.pendingDuality, icon: GitBranch, color: "#f97316", trend: undefined },
  { label: "Approved", value: dashboardStats.approvedRequests, icon: CheckCircle, color: "#22c55e", trend: { value: "15%", isUp: true } },
  { label: "Refused", value: dashboardStats.refusedRequests, icon: XCircle, color: "#ef4444", trend: { value: "2%", isUp: false } },
];

const pendingActions = [
  { label: "Pending verifications", count: verificationRequests.filter((v) => v.status === "pending").length, icon: ShieldCheck, color: "text-amber-500" },
  { label: "Pending Own reviews", count: 3, icon: FileText, color: "text-blue-500" },
  { label: "Waiting on tagged user", count: dualityRequests.filter((d) => d.status === "waiting_tagged").length, icon: GitBranch, color: "text-orange-500" },
  { label: "Voting ending soon", count: votingItems.filter((v) => v.status === "open").length, icon: Vote, color: "text-purple-500" },
  { label: "Flagged items", count: flaggedItems.filter((f) => f.status === "open").length, icon: AlertTriangle, color: "text-red-500" },
];

const activityDotColor: Record<string, string> = {
  verification: "bg-blue-500",
  approval: "bg-emerald-500",
  refusal: "bg-red-500",
  duality: "bg-orange-500",
  removal: "bg-gray-500",
  flag: "bg-amber-500",
};

const DONUT_COLORS = statusBreakdownData.map((d) => d.color);

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) {
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
  const bmidBoxSummary = getBmidBoxSummary();

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
            <TrendingUp className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-main">System Intelligence</h1>
            <p className="text-muted text-sm font-medium italic">
              Ecosystem metrics and operational oversight
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2.5 bg-surface border border-border rounded-xl text-[10px] font-bold shadow-sm ring-1 ring-border/50">
            <span className="text-muted mr-3 tracking-widest uppercase opacity-50">Heartbeat</span>
            <span className="text-main">{new Date().toLocaleTimeString()}</span>
          </div>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95">
            <FileText className="w-4 h-4" /> Export Ledger
          </button>
        </div>
      </div>

      {/* KPI Cards overflow handling */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 pb-2">
        {kpiCards.map((card) => (
          <MetricCard
            key={card.label}
            title={card.label}
            value={card.value}
            icon={card.icon}
            color={card.color}
            trend={card.trend}
          />
        ))}
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold tracking-tight text-main">BMID Box Summary</h3>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
              Requested top-line queue counts for admin dashboard
            </p>
          </div>
          <Box className="h-5 w-5 text-primary" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-7">
          {[
            ["Total Box requests", bmidBoxSummary.total],
            ["Pending admin review", bmidBoxSummary.pendingAdminReview],
            ["Pending tagged user", bmidBoxSummary.pendingTaggedUser],
            ["Pending voting", bmidBoxSummary.pendingVoting],
            ["Approved", bmidBoxSummary.approved],
            ["Refused", bmidBoxSummary.refused],
            ["Removed", bmidBoxSummary.removed],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted">{label}</p>
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
                <h3 className="font-extrabold text-main tracking-tight">Ecosystem Volume</h3>
                <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Aggregated traffic analytics</p>
              </div>
            </div>
            <div className="flex gap-1 p-1 rounded-xl bg-surface-hover border border-border shadow-inner">
              {["Month", "Week", "Day"].map((t) => (
                <button
                  key={t}
                  className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                    t === "Month" ? "bg-surface text-primary shadow-sm ring-1 ring-border" : "text-muted hover:text-main"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={requestVolumeData}>
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
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--primary)', strokeWidth: 1 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", paddingTop: "20px" }} />
                <Area type="monotone" dataKey="verification" name="Verification" stroke="#10b981" strokeWidth={3} fill="url(#gVerif)" />
                <Area type="monotone" dataKey="content" name="Content" stroke="#8b5cf6" strokeWidth={3} fill="url(#gContent)" />
                <Line type="monotone" dataKey="box" name="Box" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)" }} />
                <Line type="monotone" dataKey="duality" name="Duality" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Breakdown Donut */}
        <div className="card p-6 min-w-0">
          <div className="mb-6">
            <h3 className="font-extrabold text-main tracking-tight">Operational State</h3>
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Resource distribution</p>
          </div>
          <div className="h-56 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusBreakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={6}
                  dataKey="value"
                  stroke="none"
                >
                  {statusBreakdownData.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i]} />
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
                <p className="text-4xl font-black text-main leading-none">47</p>
                <p className="text-[10px] text-muted font-bold uppercase tracking-[0.2em] mt-1">Pending</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-8">
            {statusBreakdownData.map((item) => (
              <div key={item.name} className="flex items-center gap-3 p-2 rounded-lg bg-surface-hover/50 border border-border/50">
                <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-tighter truncate">{item.name}</p>
                  <p className="text-xs font-black text-main">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Pending Actions + Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Pending Action Queue */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-extrabold text-main tracking-tight">Action Backlog</h3>
              <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-0.5">Critical prioritizations</p>
            </div>
            <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 ring-1 ring-red-500/20">
              {pendingActions.reduce((s, a) => s + a.count, 0)} TOTAL
            </span>
          </div>
          <div className="space-y-2.5">
            {pendingActions.map((action) => {
              const Icon = action.icon;
              return (
                <div
                  key={action.label}
                  className="group flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all bg-surface hover:bg-surface-hover border border-border hover:border-primary/30 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-background ${action.color.replace('text-', 'bg-').replace('-500', '-500/10')} ${action.color}`}>
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
              <h3 className="font-extrabold text-main tracking-tight">Audit Stream</h3>
              <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Real-time ecosystem logs</p>
            </div>
            <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline decoration-2 underline-offset-4">Comprehensive Audit Feed</button>
          </div>
          <div className="space-y-4">
            {recentActivities.slice(0, 6).map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-5 p-4 rounded-xl transition-all cursor-pointer hover:bg-surface-hover group border border-transparent hover:border-border"
              >
                <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ring-4 ring-background ${activityDotColor[activity.type] || "bg-muted shadow-[0_0_10px_currentColor] opacity-50"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-main font-medium group-hover:text-primary transition-colors">{activity.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted uppercase tracking-widest">
                      <Clock className="w-3 h-3" />
                      {new Date(activity.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <span className="w-1 h-1 bg-border rounded-full" />
                    <span className="text-[10px] font-black text-primary uppercase tracking-tighter">System Node: 01</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Flagged Items (Modern Table) */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-border bg-surface-hover/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500 ring-1 ring-amber-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-main tracking-tight">Security & Governance Queue</h3>
                <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-0.5">High-priority compliance items</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
               <span className="text-xs font-bold text-amber-500">
                {flaggedItems.filter((f) => f.status === "open").length} OPEN INCIDENTS
              </span>
              <button className="px-4 py-2 bg-main text-surface text-[10px] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 transition-all">Review Queue</button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface border-b border-border">
                {["Category", "Incident Narrative", "Criticality", "State", "Occurrence"].map((h) => (
                  <th key={h} className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {flaggedItems.filter((f) => f.status === "open").map((item) => (
                <tr
                  key={item.id}
                  className="group hover:bg-surface-hover/50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4.5">
                    <span className="text-[10px] font-black text-main uppercase bg-surface-hover px-2.5 py-1 rounded-md border border-border group-hover:border-primary/20">{item.type}</span>
                  </td>
                  <td className="px-6 py-4.5">
                    <p className="text-sm font-semibold text-main max-w-md truncate group-hover:text-primary transition-colors">{item.description}</p>
                  </td>
                  <td className="px-6 py-4.5"><StatusBadge status={item.severity} /></td>
                  <td className="px-6 py-4.5"><StatusBadge status={item.status} /></td>
                  <td className="px-6 py-4.5 text-[11px] font-bold text-muted tabular-nums">{item.flaggedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
