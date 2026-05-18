import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Menu, X, LayoutDashboard, ShieldCheck, MessageSquare } from "lucide-react";
import { useState } from "react";

const NAV_LINKS = [
  { to: "/marketplace", label: "Browse" },
  { to: "/sell", label: "Sell" },
  { to: "/about", label: "About" },
];

export function Header() {
  const { user, profile, isAdmin, isSeller, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-50 w-full px-4 pt-4">
      <nav className="mx-auto max-w-7xl">
        <div className="glass-strong flex items-center justify-between rounded-2xl px-5 py-3.5 shadow-[var(--shadow-elevated)]">
          {/* Logo + Nav */}
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tighter">
              <span className="block size-3 rounded-sm bg-crimson shadow-[0_0_12px_var(--crimson)]" />
              <span className="text-foreground">HUXZAIN</span>
            </Link>
            <div className="hidden md:flex items-center gap-7 text-sm font-light text-muted-foreground">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="transition-colors hover:text-foreground"
                  activeProps={{ className: "text-foreground" }}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right side — auth */}
          <div className="hidden md:flex items-center gap-5 text-sm">
            {user ? (
              <>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-crimson hover:text-crimson-glow transition-colors"
                  >
                    <ShieldCheck className="size-3" />
                    Admin
                  </Link>
                )}
                {isSeller && (
                  <Link
                    to="/seller"
                    className="flex items-center gap-1.5 font-light text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <LayoutDashboard className="size-3.5" />
                    Dashboard
                  </Link>
                )}
                <Link
                  to="/messages"
                  className="font-light text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MessageSquare className="size-4" />
                </Link>
                <Link to="/account" className="font-light text-muted-foreground hover:text-foreground transition-colors">
                  {profile?.display_name ?? "Account"}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:border-crimson/50 hover:text-foreground transition-all"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/auth" className="font-light text-muted-foreground hover:text-foreground transition-colors">
                  Login
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-void hover:bg-crimson hover:text-foreground transition-all duration-300"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-foreground"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {/* Mobile drawer */}
        {open && (
          <div className="glass-strong md:hidden mt-2 rounded-2xl p-5 flex flex-col gap-4 text-sm">
            {NAV_LINKS.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                {l.label}
              </Link>
            ))}
            <div className="h-px bg-border" />
            {user ? (
              <>
                {isAdmin && <Link to="/admin" onClick={() => setOpen(false)} className="text-crimson font-mono text-xs uppercase tracking-widest">Admin Control</Link>}
                {isSeller && <Link to="/seller" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">Seller Dashboard</Link>}
                <Link to="/messages" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">Messages</Link>
                <Link to="/account" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">Account</Link>
                <button onClick={handleSignOut} className="text-left text-muted-foreground hover:text-foreground">Sign out</button>
              </>
            ) : (
              <>
                <Link to="/auth" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">Login</Link>
                <Link to="/auth" search={{ mode: "signup" }} onClick={() => setOpen(false)} className="rounded-lg bg-foreground text-void font-semibold py-2.5 text-center hover:bg-crimson hover:text-foreground transition-all">
                  Get Started
                </Link>
              </>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
