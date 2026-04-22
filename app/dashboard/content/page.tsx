"use client";

import { useState } from "react";
import { FileText, ScrollText, Vote } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { AuthGate } from "@/components/ui/auth-gate";
import { RequestsTab } from "./_components/requests-tab";
import { VotingTab } from "./_components/voting-tab";
import { AuditTab } from "./_components/audit-tab";

type TabKey = "requests" | "voting" | "audit";

const tabs: { key: TabKey; label: string; icon: typeof FileText }[] = [
  { key: "requests", label: "Requests", icon: FileText },
  { key: "voting", label: "Voting", icon: Vote },
  { key: "audit", label: "Audit", icon: ScrollText },
];

export default function ContentPage() {
  const apiToken = useAuthStore((s) => s.apiToken);
  const [active, setActive] = useState<TabKey>("requests");

  if (!apiToken) {
    return <AuthGate icon={FileText} title="BMID Content" subtitle="Sign in to manage content requests" />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <FileText className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-main">BMID Content</h1>
          <p className="text-sm font-medium italic text-muted">
            Monitor post transfers, Own &amp; Duality requests, voting, and audit trail.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em] transition ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-main"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {active === "requests" ? <RequestsTab /> : null}
      {active === "voting" ? <VotingTab /> : null}
      {active === "audit" ? <AuditTab /> : null}
    </div>
  );
}
