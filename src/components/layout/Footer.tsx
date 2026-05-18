import { Link } from "@tanstack/react-router";

const MARKETPLACE_LINKS = [
  { to: "/marketplace", label: "Browse All" },
  { to: "/category/$slug", params: { slug: "gaming-accounts" }, label: "Gaming Accounts" },
  { to: "/category/$slug", params: { slug: "gift-cards" }, label: "Gift Cards" },
  { to: "/category/$slug", params: { slug: "software" }, label: "Software" },
  { to: "/category/$slug", params: { slug: "coaching-services" }, label: "Coaching" },
  { to: "/sell", label: "Become a Seller" },
];

const PLATFORM_LINKS = [
  { to: "/about", label: "About HUXZAIN" },
  { to: "/about", label: "How It Works" },
  { to: "/contact", label: "Contact" },
  { to: "/auth", label: "Sign In" },
];

const LEGAL_LINKS = [
  { to: "/legal/terms", label: "Terms of Service" },
  { to: "/legal/privacy", label: "Privacy Policy" },
  { to: "/legal/refund", label: "Refund Policy" },
  { to: "/legal/seller-agreement", label: "Seller Agreement" },
  { to: "/legal/disclaimer", label: "Disclaimer" },
];

const SUPPORT_LINKS = [
  { label: "support@huxzain.shop", href: "mailto:support@huxzain.shop" },
  { label: "+91 80996 41606", href: "https://wa.me/918099641606" },
  { label: "Report Fraud", href: "/contact" },
  { label: "Contact Support", href: "/contact" },
];

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-border bg-surface/30">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-5">
          {/* Brand column */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tighter mb-4">
              <span className="block size-3 rounded-sm bg-crimson shadow-[0_0_8px_var(--crimson)]" />
              HUXZAIN
            </Link>
            <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-xs mb-6">
              A trust-first digital marketplace for gaming accounts, software, gift cards, coaching services, freelance, and more.
            </p>
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-crimson opacity-50" />
                <span className="relative inline-flex rounded-full size-2 bg-crimson" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Live Marketplace</span>
            </div>
          </div>

          {/* Marketplace links */}
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">Marketplace</h4>
            <ul className="space-y-3 text-sm font-light">
              {MARKETPLACE_LINKS.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to as any}
                    params={(l as any).params}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform links */}
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">Platform</h4>
            <ul className="space-y-3 text-sm font-light">
              {PLATFORM_LINKS.map((l) => (
                <li key={l.label}>
                  <Link to={l.to as any} className="text-muted-foreground hover:text-foreground transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
              {SUPPORT_LINKS.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    target={l.href.startsWith("https://") ? "_blank" : undefined}
                    rel={l.href.startsWith("https://") ? "noreferrer" : undefined}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">Legal</h4>
            <ul className="space-y-3 text-sm font-light">
              {LEGAL_LINKS.map((l) => (
                <li key={l.label}>
                  <Link to={l.to as any} className="text-muted-foreground hover:text-foreground transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <p className="font-mono text-muted-foreground tracking-wider">
            © {new Date().getFullYear()} HUXZAIN DIGITAL MARKETPLACE. ALL RIGHTS RESERVED.
          </p>
          <div className="flex items-center gap-4 font-mono text-muted-foreground tracking-wider">
            <span><span className="text-crimson">●</span> SECURED PLATFORM v2.0</span>
            <span>RAZORPAY PAYMENTS</span>
            <span>ESCROW PROTECTED</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
