import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Crown, Star, Rocket, Trophy, Check, ArrowRight, RefreshCw, Calendar, Zap } from "lucide-react";

export const Route = createFileRoute("/seller/plans")({
  component: SellerPlansPage,
});

interface Sub {
  id: string;
  plan_type: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  amount_inr: number;
  created_at: string;
}

const PLAN_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  free:      { label: "Starter",   Icon: Rocket, color: "text-muted-foreground" },
  pro:       { label: "Pro",       Icon: Star,   color: "text-crimson" },
  elite:     { label: "Elite",     Icon: Crown,  color: "text-crimson" },
  exclusive: { label: "Exclusive", Icon: Trophy, color: "text-[oklch(0.75_0.15_75)]" },
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function SellerPlansPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);

  const sellerPlan = profile?.seller_plan ?? "none";
  const subStatus  = profile?.seller_subscription_status ?? "inactive";

  useEffect(() => {
    if (!user) return;
    void (supabase as any)
      .from("seller_subscriptions")
      .select("id,plan_type,status,starts_at,expires_at,amount_inr,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }: { data: unknown[] | null }) => { setSubs((data ?? []) as unknown as Sub[]); setLoading(false); });
  }, [user]);

  const activeSub = subs.find((s) => s.status === "active");
  const planMeta  = PLAN_META[sellerPlan] ?? PLAN_META.free;
  const { Icon: PlanIcon } = planMeta;

  return (
    <div className="space-y-8">
      {/* Current plan banner */}
      <div className={`rounded-2xl p-6 border ${
        sellerPlan === "exclusive"
          ? "border-[oklch(0.75_0.15_75)/0.4] bg-gradient-to-r from-[oklch(0.12_0.025_60)] to-[oklch(0.08_0.005_25)]"
          : sellerPlan === "elite" || sellerPlan === "pro"
          ? "border-crimson/40 bg-gradient-to-r from-[oklch(0.12_0.02_25)] to-[oklch(0.08_0.005_25)]"
          : "border-border bg-surface"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`size-12 rounded-xl flex items-center justify-center ${
              sellerPlan === "exclusive" ? "bg-[oklch(0.75_0.15_75)/0.15]"
              : sellerPlan !== "free" && sellerPlan !== "none" ? "bg-crimson/15"
              : "bg-surface-elevated"
            }`}>
              <PlanIcon className={`size-6 ${planMeta.color}`} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Current Plan</p>
              <h2 className="text-xl font-bold capitalize">{planMeta.label}</h2>
              {activeSub?.expires_at && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="size-3" /> Renews {fmt(activeSub.expires_at)}
                </p>
              )}
              {!activeSub?.expires_at && sellerPlan === "free" && (
                <p className="text-xs text-muted-foreground mt-0.5">No expiry</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full border text-[10px] font-mono uppercase tracking-widest ${
              subStatus === "active" ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-muted border-border text-muted-foreground"
            }`}>
              {subStatus}
            </span>
            <Link
              to="/sell"
              className="flex items-center gap-1.5 text-xs font-semibold bg-crimson px-4 py-2 rounded-lg hover:bg-crimson-glow transition-colors"
            >
              <Zap className="size-3" /> Upgrade Plan
            </Link>
          </div>
        </div>
      </div>

      {/* Plan limits quick ref */}
      <div className="glass rounded-2xl p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Check className="size-4 text-crimson" /> Your Plan Includes
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {getPlanFeatures(sellerPlan).map((f) => (
            <div key={f} className="flex items-start gap-2 text-muted-foreground">
              <Check className="size-3.5 text-crimson shrink-0 mt-0.5" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Subscription history */}
      <div>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <RefreshCw className="size-4 text-crimson" /> Subscription History
        </h3>
        {loading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-surface animate-pulse" />)}</div>
        ) : subs.length === 0 ? (
          <div className="glass rounded-xl py-10 text-center text-muted-foreground">No subscriptions yet.</div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-elevated border-b border-border">
                <tr className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="text-left px-5 py-3">Plan</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-right px-5 py-3">Amount</th>
                  <th className="text-right px-5 py-3 hidden md:table-cell">Started</th>
                  <th className="text-right px-5 py-3 hidden md:table-cell">Expires</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => {
                  const m = PLAN_META[s.plan_type] ?? PLAN_META.free;
                  const { Icon } = m;
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Icon className={`size-4 ${m.color}`} />
                          <span className="font-semibold capitalize">{m.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-widest ${
                          s.status === "active" ? "bg-green-500/10 border-green-500/30 text-green-400"
                          : s.status === "cancelled" ? "bg-muted border-border text-muted-foreground"
                          : "bg-orange-500/10 border-orange-500/30 text-orange-400"
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold">
                        {s.amount_inr === 0 ? "Free" : `₹${s.amount_inr.toLocaleString("en-IN")}`}
                      </td>
                      <td className="px-5 py-3 text-right hidden md:table-cell text-muted-foreground text-xs">
                        {fmt(s.starts_at)}
                      </td>
                      <td className="px-5 py-3 text-right hidden md:table-cell text-muted-foreground text-xs">
                        {s.expires_at ? fmt(s.expires_at) : "∞"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function getPlanFeatures(plan: string): string[] {
  switch (plan) {
    case "pro": return [
      "Up to 20 active listings", "Faster listing approval", "Seller analytics dashboard",
      "Priority support", "Better marketplace visibility", "Custom seller banner", "Sales statistics",
    ];
    case "elite": return [
      "Unlimited listings", "Featured marketplace visibility", "Verified seller badge",
      "Advanced analytics", "Instant listing approval", "Priority Discord support",
      "Premium storefront customization", "Better search ranking",
    ];
    case "exclusive": return [
      "Everything in Elite", "Homepage featured rotation", "Dedicated seller support",
      "Marketplace promotion boosts", "Exclusive seller badge", "Custom storefront URL",
      "Early access features", "Highest search priority", "VIP marketplace status",
    ];
    default: return [
      "1 active listing max", "Basic seller profile", "Standard support", "Slower listing approval",
    ];
  }
}
