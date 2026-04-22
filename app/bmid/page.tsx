"use client";

import Link from "next/link";
import { ArrowRightLeft, GitBranch, ListChecks, Vote } from "lucide-react";

const cards = [
  {
    href: "/bmid/transfer",
    title: "Transfer Post",
    description: "Move a normal in-app post into BMID Content as Own or Duality.",
    icon: ArrowRightLeft,
  },
  {
    href: "/bmid/requests",
    title: "My Requests",
    description: "Track created requests and the current BMID review/voting state.",
    icon: ListChecks,
  },
  {
    href: "/bmid/respond",
    title: "Respond To Duality",
    description: "Accept or decline requests where you are the tagged user.",
    icon: GitBranch,
  },
  {
    href: "/bmid/voting",
    title: "Vote",
    description: "Cast Accept, Ignore, or Refuse on open BMID voting sessions.",
    icon: Vote,
  },
];

export default function BmidHomePage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">BMID User Flow</h1>
        <p className="mt-2 text-sm text-muted">Real user-side BMID actions: transfer, respond, track, and vote.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-white/20 hover:bg-white/[0.04] transition-colors">
              <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3 text-primary">
                <Icon className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold">{card.title}</h2>
              <p className="mt-2 text-sm text-muted">{card.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
