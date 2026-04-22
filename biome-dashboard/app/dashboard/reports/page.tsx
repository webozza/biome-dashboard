"use client";

import { BarChart3, Clock } from "lucide-react";

const reportTypes = [
  {
    title: "Verification Requests",
    description: "Export all verification requests with status, dates, and admin notes",
  },
  {
    title: "BMID Content Logs",
    description: "Export content request history including approvals and rejections",
  },
  {
    title: "BMID Box Logs",
    description: "Export box request history with platform details and external links",
  },
  {
    title: "Voting Reports",
    description: "Export voting data including vote counts, outcomes, and timelines",
  },
  {
    title: "Audit Trail",
    description: "Full audit log export with all actions, users, and timestamps",
  },
  {
    title: "User Report",
    description: "Export user data including verification status and activity summary",
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <BarChart3 className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-main">Reports &amp; Exports</h1>
          <p className="text-sm font-medium italic text-muted">
            Generate and download comprehensive platform reports
          </p>
        </div>
      </div>

      <div className="card flex flex-col items-center justify-center text-center gap-4 p-10 border-dashed border-2">
        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Clock className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold tracking-tight text-main">Coming soon</h2>
          <p className="text-sm text-muted max-w-md">
            Export features (CSV, Excel, custom data slices) are on the roadmap. For now, audit data can be
            downloaded from the Audit Ledger page.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportTypes.map((report) => (
          <div
            key={report.title}
            className="card p-6 relative opacity-70"
          >
            <div className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
              Soon
            </div>
            <div className="pr-16">
              <h3 className="font-extrabold text-main">{report.title}</h3>
              <p className="text-[11px] text-muted font-medium mt-1.5 leading-relaxed italic opacity-80">
                {report.description}
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                disabled
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface border border-border rounded-xl text-[10px] font-black uppercase tracking-widest text-muted cursor-not-allowed"
              >
                <Clock className="w-3.5 h-3.5" />
                Coming Soon
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
