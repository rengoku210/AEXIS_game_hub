export interface WPCategory {
  id: string;
  wp_id: number;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface WPSeller {
  id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  rating_avg: number;
  rating_count: number;
  seller_status: string;
}

export interface WPListing {
  id: string;
  wp_id: number;
  transaction_listing_id: string | null;
  slug: string;
  title: string;
  description: string;
  description_html: string;
  price_inr: number;
  delivery_time_hours: number;
  cover_image_url: string | null;
  images: string[];
  status: string;
  rating_avg: number;
  rating_count: number;
  is_featured: boolean;
  seller_id: string | null;
  category_id: string | null;
  category: WPCategory | null;
  seller: WPSeller;
}

export interface WPNewsPost {
  id: string;
  wp_id: number;
  slug: string;
  title: string;
  excerpt: string;
  content_html: string;
  cover_image_url: string | null;
  published_at: string;
}

export interface WPPaginatedResponse<T> {
  data: T[];
  total: number;
  totalPages: number;
}
