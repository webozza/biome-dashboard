"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRightLeft, GitBranch, ListChecks, LogOut, Vote } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";

const navItems = [
  { href: "/bmid", label: "Overview" },
  { href: "/bmid/transfer", label: "Transfer", icon: ArrowRightLeft },
  { href: "/bmid/requests", label: "Requests", icon: ListChecks },
  { href: "/bmid/respond", label: "Respond", icon: GitBranch },
  { href: "/bmid/voting", label: "Voting", icon: Vote },
];

export default function BmidLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { initialized, isAuthenticated, user, logout } = useAuthStore();

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      router.replace("/bmid/login");
    }
  }, [initialized, isAuthenticated, router]);

  if (!initialized || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-main">
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-primary">BMID</p>
            <h1 className="text-lg font-extrabold tracking-tight">User Flow</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold">{user?.name}</p>
              <p className="text-xs text-muted">{user?.email}</p>
            </div>
            <button
              onClick={() => void logout().then(() => router.replace("/bmid/login"))}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-muted hover:bg-white/10 hover:text-main"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-8">
        <aside className="w-60 shrink-0 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = item.href === "/bmid" ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-muted hover:bg-white/[0.04] hover:text-main"
                  }`}
                >
                  {Icon ? <Icon className="w-4 h-4" /> : null}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
