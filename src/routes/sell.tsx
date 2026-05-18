import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  ShieldCheck, TrendingUp, Zap, Crown, Star, Rocket,
  Check, ArrowRight, Sparkles, Trophy, BadgeCheck,
} from "lucide-react";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Become a Seller — HUXZAIN Digital Marketplace" },
      { name: "description", content: "Join HUXZAIN as a verified seller. Choose your plan — Free, Pro, Elite, or Exclusive — and start selling digital goods and services." },
    ],
  }),
  component: SellPage,
});

type Step = "hero" | "terms" | "plans" | "success";

interface PlanDef {
  id: "free" | "pro" | "elite" | "exclusive";
  name: string;
  badge: string;
  price: number;
  period: string;
  tagline: string;
  listings: string;
  features: string[];
  cta: string;
  Icon: React.ElementType;
  tier: "starter" | "popular" | "elite" | "exclusive";
}

const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Starter",
    badge: "Free",
    price: 0,
    period: "forever",
    tagline: "Try the platform with zero commitment.",
    listings: "3 listings",
    features: [
      "3 active listings max",
      "Basic seller profile",
      "Standard support",
      "Slower listing approval",
    ],
    cta: "Continue Free",
    Icon: Rocket,
    tier: "starter",
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Most Popular",
    price: 699,
    period: "/month",
    tagline: "Scale your sales with analytics and visibility.",
    listings: "Up to 15 listings",
    features: [
      "Up to 15 active listings",
      "Faster listing approval",
      "Seller analytics dashboard",
      "Priority support",
      "Better marketplace visibility",
      "Custom seller banner",
      "Sales & performance stats",
    ],
    cta: "Upgrade to Pro",
    Icon: Star,
    tier: "popular",
  },
  {
    id: "elite",
    name: "Elite",
    badge: "Elite",
    price: 1499,
    period: "/month",
    tagline: "Unlimited power with verified seller badge.",
    listings: "Unlimited listings",
    features: [
      "Unlimited listings",
      "Featured marketplace visibility",
      "Verified seller badge ✓",
      "Advanced analytics",
      "Instant listing approval",
      "Priority Discord support",
      "Premium storefront customization",
      "Better search ranking",
      "Seller reputation tools",
    ],
    cta: "Go Elite",
    Icon: Crown,
    tier: "elite",
  },
  {
    id: "exclusive",
    name: "Exclusive",
    badge: "VIP",
    price: 3499,
    period: "/month",
    tagline: "The apex tier. Homepage featured. Maximum reach.",
    listings: "Unlimited + featured boosts",
    features: [
      "Everything in Elite",
      "Homepage featured seller rotation",
      "Dedicated seller support",
      "Marketplace promotion boosts",
      "Exclusive seller badge ⚡",
      "Custom storefront URL",
      "Early access features",
      "Highest search priority",
      "VIP marketplace status",
    ],
    cta: "Become Exclusive",
    Icon: Trophy,
    tier: "exclusive",
  },
];

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function SellPage() {
  const { user, profile, isSeller, session, refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("hero");
  const [agreed, setAgreed] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [activatedPlan, setActivatedPlan] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const sellerPlan = profile?.seller_plan ?? "none";
  const isActiveSeller = isSeller && sellerPlan !== "none";

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [step]);

  async function handleSelectPlan(plan: PlanDef) {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signup", redirect: "/sell" } });
      return;
    }
    setProcessing(plan.id);

    const token = session?.access_token;
    if (!token) { setProcessing(null); return; }

    try {
      // Free plan – direct activate
      if (plan.id === "free") {
        const res = await fetch("/api/seller-sub/create", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ plan_type: "free" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to activate");
        await refresh();
        setActivatedPlan("free");
        setStep("success");
        setProcessing(null);
        return;
      }

      // Paid plan – create Razorpay order
      const loaded = await loadRazorpay();
      if (!loaded) { toast.error("Payment gateway failed to load. Try again."); setProcessing(null); return; }

      const res = await fetch("/api/seller-sub/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan_type: plan.id }),
      });
      const orderData = await res.json();
      if (!res.ok) throw new Error(orderData.error ?? "Failed to create order");

      const rzp = new window.Razorpay({
        key: orderData.razorpayKeyId,
        amount: orderData.amountInPaise,
        currency: orderData.currency,
        name: "HUXZAIN Marketplace",
        description: orderData.planName,
        order_id: orderData.razorpayOrderId,
        prefill: { name: orderData.buyerName ?? "", email: orderData.buyerEmail ?? "" },
        theme: { color: "#dc2626" },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const verRes = await fetch("/api/seller-sub/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan_type: plan.id,
              amount_inr: plan.price,
            }),
          });
          const verJson = await verRes.json();
          if (!verRes.ok) { toast.error(verJson.error ?? "Verification failed"); setProcessing(null); return; }
          await refresh();
          setActivatedPlan(plan.id);
          setStep("success");
          setProcessing(null);
        },
        modal: { ondismiss: () => setProcessing(null) },
      } as unknown as Record<string, unknown>);
      rzp.open();
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
      setProcessing(null);
    }
  }

  // ── Already a seller ────────────────────────────────────────────────
  if (isActiveSeller) {
    return (
      <SiteShell>
        <section className="px-6 py-32 max-w-2xl mx-auto text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mb-4">— Active Vendor</p>
          <h1 className="text-4xl font-bold mb-4">You're a verified seller</h1>
          <p className="text-muted-foreground mb-8">
            Your <span className="text-foreground capitalize font-semibold">{sellerPlan}</span> plan is active.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/seller" className="inline-block bg-crimson px-6 py-3 rounded-lg font-semibold hover:bg-crimson-glow transition-colors">
              Go to Seller Dashboard
            </Link>
            <Link to="/seller/plans" className="inline-block border border-border px-6 py-3 rounded-lg font-semibold hover:bg-surface-elevated transition-colors">
              Manage Plan
            </Link>
          </div>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div ref={topRef} />

      {/* ── HERO STEP ── */}
      {step === "hero" && <HeroStep onStart={() => setStep("terms")} />}

      {/* ── TERMS STEP ── */}
      {step === "terms" && (
        <TermsStep
          agreed={agreed}
          onAgree={setAgreed}
          onBack={() => setStep("hero")}
          onNext={() => {
            if (!agreed) { toast.error("Please accept the seller agreement"); return; }
            if (!user) { navigate({ to: "/auth", search: { mode: "signup", redirect: "/sell" } }); return; }
            setStep("plans");
          }}
        />
      )}

      {/* ── PLANS STEP ── */}
      {step === "plans" && (
        <PlansStep processing={processing} onSelect={handleSelectPlan} onBack={() => setStep("terms")} />
      )}

      {/* ── SUCCESS STEP ── */}
      {step === "success" && (
        <SuccessStep plan={activatedPlan ?? "free"} onDashboard={() => navigate({ to: "/seller" })} />
      )}
    </SiteShell>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Hero Step                                                       */
/* ─────────────────────────────────────────────────────────────── */
function HeroStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 ambient-spotlight pointer-events-none" />
      <div className="absolute inset-0 grid-noise pointer-events-none opacity-40" />

      <section className="relative px-6 pt-20 pb-12 max-w-5xl mx-auto text-center">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mb-6">
          <span className="w-8 h-px bg-crimson" /> HUXZAIN Vendor Program <span className="w-8 h-px bg-crimson" />
        </span>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-balance leading-[1.05]">
          Monetize your<br />
          <span className="text-crimson">expertise.</span>
        </h1>
        <p className="mt-6 text-muted-foreground max-w-2xl mx-auto font-light text-lg leading-relaxed">
          Join a verified network of digital sellers. Set your own prices. Keep up to <strong className="text-foreground">90%</strong> of every sale.
        </p>
        <button
          onClick={onStart}
          className="mt-10 inline-flex items-center gap-2 bg-crimson px-8 py-4 rounded-xl font-semibold text-sm uppercase tracking-wider hover:bg-crimson-glow hover:shadow-[var(--shadow-glow-crimson)] transition-all duration-300 group"
        >
          Become a Seller
          <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </section>

      <section className="relative px-6 pb-20 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden">
          {[
            { Icon: TrendingUp, label: "Reach", value: "Premium" },
            { Icon: ShieldCheck, label: "Escrow", value: "Built-in" },
            { Icon: Zap, label: "Payouts", value: "Fast" },
            { Icon: BadgeCheck, label: "Verified", value: "Sellers" },
          ].map(({ Icon, label, value }) => (
            <div key={label} className="bg-surface p-6 text-center">
              <Icon className="size-5 text-crimson mx-auto mb-3" />
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
              <p className="text-lg font-bold mt-1">{value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Terms Step                                                      */
/* ─────────────────────────────────────────────────────────────── */
function TermsStep({ agreed, onAgree, onBack, onNext }: {
  agreed: boolean; onAgree: (v: boolean) => void; onBack: () => void; onNext: () => void;
}) {
  return (
    <section className="px-6 py-16 max-w-3xl mx-auto">
      <button onClick={onBack} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground mb-8 flex items-center gap-2 transition-colors">
        ← Back
      </button>
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mb-3">— Step 1 of 2</p>
      <h1 className="text-3xl font-bold mb-2">Seller Agreement</h1>
      <p className="text-muted-foreground mb-8">Read and accept the terms before choosing your plan.</p>

      <div className="glass-strong rounded-2xl p-8">
        <div className="text-sm text-muted-foreground font-light leading-relaxed space-y-4 max-h-80 overflow-y-auto pr-2 border border-border rounded-xl p-5 bg-surface">
          <p className="text-foreground font-medium">By becoming a HUXZAIN vendor you agree to:</p>
          <ul className="space-y-2.5 list-none">
            {[
              "Provide truthful, accurate descriptions of all listings.",
              "Deliver services and assets within the stated delivery window.",
              "Honor refund requests in line with the HUXZAIN Refund Policy.",
              "Payments are processed via Razorpay and credited directly to your verified bank account.",
              "Complete identity verification (KYC) before listings are activated.",
              "HUXZAIN acts as a marketplace platform — sellers are responsible for delivery and tax compliance.",
              "Violations of platform rules may result in suspension or permanent removal.",
              "Subscription fees are non-refundable once a billing cycle has started.",
              "Listing counts are enforced per your active plan tier.",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <Check className="size-3.5 text-crimson mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="pt-2">
            Read the full{" "}
            <Link to="/legal/seller-agreement" className="text-crimson hover:underline">Seller Agreement</Link>{" "}
            and{" "}
            <Link to="/legal/terms" className="text-crimson hover:underline">Terms of Service</Link>{" "}
            for complete terms.
          </p>
        </div>

        <label className="mt-6 flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            id="seller-agree-checkbox"
            checked={agreed}
            onChange={(e) => onAgree(e.target.checked)}
            className="mt-0.5 size-4 accent-crimson"
          />
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            I have read and accept the HUXZAIN Seller Agreement, Refund Policy, and Terms of Service.
          </span>
        </label>

        <button
          onClick={onNext}
          disabled={!agreed}
          className="mt-6 w-full bg-crimson text-foreground py-3.5 rounded-xl font-semibold text-sm uppercase tracking-wider hover:bg-crimson-glow disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group"
        >
          Continue to Plan Selection
          <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Plans Step                                                      */
/* ─────────────────────────────────────────────────────────────── */
function PlansStep({ processing, onSelect, onBack }: {
  processing: string | null;
  onSelect: (p: PlanDef) => void;
  onBack: () => void;
}) {
  return (
    <section className="px-6 py-16 max-w-7xl mx-auto">
      <button onClick={onBack} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground mb-8 flex items-center gap-2 transition-colors">
        ← Back
      </button>
      <div className="text-center mb-14">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mb-3">— Step 2 of 2</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Choose your seller tier</h1>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
          Upgrade anytime. Cancel anytime. Every plan includes escrow protection.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            loading={processing === plan.id}
            disabled={!!processing}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Plan Card                                                       */
/* ─────────────────────────────────────────────────────────────── */
function PlanCard({ plan, loading, disabled, onSelect }: {
  plan: PlanDef; loading: boolean; disabled: boolean; onSelect: (p: PlanDef) => void;
}) {
  const { Icon } = plan;

  const cardStyle: Record<string, string> = {
    starter: "border border-border bg-surface hover:border-border/60",
    popular: "border border-crimson/60 bg-surface shadow-[0_0_40px_-12px_oklch(0.55_0.22_25/0.4)] hover:shadow-[0_0_60px_-8px_oklch(0.55_0.22_25/0.6)]",
    elite: "border border-crimson/40 bg-gradient-to-b from-[oklch(0.12_0.02_25)] to-[oklch(0.08_0.005_25)] hover:border-crimson/70",
    exclusive: "border border-[oklch(0.75_0.15_75)/0.5] bg-gradient-to-b from-[oklch(0.12_0.025_60)] to-[oklch(0.08_0.005_25)] hover:border-[oklch(0.75_0.15_75)/0.8] hover:shadow-[0_0_60px_-8px_oklch(0.75_0.15_75/0.3)]",
  };

  const badgeStyle: Record<string, string> = {
    starter: "bg-surface-elevated text-muted-foreground border-border",
    popular: "bg-crimson/20 text-crimson border-crimson/40",
    elite: "bg-crimson/15 text-crimson border-crimson/30",
    exclusive: "bg-[oklch(0.75_0.15_75)/0.15] text-[oklch(0.85_0.18_75)] border-[oklch(0.75_0.15_75)/0.4]",
  };

  const ctaStyle: Record<string, string> = {
    starter: "bg-surface-elevated hover:bg-surface text-foreground border border-border",
    popular: "bg-crimson hover:bg-crimson-glow text-foreground hover:shadow-[var(--shadow-glow-crimson)]",
    elite: "bg-gradient-to-r from-crimson to-[oklch(0.5_0.22_15)] hover:opacity-90 text-foreground",
    exclusive: "bg-gradient-to-r from-[oklch(0.75_0.15_75)] to-[oklch(0.65_0.18_55)] hover:opacity-90 text-[oklch(0.08_0_0)] font-bold",
  };

  const iconStyle: Record<string, string> = {
    starter: "text-muted-foreground",
    popular: "text-crimson",
    elite: "text-crimson",
    exclusive: "text-[oklch(0.75_0.15_75)]",
  };

  return (
    <div className={`relative rounded-2xl p-6 flex flex-col transition-all duration-300 ${cardStyle[plan.tier]}`}>
      {/* Popular / VIP ribbon */}
      {plan.tier === "popular" && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="px-4 py-1 rounded-full bg-crimson text-[10px] font-mono uppercase tracking-widest">
            Most Popular
          </span>
        </div>
      )}
      {plan.tier === "exclusive" && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="px-4 py-1 rounded-full bg-gradient-to-r from-[oklch(0.75_0.15_75)] to-[oklch(0.65_0.18_55)] text-[oklch(0.08_0_0)] text-[10px] font-mono uppercase tracking-widest font-bold">
            ⚡ VIP Tier
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-4">
          <Icon className={`size-6 ${iconStyle[plan.tier]}`} />
          <span className={`px-2.5 py-1 rounded-full border text-[10px] font-mono uppercase tracking-widest ${badgeStyle[plan.tier]}`}>
            {plan.badge}
          </span>
        </div>
        <h3 className="text-xl font-bold">{plan.name}</h3>
        <p className="text-xs text-muted-foreground mt-1">{plan.tagline}</p>
      </div>

      {/* Price */}
      <div className="mb-5 pb-5 border-b border-border">
        <div className="flex items-end gap-1">
          <span className="text-3xl font-bold">
            {plan.price === 0 ? "₹0" : `₹${plan.price.toLocaleString("en-IN")}`}
          </span>
          <span className="text-muted-foreground text-sm mb-0.5">{plan.period}</span>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground mt-1 uppercase tracking-wider">{plan.listings}</p>
      </div>

      {/* Features */}
      <ul className="space-y-2.5 mb-6 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className={`size-3.5 shrink-0 mt-0.5 ${iconStyle[plan.tier]}`} />
            <span className="text-muted-foreground">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        id={`plan-cta-${plan.id}`}
        onClick={() => onSelect(plan)}
        disabled={disabled}
        className={`w-full py-3 rounded-xl text-sm font-semibold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${ctaStyle[plan.tier]}`}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Processing…
          </span>
        ) : (
          <>
            {plan.cta}
            {plan.tier !== "starter" && <ArrowRight className="size-3.5" />}
          </>
        )}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Success Step                                                    */
/* ─────────────────────────────────────────────────────────────── */
function SuccessStep({ plan, onDashboard }: { plan: string; onDashboard: () => void }) {
  const planLabels: Record<string, string> = {
    free: "Starter", pro: "Pro", elite: "Elite", exclusive: "Exclusive",
  };

  return (
    <section className="px-6 py-32 max-w-2xl mx-auto text-center">
      <div className="relative inline-block mb-8">
        <div className="size-24 rounded-full bg-crimson/10 border border-crimson/30 flex items-center justify-center mx-auto">
          <Sparkles className="size-10 text-crimson" />
        </div>
        <div className="absolute inset-0 rounded-full bg-crimson/20 blur-2xl -z-10 animate-pulse" />
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mb-4">— Welcome Aboard</p>
      <h1 className="text-4xl font-bold mb-4">
        Your <span className="text-crimson">{planLabels[plan] ?? plan}</span> plan is live.
      </h1>
      <p className="text-muted-foreground mb-10 text-lg">
        Your seller account is active. Start creating listings and reach buyers on HUXZAIN Digital Marketplace.
      </p>

      <button
        onClick={onDashboard}
        className="inline-flex items-center gap-2 bg-crimson px-8 py-4 rounded-xl font-semibold hover:bg-crimson-glow hover:shadow-[var(--shadow-glow-crimson)] transition-all duration-300 group"
      >
        Open Seller Dashboard
        <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </section>
  );
}
