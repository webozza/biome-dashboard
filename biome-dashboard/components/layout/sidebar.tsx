"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShieldCheck,
  FileText,
  Box,
  GitBranch,
  Vote,
  AlertTriangle,
  Users,
  ScrollText,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  Hexagon,
} from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

const navSections = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Requests",
    items: [
      { href: "/dashboard/verification", label: "Verification", icon: ShieldCheck },
      { href: "/dashboard/content", label: "BMID Content", icon: FileText },
      { href: "/dashboard/bmid-box", label: "BMID Box", icon: Box },
      { href: "/dashboard/duality", label: "Duality", icon: GitBranch },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { href: "/dashboard/voting", label: "Voting", icon: Vote },
      { href: "/dashboard/bmid/respond", label: "Tagged Response", icon: GitBranch },
      { href: "/dashboard/moderation", label: "Moderation", icon: AlertTriangle },
      { href: "/dashboard/users", label: "Users", icon: Users },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/dashboard/audit", label: "Audit Logs", icon: ScrollText },
      { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const { sidebarOpen, toggleSidebar } = useDashboardStore();

  return (
    <aside
      className={`sidebar flex flex-col transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${!sidebarOpen ? "w-[80px]" : "w-[260px]"} border-r border-border relative z-40`}
      style={{ backgroundColor: "var(--sidebar-bg)" }}
    >
      {/* Branding Node */}
      <div className="h-[80px] flex items-center px-6 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 blur-xl opacity-20" />
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-emerald-700 to-emerald-900 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10 ring-1 ring-white/10 z-10 transition-transform hover:scale-105 active:scale-95 cursor-pointer">
          <Hexagon className="w-5.5 h-5.5 text-white" strokeWidth={2.5} />
        </div>

        {sidebarOpen && (
          <div className="ml-4 flex flex-col animate-fade-in z-10">
            <span className="font-black text-lg tracking-tighter text-main uppercase italic">
              BIOME<span className="text-primary tracking-[0.2em] ml-1">ADMIN</span>
            </span>
            <span className="text-[8px] font-black tracking-[0.4em] uppercase text-muted leading-none -mt-0.5 opacity-50">Core Terminal</span>
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className={`ml-auto p-2 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-all group z-10 ${sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <ChevronLeft className={`w-3.5 h-3.5 text-muted group-hover:text-primary transition-transform ${sidebarOpen ? "" : "rotate-180"}`} />
        </button>
      </div>

      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="absolute right-[-14px] top-[100px] w-7 h-7 bg-primary rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 hover:scale-110 active:scale-95 transition-all z-50 border-2"
          style={{ borderColor: "var(--sidebar-bg)" }}
        >
          <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
        </button>
      )}

      {/* Primary Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-6 custom-scrollbar space-y-8">
        {navSections.map((section) => (
          <div key={section.label} className="space-y-2">
            {sidebarOpen ? (
              <p className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.4em] text-muted opacity-40">
                {section.label}
              </p>
            ) : (
              <div className="w-full flex justify-center py-2 opacity-20">
                <div className="w-4 h-[1px] bg-white rounded-full" />
              </div>
            )}
            
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-link h-[48px] px-3 rounded-xl flex items-center relative transition-all duration-300 group
                      ${isActive
                        ? "bg-primary/10 text-primary font-black shadow-[inset_0_0_15px_rgba(16,185,129,0.05)]"
                        : "text-muted hover:text-main hover:bg-surface-hover"
                      }
                    `}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-2 bottom-2 w-1.5 bg-primary rounded-full shadow-[0_0_10px_var(--primary)]" />
                    )}
                    
                    <div className="w-8 flex justify-center items-center shrink-0">
                      <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? "drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" : ""}`} />
                    </div>
                    
                    {sidebarOpen && (
                      <span className="ml-3 text-[11px] font-black uppercase tracking-widest">{item.label}</span>
                    )}

                    {!sidebarOpen && (
                      <div className="fixed left-[75px] px-3 py-2 rounded-lg bg-surface border border-border shadow-2xl opacity-0 translate-x-3 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all z-[100] whitespace-nowrap">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">{item.label}</span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Terminal Node / Identity */}
      <div className="p-4 border-t border-border" style={{ backgroundColor: "var(--sidebar-footer-bg)" }}>
        <div className={`flex items-center gap-3 p-3 rounded-2xl border border-border bg-surface group transition-all ${sidebarOpen ? "hover:border-border" : "flex-col p-2"}`}>
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-surface to-background flex items-center justify-center text-primary font-black text-xs border border-border group-hover:border-primary/50 transition-colors shadow-inner ring-1 ring-white/5 overflow-hidden uppercase">
              {user?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0) || "R"
              )}
            </div>
            <div
              className="absolute bottom-[-1px] right-[-1px] w-3 h-3 bg-primary rounded-full border-2 shadow-[0_0_8px_var(--primary)]"
              style={{ borderColor: "var(--sidebar-bg)" }}
            />
          </div>

          {sidebarOpen ? (
            <div className="flex-1 min-w-0 animate-fade-in">
              <p className="text-[10px] font-black uppercase text-main tracking-tight truncate leading-none mb-1">{user?.name || "Admin Authority"}</p>
              <p className="text-[9px] font-bold text-muted truncate italic opacity-70">{user?.email || "root@biome.io"}</p>
            </div>
          ) : null}

          {sidebarOpen && (
             <button 
               onClick={() => logout()}
               className="p-2 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-all active:scale-95 group/logout"
               title="Sign Out"
             >
               <LogOut className="w-3.5 h-3.5 group-hover/logout:translate-x-0.5 transition-transform" />
             </button>
          )}

          {!sidebarOpen && (
            <button 
              onClick={() => logout()}
              className="mt-2 p-2 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
