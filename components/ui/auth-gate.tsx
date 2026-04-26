import Link from "next/link";
import { LogIn, type LucideIcon } from "lucide-react";

type AuthGateProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
};

export function AuthGate({ icon: Icon, title, subtitle }: AuthGateProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-main">{title}</h1>
          {subtitle ? (
            <p className="text-sm font-medium italic text-muted">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center gap-4 text-center">
        <LogIn className="h-8 w-8 text-amber-400" />
        <p className="text-sm font-semibold text-amber-400">Admin API token is unavailable.</p>
        <p className="text-sm text-muted">Sign in with the admin email/password flow to continue.</p>
        <Link
          href="/login"
          className="mt-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
}
