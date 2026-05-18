import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMarketplaceCategories, getMarketplaceListings } from "@/lib/marketplace-data";
import { SiteShell } from "@/components/layout/SiteShell";
import { ListingCard } from "@/components/marketplace/ListingCard";
import {
  Search, ShieldCheck, Lock, Headphones,
  Gamepad2, GraduationCap, TrendingUp, Coins,
  Gift, Monitor, RefreshCw, Megaphone, Globe, Layers,
  Users, Video, Palette, Zap, Star, ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HUXZAIN — The Digital Marketplace" },
      { name: "description", content: "HUXZAIN is a trust-first digital marketplace for gaming accounts, software, gift cards, coaching, freelance services, and more. Verified sellers. Secure escrow. Human dispute resolution." },
      { property: "og:title", content: "HUXZAIN — The Digital Marketplace" },
      { property: "og:description", content: "Trust-first digital marketplace. Verified sellers. Secure escrow. Human dispute resolution." },
    ],
  }),
  component: HomePage,
});


const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "gaming-accounts": Gamepad2,
  "in-game-currency": Coins,
  "gift-cards": Gift,
  "software": Monitor,
  "digital-subscriptions": RefreshCw,
  "coaching-services": GraduationCap,
  "boosting-services": TrendingUp,
  "gaming-services": Zap,
  "digital-freelance": Layers,
  "ads-promotions": Megaphone,
  "marketplace-listings": Star,
  "social-media-services": Users,
  "streaming-services": Video,
  "digital-assets": Palette,
  "website-app-services": Globe,
};

const TRUST_FEATURES = [
  {
    icon: ShieldCheck,
    title: "Verified Sellers",
    desc: "Every seller is KYC-verified before listing. No anonymity, full accountability.",
  },
  {
    icon: Lock,
    title: "Secure Escrow",
    desc: "Funds are held in escrow until successful delivery is confirmed by the buyer.",
  },
  {
    icon: Headphones,
    title: "Human Disputes",
    desc: "Every dispute is reviewed and resolved by a real human moderator—not an algorithm.",
  },
];

const STATS = [
  { label: "Vetted Sellers", value: "100", suffix: "%", note: "KYC verification mandatory" },
  { label: "Dispute Window", value: "24", suffix: "h", note: "Human review SLA" },
  { label: "Payment Security", value: "PCI", suffix: ".1", note: "Bank-grade encryption" },
  { label: "Categories", value: "16", suffix: "+", note: "Digital product verticals" },
];

