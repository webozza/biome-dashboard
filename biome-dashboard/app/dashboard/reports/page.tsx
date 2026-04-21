"use client";

import { BarChart3, Download, FileSpreadsheet } from "lucide-react";

const reportTypes = [
  {
    title: "Verification Requests",
    description: "Export all verification requests with status, dates, and admin notes",
    count: 7,
    icon: "shield",
  },
  {
    title: "BMID Content Logs",
    description: "Export content request history including approvals and rejections",
    count: 6,
    icon: "file",
  },
  {
    title: "BMID Box Logs",
    description: "Export box request history with platform details and external links",
    count: 7,
    icon: "box",
  },
  {
    title: "Voting Reports",
    description: "Export voting data including vote counts, outcomes, and timelines",
    count: 6,
    icon: "vote",
  },
  {
    title: "Audit Trail",
    description: "Full audit log export with all actions, users, and timestamps",
    count: 8,
    icon: "scroll",
  },
  {
    title: "User Report",
    description: "Export user data including verification status and activity summary",
    count: 12,
    icon: "users",
  },
];

export default function ReportsPage() {
  const handleExport = (type: string, format: "csv" | "excel") => {
    alert(`Exporting ${type} as ${format.toUpperCase()}...`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary font-bold shadow-sm">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-main">Ledger Exports</h1>
            <p className="text-sm text-muted font-medium italic">Generate and download comprehensive ecosystem reports</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportTypes.map((report) => (
          <div
            key={report.title}
            className="card p-6 group hover:translate-y-[-4px] transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="max-w-[70%]">
                <h3 className="font-extrabold text-main group-hover:text-primary transition-colors">{report.title}</h3>
                <p className="text-[11px] text-muted font-medium mt-1.5 leading-relaxed italic opacity-80">{report.description}</p>
              </div>
              <div className="text-[10px] font-black px-2.5 py-1 rounded-full bg-surface-hover text-muted border border-border group-hover:border-primary/20 transition-colors uppercase tracking-widest">
                {report.count} records
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleExport(report.title, "csv")}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface border border-border rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-surface-hover hover:text-main text-muted transition-all active:scale-95 shadow-sm"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={() => handleExport(report.title, "excel")}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-emerald-500/10"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Sheet
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="card bg-surface p-8 border-dashed border-2 flex flex-col items-center justify-center text-center opacity-70">
        <div className="w-16 h-16 rounded-full bg-muted/10 flex items-center justify-center mb-4">
          <Download className="w-8 h-8 text-muted" />
        </div>
        <h3 className="text-lg font-bold text-main">Custom Data Slice</h3>
        <p className="text-sm text-muted max-w-sm mt-2">Need a specific data extract? Contact system administrators for a custom SQL dump of the required parameters.</p>
        <button className="mt-6 px-6 py-2.5 border border-border text-[10px] font-black uppercase tracking-[0.2em] rounded-lg hover:bg-surface-hover transition-colors">Request Custom Export</button>
      </div>
    </div>
  );
}
