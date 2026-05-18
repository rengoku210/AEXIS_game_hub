import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SiteShell } from "@/components/layout/SiteShell";
import { useAuth } from "@/hooks/use-auth";
import {
  Crown, Star, Trophy, Rocket, LayoutDashboard,
  Package, ShoppingBag, UserCheck, CreditCard, BarChart3,
  MessageSquare, Settings,
} from "lucide-react";

export const Route = createFileRoute("/seller")({
  component: SellerLayout,
});

const PLAN_ICONS: Record<string, React.ElementType> = {
  free: Rocket, pro: Star, elite: Crown, exclusive: Trophy,
};
const PLAN_COLORS: Record<string, string> = {
  free: "text-muted-foreground",
  pro: "text-blue-400",
  elite: "text-crimson",
  exclusive: "text-[oklch(0.75_0.15_75)]",
};

const SELLER_NAV = [
  { to: "/seller", label: "Listings", Icon: Package, exact: true },
  { to: "/seller/orders", label: "Orders", Icon: ShoppingBag },
  { to: "/seller/kyc", label: "Verification", Icon: UserCheck },
  { to: "/seller/plans", label: "Subscription", Icon: CreditCard },
];

function SellerLayout() {
  const { user, isSeller, profile, loading } = useAuth();
  const navigate = useNavigate();

  const sellerPlan = profile?.seller_plan ?? "none";

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login", redirect: "/seller" } });
    else if (!loading && user && !isSeller) navigate({ to: "/sell" });
  }, [loading, user, isSeller, navigate]);

  if (loading || !user || !isSeller) {
    return (
      <SiteShell>
        <div className="px-6 py-32 text-center text-muted-foreground">
          <LayoutDashboard className="size-6 mx-auto mb-3 text-crimson animate-pulse" />
          Loading seller dashboard…
        </div>
      </SiteShell>
    );
  }

  // Seller exists but has no plan yet → redirect to plan selection
  if (sellerPlan === "none") {
    return (
      <SiteShell>
        <div className="px-6 py-32 max-w-xl mx-auto text-center">
          <div className="size-14 rounded-2xl bg-oxblood/20 border border-crimson/20 flex items-center justify-center mx-auto mb-6">
            <CreditCard className="size-6 text-crimson" />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mb-4">— No Active Plan</p>
          <h2 className="text-2xl font-bold mb-4">Choose a seller plan to continue</h2>
          <p className="text-muted-foreground mb-8">
            You need an active seller subscription to access your HUXZAIN seller dashboard and start listing.
          </p>
          <Link to="/sell" className="inline-flex items-center gap-2 bg-crimson px-6 py-3 rounded-xl font-semibold hover:bg-crimson-glow transition-colors shadow-[var(--shadow-glow-crimson)]">
            <CreditCard className="size-4" />
            View Plans
          </Link>
        </div>
      </SiteShell>
    );
  }

  const PlanIcon = PLAN_ICONS[sellerPlan] ?? Rocket;
  const planColor = PLAN_COLORS[sellerPlan] ?? "text-muted-foreground";

  return (
    <SiteShell>
      <div className="px-6 pt-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mb-2">— Vendor Console</p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Welcome, {profile?.display_name ?? profile?.username}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your HUXZAIN seller account, listings, and orders.
            </p>
          </div>
          <Link
            to="/seller/plans"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-elevated transition-colors text-xs font-mono uppercase tracking-wider shrink-0"
          >
            <PlanIcon className={`size-3.5 ${planColor}`} />
            <span className="capitalize">{sellerPlan} Plan</span>
          </Link>
        </div>

        {/* Nav tabs */}
        <nav className="flex gap-1 border-b border-border overflow-x-auto scrollbar-none">
          {SELLER_NAV.map((t) => (
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
