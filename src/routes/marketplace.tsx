import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell } from "@/components/layout/SiteShell";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { Search, Loader2 } from "lucide-react";
import { getMarketplaceCategories, getMarketplaceListings } from "@/lib/marketplace-data";

interface MarketSearch { q?: string; category?: string }

export const Route = createFileRoute("/marketplace")({
  validateSearch: (s: Record<string, unknown>): MarketSearch => ({
    q: typeof s.q === "string" ? s.q : undefined,
    category: typeof s.category === "string" ? s.category : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Marketplace — Aexis" },
      { name: "description", content: "Browse all live gaming listings: accounts, coaching, rank boosts, and in-game credits." },
    ],
  }),
  component: MarketplacePage,
});

function MarketplacePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/marketplace" });
  
  const [q, setQ] = useState(search.q ?? "");
  const [categories, setCategories] = useState<{id: string, slug: string, name: string}[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | undefined>(search.category);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch Categories
  useEffect(() => {
    void getMarketplaceCategories().then(setCategories);
  }, []);

  // Fetch Listings on search/category change
  useEffect(() => {
    setLoading(true);
    setPage(1);
    
    const fetchInitial = async () => {

      const res = await getMarketplaceListings({
        limit: 12,
        page: 1,
        category: activeCategory,
        q: search.q
      });
      setListings(res.data);
      setTotalPages(res.totalPages);
      setLoading(false);
    };
    
    void fetchInitial();
  }, [activeCategory, search.q]);

  // Load More logic
  const handleLoadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    
    const res = await getMarketplaceListings({
      limit: 12,
      page: nextPage,
      category: activeCategory,
      q: search.q
    });
    
    setListings(prev => [...prev, ...res.data]);
    setPage(nextPage);
    setLoadingMore(false);
  };

  // Auto-refresh interval (for live previews syncing)
  useEffect(() => {
    const interval = setInterval(async () => {
      // Background revalidation of current page
      if (page === 1) {
        const res = await getMarketplaceListings({ limit: 12, page: 1, category: activeCategory, q: search.q });
        if (JSON.stringify(res.data) !== JSON.stringify(listings)) {
            setListings(res.data);
            setTotalPages(res.totalPages);
        }
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [activeCategory, search.q, page, listings]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({
      search: { q: q || undefined, category: activeCategory },
    });
  };

  const handleCategorySelect = (slug?: string) => {
    setActiveCategory(slug);
    navigate({
      search: { q: search.q, category: slug },
    });
  };

  return (
    <SiteShell>

      <section className="px-6 pt-12 pb-8 max-w-7xl mx-auto">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mb-3">— Marketplace</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Live inventory</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl font-light">All listings have been verified by Aexis moderators and the seller's identity confirmed.</p>

        <form onSubmit={handleSearch} className="mt-8 flex gap-2 max-w-2xl">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search listings..."
              className="w-full bg-surface-elevated border border-border rounded-lg pl-11 pr-4 py-3 text-sm font-light outline-none focus:border-crimson/50 transition-colors"
            />
          </div>
          <button type="submit" className="bg-crimson text-foreground px-6 py-3 rounded-lg font-semibold text-xs uppercase tracking-wider hover:bg-crimson-glow transition-colors">Search</button>
        </form>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => handleCategorySelect(undefined)}
            className={`px-4 py-2 rounded-full text-xs font-mono uppercase tracking-widest border transition-colors ${
              !activeCategory ? "bg-crimson border-crimson text-foreground" : "border-border text-muted-foreground hover:border-crimson/50 hover:text-foreground"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => handleCategorySelect(c.slug)}
              className={`px-4 py-2 rounded-full text-xs font-mono uppercase tracking-widest border transition-colors ${
                activeCategory === c.slug ? "bg-crimson border-crimson text-foreground" : "border-border text-muted-foreground hover:border-crimson/50 hover:text-foreground"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </section>

      <section className="px-6 pb-24 max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] rounded-2xl bg-surface animate-pulse" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-32 glass rounded-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mb-3">— Empty Sector</p>
            <h2 className="text-2xl font-bold mb-2">No listings yet</h2>
            <p className="text-muted-foreground mb-6">No assets match your search parameters.</p>
            <Link to="/sell" className="inline-block bg-crimson px-6 py-3 rounded-lg font-semibold text-sm">List an asset</Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} sellerName={l.profiles?.display_name} />
              ))}
            </div>
            
            {page < totalPages && (
              <div className="mt-12 text-center">
                <button 
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="bg-surface hover:bg-surface-elevated border border-border px-8 py-3 rounded-lg font-semibold text-sm transition-colors inline-flex items-center gap-2"
                >
                  {loadingMore ? <><Loader2 className="size-4 animate-spin"/> Loading...</> : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </SiteShell>
  );
}

