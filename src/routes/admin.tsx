import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SiteShell } from "@/components/layout/SiteShell";
import { useAuth } from "@/hooks/use-auth";
import {
  ShieldCheck, LayoutDashboard, Users, Package, ShoppingCart,
  MessageSquare, Flag, CreditCard, BarChart3, Settings,
  AlertTriangle, Wrench, ClipboardList, UserCheck,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const ADMIN_NAV = [
  { to: "/admin", label: "Overview", Icon: LayoutDashboard, exact: true },
  { to: "/admin/orders", label: "Orders", Icon: ShoppingCart },
  { to: "/admin/moderation", label: "Moderation", Icon: Flag },
  { to: "/admin/kyc", label: "KYC Review", Icon: UserCheck },
  { to: "/admin/payments", label: "Payments", Icon: CreditCard },
  { to: "/admin/analytics", label: "Analytics", Icon: BarChart3 },
  { to: "/admin/diagnostics", label: "Diagnostics", Icon: Wrench },
];

function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/" });
  }, [loading, user, isAdmin, navigate]);

  if (loading || !user || !isAdmin) {
    return (
      <SiteShell>
        <div className="px-6 py-32 text-center">
          <div className="inline-flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="size-4 text-crimson animate-pulse" />
            Verifying admin access…
          </div>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="px-6 pt-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="size-8 rounded-lg bg-crimson/10 border border-crimson/20 flex items-center justify-center">
            <ShieldCheck className="size-4 text-crimson" />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson">— Admin Console</p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">HUXZAIN Control Center</h1>
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="mt-6 flex gap-1 border-b border-border overflow-x-auto scrollbar-none">
          {ADMIN_NAV.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              activeOptions={{ exact: t.exact }}
              activeProps={{ className: "border-crimson text-foreground" }}
              className="flex items-center gap-1.5 px-4 py-3 text-xs font-mono uppercase tracking-widest border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              <t.Icon className="size-3" />
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="px-6 py-8 max-w-7xl mx-auto">
        <Outlet />
      </div>
    </SiteShell>
  );
}
