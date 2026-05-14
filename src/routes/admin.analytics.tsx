import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Users, CreditCard } from "lucide-react";

export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsDashboard,
});

function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production, this would fetch from a Supabase Edge Function or an analytics provider
    setTimeout(() => setLoading(false), 800);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-surface rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-surface rounded-xl" />)}
        </div>
        <div className="h-64 bg-surface rounded-xl mt-6" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Analytics</h1>
        <p className="text-muted-foreground">Marketplace performance and conversion tracking.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-2 text-muted-foreground">
            <BarChart3 className="size-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Total Views</h3>
          </div>
          <p className="text-3xl font-bold">14,208</p>
          <p className="text-xs text-green-500 mt-2 font-mono">+12.4% vs last week</p>
        </div>
        <div className="glass rounded-xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-2 text-muted-foreground">
            <TrendingUp className="size-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Conversion Rate</h3>
          </div>
          <p className="text-3xl font-bold">4.2%</p>
          <p className="text-xs text-green-500 mt-2 font-mono">+0.8% vs last week</p>
        </div>
        <div className="glass rounded-xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-2 text-muted-foreground">
            <CreditCard className="size-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Payment Success</h3>
          </div>
          <p className="text-3xl font-bold">98.5%</p>
          <p className="text-xs text-muted-foreground mt-2 font-mono">Gateway: Razorpay</p>
        </div>
        <div className="glass rounded-xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-2 text-muted-foreground">
            <Users className="size-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Active Sellers</h3>
          </div>
          <p className="text-3xl font-bold">142</p>
          <p className="text-xs text-green-500 mt-2 font-mono">+3 new this week</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category Popularity Mock */}
        <div className="glass-strong rounded-xl p-6 border border-border">
          <h3 className="font-semibold mb-4">Category Popularity (Views)</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Game Accounts</span>
                <span>8,400</span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div className="h-full bg-crimson w-[60%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Rank Boosting</span>
                <span>3,200</span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div className="h-full bg-crimson/80 w-[25%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Coaching</span>
                <span>1,500</span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div className="h-full bg-crimson/60 w-[10%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>In-Game Credits</span>
                <span>1,108</span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div className="h-full bg-crimson/40 w-[5%]" />
              </div>
            </div>
          </div>
        </div>

        {/* Top Sellers Mock */}
        <div className="glass-strong rounded-xl p-6 border border-border">
          <h3 className="font-semibold mb-4">Top Performing Sellers</h3>
          <div className="space-y-3">
            {[
              { name: "EliteCarry", sales: 142, rating: 4.9 },
              { name: "VaultHunter", sales: 89, rating: 5.0 },
              { name: "ProCoachingGG", sales: 56, rating: 4.8 }
            ].map((seller, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-oxblood flex items-center justify-center text-xs font-bold">{seller.name[0]}</div>
                  <div>
                    <p className="text-sm font-medium">{seller.name}</p>
                    <p className="text-xs text-muted-foreground">{seller.sales} successful sales</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-500">★ {seller.rating}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
