import { WordPressClient } from "./wordpress/client";
import { supabase } from "@/integrations/supabase/client";
import { WPListing } from "./wordpress/types";
import { logger } from "./logger";

// Convert WPListing to match the Supabase ListingRow format for the UI
export function convertWPListing(wp: WPListing) {
  return {
    id: wp.transaction_listing_id || wp.id, // Prefer supabase ID if synced, else fallback to WP ID
    slug: wp.slug,
    title: wp.title,
    price_inr: wp.price_inr,
    cover_image_url: wp.cover_image_url,
    rating_avg: wp.rating_avg,
    rating_count: wp.rating_count,
    is_featured: wp.is_featured,
    delivery_time_hours: wp.delivery_time_hours,
    category_id: wp.category_id || "",
    profiles: {
      display_name: wp.seller.display_name || wp.seller.username
    }
  };
}

export async function getMarketplaceListings(params?: { limit?: number; page?: number; category?: string; q?: string }) {
  const wpRes = await WordPressClient.getListings(params);
  
  if (wpRes.data && wpRes.data.length > 0) {
    logger.info("[Marketplace] Using WordPress data", { count: wpRes.data.length });
    return {
      data: wpRes.data.map(convertWPListing),
      total: wpRes.total,
      totalPages: wpRes.totalPages,
      source: "wordpress" as const
    };
  }

  logger.warn("[Marketplace] WP empty/failed, falling back to Supabase...", { params });
  // Fallback to Supabase
  let query = supabase
    .from("listings")
    .select("id,slug,title,price_inr,cover_image_url,rating_avg,rating_count,is_featured,delivery_time_hours,category_id,profiles(display_name)", { count: 'exact' })
    .eq("status", "active")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (params?.limit) {
    const page = params.page || 1;
    const from = (page - 1) * params.limit;
    const to = from + params.limit - 1;
    query = query.range(from, to);
  } else {
    query = query.limit(60);
  }

  // Supabase categories use UUIDs, but WP uses slugs. We skip filtering in fallback for category slugs unless we query the category first
  if (params?.q) query = query.ilike("title", `%${params.q}%`);

  const { data, count } = await query;
  
  const total = count || 0;
  const limit = params?.limit || 60;
  
  return {
    data: (data || []) as any[],
    total,
    totalPages: Math.ceil(total / limit),
    source: "supabase" as const
  };
}

export async function getMarketplaceCategories() {
  const wpCats = await WordPressClient.getCategories();
  if (wpCats && wpCats.length > 0) {
    return wpCats.map(c => ({
      id: c.slug, // using slug as ID for easier frontend routing
      slug: c.slug,
      name: c.name
    }));
  }
  
  // Fallback
  const { data } = await supabase.from("categories").select("id,slug,name").eq("is_active", true).order("sort_order");
  return data || [];
}

export async function getMarketplaceListingDetail(slug: string) {
  const wp = await WordPressClient.getListing(slug);
  if (wp) {
    logger.info("[Marketplace] Using WordPress detail data", { title: wp.title });
    return {
      id: wp.transaction_listing_id || wp.id,
      slug: wp.slug,
      title: wp.title,
      description: wp.description_html, // use HTML for WP
      price_inr: wp.price_inr,
      cover_image_url: wp.cover_image_url,
      images: wp.images,
      rating_avg: wp.rating_avg,
      rating_count: wp.rating_count,
      is_featured: wp.is_featured,
      delivery_time_hours: wp.delivery_time_hours,
      status: wp.status,
      seller_id: wp.seller.id,
      category: wp.category ? { id: wp.category.slug, name: wp.category.name, slug: wp.category.slug } : null,
      profiles: {
        id: wp.seller.id,
        username: wp.seller.username,
        display_name: wp.seller.display_name,
        avatar_url: wp.seller.avatar_url,
      },
      source: "wordpress" as const
    };
  }

  logger.info("[Marketplace] WP detail empty/failed, falling back to Supabase...");
  const { data } = await supabase
    .from("listings")
    .select(`
      id, slug, title, description, price_inr, cover_image_url, images, 
      rating_avg, rating_count, is_featured, delivery_time_hours, status,
      categories(id, name, slug),
      profiles(id, username, display_name, avatar_url)
    `)
    .eq("slug", slug)
    .single();

  if (!data) return null;

  return {
    ...data,
    category: data.categories,
    source: "supabase" as const
  };
}