function HomePage() {
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);

  useEffect(() => {
    void (async () => {
      const [cats, lists] = await Promise.all([
        getMarketplaceCategories(),
        getMarketplaceListings({ limit: 8, featured: true }),
      ]);
      setCategories(cats);
      setFeatured(lists.data);
    })();
  }, []);

  return (
    <SiteShell>
      {/* ══ HERO ══════════════════════════════════════════════════ */}
      <section className="relative pt-24 pb-32 px-6 overflow-hidden">
        {/* ambient bg */}
        <div className="absolute inset-0 ambient-spotlight pointer-events-none" />
        <div className="absolute inset-0 grid-noise pointer-events-none opacity-60" />

        <div className="relative max-w-5xl mx-auto text-center">
          {/* live badge */}
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full border border-crimson/20 bg-oxblood/20 backdrop-blur-md mb-10">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-crimson opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-crimson" />
            </span>
            <span className="font-mono text-[10px] tracking-[0.2em] text-crimson uppercase">
              Trust-First Digital Marketplace
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-balance leading-[0.9] mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-foreground via-zinc-300 to-zinc-500">
              HUXZAIN
            </span>
          </h1>
          <p className="text-xl md:text-2xl font-light text-muted-foreground mb-3 tracking-wide">
            The Digital Marketplace
          </p>

          <p className="text-base md:text-lg font-light text-muted-foreground/70 text-pretty max-w-[60ch] mx-auto mb-12 leading-relaxed">
            Buy and sell gaming accounts, software licenses, gift cards, digital subscriptions, coaching, freelance services, and more—with full seller verification, escrow protection, and human moderation.
          </p>

          {/* search bar */}
          <form
            onSubmit={(e) => { e.preventDefault(); window.location.href = `/marketplace?q=${encodeURIComponent(query)}`; }}
            className="relative max-w-2xl mx-auto mb-10"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-oxblood via-crimson/20 to-void rounded-xl blur-sm opacity-60" />
            <div className="relative flex items-center bg-surface-elevated border border-border rounded-xl p-2 shadow-2xl hover:border-white/15 transition-colors">
              <div className="pl-4 pr-3 text-muted-foreground"><Search className="size-4" /></div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search accounts, software, gift cards, coaching…"
                className="flex-1 bg-transparent py-3.5 text-foreground placeholder:text-muted-foreground/50 outline-none font-light min-w-0 text-sm"
              />
              <button
                type="submit"
                className="bg-crimson text-foreground px-6 py-3 rounded-lg font-semibold tracking-wider text-xs uppercase hover:bg-crimson-glow transition-colors shrink-0"
              >
                Search
              </button>
            </div>
          </form>

          {/* trust badges */}
          <div className="flex flex-wrap justify-center gap-6 md:gap-12 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
            <div className="flex items-center gap-2"><ShieldCheck className="size-3 text-crimson" /> Verified Sellers</div>
            <div className="flex items-center gap-2"><Lock className="size-3 text-crimson" /> Secure Escrow</div>
            <div className="flex items-center gap-2"><Headphones className="size-3 text-crimson" /> Human Support</div>
          </div>
        </div>
      </section>

      {/* ══ CATEGORIES ═══════════════════════════════════════════ */}
      <section className="relative px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mb-3">— Market Sectors</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Browse by category</h2>
              <p className="mt-2 text-muted-foreground text-sm max-w-md">
                16 curated digital verticals, from gaming to freelance to digital assets.
              </p>
            </div>
            <Link to="/marketplace" className="hidden md:inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
              View all <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {categories.map((c, i) => {
              const Icon = CATEGORY_ICONS[c.slug] ?? Gamepad2;
              return (
                <Link
                  key={c.id}
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  className="group relative h-44 rounded-2xl overflow-hidden glass border border-border transition-all duration-500 hover:border-crimson/40 hover:shadow-[var(--shadow-glow-crimson)] hover:-translate-y-0.5"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-oxblood/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute inset-0 p-5 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="font-mono text-[9px] tracking-widest text-muted-foreground group-hover:text-crimson transition-colors">/0{i + 1}</span>
                      <Icon className="size-5 text-muted-foreground group-hover:text-crimson transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold tracking-tight text-foreground mb-1 leading-tight">{c.name}</h3>
                      <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-crimson opacity-0 group-hover:opacity-100 transition-opacity">
                        Browse →
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ FEATURED LISTINGS ═══════════════════════════════════ */}
      {featured.length > 0 && (
        <section className="relative px-6 pb-24">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mb-3">— Live Inventory</p>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Recently listed</h2>
              </div>
              <Link to="/marketplace" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5">
                Browse all <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {featured.map((l) => (
                <ListingCard key={l.id} listing={l} sellerName={l.profiles?.display_name} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ TRUST FEATURES ══════════════════════════════════════ */}
      <section className="relative px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mb-3">— The HUXZAIN Standard</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight max-w-3xl mx-auto">
              Built on <span className="text-crimson">trust</span>. Backed by systems.
            </h2>
            <p className="mt-5 max-w-2xl mx-auto text-muted-foreground font-light leading-relaxed">
              Every seller is manually verified. Every transaction is escrowed. Every dispute is resolved by humans, not bots. HUXZAIN is infrastructure-grade safety for digital commerce.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {TRUST_FEATURES.map((f) => (
              <div key={f.title} className="glass rounded-2xl p-7 border border-border hover:border-crimson/20 transition-colors">
                <div className="size-10 rounded-xl bg-oxblood/40 flex items-center justify-center mb-5">
                  <f.icon className="size-5 text-crimson" />
                </div>
                <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* stats strip */}
          <div className="glass-strong rounded-3xl overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border">
              {STATS.map((s) => (
                <div key={s.label} className="p-8 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{s.label}</p>
                  <p className="text-4xl font-bold tabular-nums">
                    {s.value}<span className="text-crimson">{s.suffix}</span>
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{s.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ CTA BAND ════════════════════════════════════════════ */}
      <section className="relative px-6 pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="glass-strong rounded-3xl p-14 border border-crimson/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-oxblood/10 via-transparent to-crimson/5 pointer-events-none" />
            <div className="relative">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mb-4">— Start Trading</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Ready to join HUXZAIN?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                Buy with confidence. Sell with accountability. HUXZAIN is the marketplace built for serious digital commerce.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/marketplace"
                  className="inline-flex items-center justify-center gap-2 bg-crimson px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-crimson-glow transition-colors shadow-[var(--shadow-glow-crimson)]"
                >
                  Browse Marketplace
                </Link>
                <Link
                  to="/auth"
                  className="inline-flex items-center justify-center gap-2 border border-border px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-surface-elevated transition-colors"
                >
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
