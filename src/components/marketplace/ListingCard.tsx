import { Link } from "@tanstack/react-router";
import { formatINR } from "@/lib/format";
import { Star, Shield } from "lucide-react";

interface ListingCardProps {
  listing: {
    id: string;
    slug: string;
    title: string;
    price_inr: number;
    original_price?: number | null;
    cover_image_url: string | null;
    rating_avg: number;
    rating_count: number;
    is_featured: boolean;
    delivery_time_hours: number;
  };
  sellerName?: string | null;
}

export function ListingCard({ listing, sellerName }: ListingCardProps) {
  const hasPrice = listing.price_inr > 0;
  const discountPercentage = 
    listing.original_price && listing.price_inr > 0 && listing.original_price > listing.price_inr
      ? Math.round(((listing.original_price - listing.price_inr) / listing.original_price) * 100)
      : null;
  return (
    <Link
      to="/listing/$slug"
      params={{ slug: listing.slug }}
      className="group relative block overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-500 hover:border-crimson/40 hover:shadow-[var(--shadow-glow-crimson)]"
      itemScope itemType="https://schema.org/Product"
    >
      <meta itemProp="name" content={listing.title} />
      <meta itemProp="description" content={`Aexis premium gaming asset: ${listing.title}`} />
      
      <div className="aspect-[4/3] relative overflow-hidden bg-surface-elevated">
        {listing.cover_image_url ? (
          <>
            <meta itemProp="image" content={listing.cover_image_url} />
            <img
              src={listing.cover_image_url}
              srcSet={`${listing.cover_image_url}?w=400 400w, ${listing.cover_image_url}?w=800 800w`}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              alt={listing.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
            />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-oxblood/20 to-surface flex items-center justify-center">
            <span className="font-mono text-xs text-muted-foreground tracking-widest">NO PREVIEW</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/40 to-transparent" />
        {listing.is_featured && (
          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-crimson/90 backdrop-blur-sm font-mono text-[9px] uppercase tracking-widest text-white">
            <Shield className="size-2.5" /> Featured
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="text-base font-semibold text-foreground line-clamp-1 group-hover:text-crimson-glow transition-colors">
          {listing.title}
        </h3>
        {sellerName && (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">by {sellerName}</p>
        )}

        <div className="mt-4 flex items-center justify-between" itemProp="offers" itemScope itemType="https://schema.org/Offer">
          <meta itemProp="priceCurrency" content="INR" />
          {hasPrice && <meta itemProp="price" content={listing.price_inr.toString()} />}
          <link itemProp="availability" href="https://schema.org/InStock" />
          
          <div>
            {hasPrice ? (
              <>
                {listing.original_price && listing.original_price > listing.price_inr && (
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground line-through">
                      {formatINR(listing.original_price)}
                    </p>
                    <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-crimson/20 text-crimson uppercase">
                      {discountPercentage}% off
                    </span>
                  </div>
                )}
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Starting at</p>
                <p className="text-lg font-bold text-foreground">{formatINR(listing.price_inr)}</p>
              </>
            ) : (
              <>
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Price</p>
                <p className="text-lg font-bold text-crimson">Contact Seller</p>
              </>
            )}
          </div>
          {listing.rating_count > 0 && (
            <div className="flex items-center gap-1 text-xs" itemProp="aggregateRating" itemScope itemType="https://schema.org/AggregateRating">
              <meta itemProp="ratingValue" content={listing.rating_avg.toFixed(1)} />
              <meta itemProp="reviewCount" content={listing.rating_count.toString()} />
              <Star className="size-3 fill-crimson text-crimson" />
              <span className="text-foreground font-semibold">{listing.rating_avg.toFixed(1)}</span>
              <span className="text-muted-foreground">({listing.rating_count})</span>
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          <span>~{listing.delivery_time_hours}h delivery</span>
          <span className="text-crimson">View →</span>
        </div>
      </div>
    </Link>
  );
}
