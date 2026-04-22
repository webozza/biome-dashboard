"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, User, LogOut, Settings, Shield, ChevronDown, UserCircle, Sun, Moon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useThemeStore } from "@/lib/stores/theme-store";
import { recentActivities } from "@/lib/data/mock-data";

const notifications = recentActivities.slice(0, 5).map((a) => ({
  id: a.id,
  message: a.description,
  time: new Date(a.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
  type: a.type,
  read: false,
}));

const typeColor: Record<string, string> = {
  verification: "bg-blue-500",
  approval: "bg-emerald-500",
  refusal: "bg-red-500",
  duality: "bg-orange-500",
  removal: "bg-gray-500",
  flag: "bg-amber-500",
};

export function Header() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [readNotifs, setReadNotifs] = useState<string[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !readNotifs.includes(n.id)).length;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="topbar px-8 py-4 flex items-center justify-end">
      <div className="flex items-center gap-5">
        {/* Global Utilities */}
        <div className="flex items-center bg-surface p-1 rounded-xl border border-border shadow-sm">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="p-2 rounded-lg hover:bg-surface-hover transition-all text-muted hover:text-primary"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {/* Notifications Trigger */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}
              className="p-2 rounded-lg hover:bg-surface-hover transition-all text-muted hover:text-primary relative"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_var(--primary)] animate-pulse" />
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 top-full mt-3 w-80 bg-surface/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in divide-y divide-border/50">
                <div className="px-5 py-4 flex items-center justify-between bg-primary/5">
                  <h3 className="text-xs font-black uppercase tracking-widest text-main">Central Alerts</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => setReadNotifs(notifications.map((n) => n.id))}
                      className="text-[10px] text-primary font-black uppercase tracking-widest hover:underline"
                    >
                      Clear Sink
                    </button>
                  )}
                </div>
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  {notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div key={notif.id} className="px-5 py-4 hover:bg-surface-hover transition-colors group cursor-pointer relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
                        <div className="flex gap-3">
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${typeColor[notif.type] || "bg-muted"}`} />
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-main leading-relaxed group-hover:text-primary transition-colors">{notif.message}</p>
                            <p className="text-[10px] text-muted font-bold tracking-tight opacity-60">{notif.time}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-5 py-12 text-center">
                      <Shield className="w-10 h-10 text-muted mx-auto mb-3 opacity-20" />
                      <p className="text-xs font-bold text-muted uppercase tracking-widest italic">All systems clear</p>
                    </div>
                  )}
                </div>
                <div className="px-5 py-3 text-center bg-surface-hover">
                  <button className="text-[10px] font-black uppercase tracking-widest text-muted hover:text-main">View Archive</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Identity Node */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}
            className="flex items-center gap-3 p-1.5 pr-3 rounded-xl hover:bg-surface-hover transition-all border border-transparent hover:border-border group"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-primary blur-md opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary via-emerald-700 to-emerald-900 flex items-center justify-center text-white shadow-lg overflow-hidden relative ring-1 ring-white/10">
                {user?.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-black uppercase">
                    {user?.name?.charAt(0) || <User className="w-5 h-5 shadow-sm" />}
                  </span>
                )}
              </div>
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-black text-main uppercase tracking-tight leading-none">{user?.name || "Admin"}</p>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform duration-300 ${showProfile ? 'rotate-180' : ''}`} />
          </button>
          
          {showProfile && (
            <div className="absolute right-0 top-full mt-3 w-64 bg-surface/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl z-50 py-2 animate-fade-in divide-y divide-border/30">
              <div className="px-5 py-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-surface-hover border border-border flex items-center justify-center overflow-hidden">
                    {user?.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-black text-main uppercase truncate">{user?.name || "Administrator"}</p>
                    <p className="text-[10px] text-muted font-bold truncate opacity-60 italic">{user?.email || "root@biome.io"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="px-2 py-1.5 bg-background rounded-lg border border-border text-center">
                    <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-0.5">Access</p>
                    <p className="text-[10px] font-black text-primary uppercase">Full</p>
                  </div>
                  <div className="px-2 py-1.5 bg-background rounded-lg border border-border text-center">
                    <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-0.5">Uptime</p>
                    <p className="text-[10px] font-black text-emerald-500 uppercase">99.9%</p>
                  </div>
                </div>
              </div>
              <div className="py-2">
                <ProfileMenuItem
                  icon={UserCircle}
                  label="Profile"
                  onClick={() => { setShowProfile(false); router.push("/dashboard/profile"); }}
                />
                <ProfileMenuItem
                  icon={Shield}
                  label="Authentication Key"
                  onClick={() => setShowProfile(false)}
                />
                <ProfileMenuItem 
                  icon={Settings} 
                  label="Node Parameters" 
                  onClick={() => { setShowProfile(false); router.push("/dashboard/settings"); }} 
                />
              </div>
              <div className="py-2">
                <ProfileMenuItem 
                  icon={LogOut} 
                  label="Terminate Session" 
                  danger 
                  onClick={async () => { await logout(); router.push("/login"); }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function ProfileMenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:pl-6 ${
        danger ? "text-red-500 hover:bg-red-500/10" : "text-muted hover:text-main hover:bg-surface-hover"
      }`}
    >
      <Icon className={`w-4 h-4 ${danger ? 'text-red-500' : 'text-primary'}`} />
      {label}
    </button>
  );
}
