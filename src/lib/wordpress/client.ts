import { WPCategory, WPListing, WPNewsPost, WPPaginatedResponse } from "./types";

const WP_URL = "http://aexis.local/wp-json/aexis/v1";

export class WordPressClient {
  static async getCategories(): Promise<WPCategory[]> {
    try {
      const res = await fetch(`${WP_URL}/categories`, {
        cache: import.meta.env.DEV ? 'no-store' : 'default'
      });
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error("WP getCategories failed", e);
      return [];
    }
  }

  static async getListings(params?: { limit?: number; page?: number; category?: string; q?: string; featured?: boolean }): Promise<WPPaginatedResponse<WPListing>> {
    try {
      const url = new URL(`${WP_URL}/listings`);
      if (params?.limit) url.searchParams.set("limit", params.limit.toString());
      if (params?.page) url.searchParams.set("page", params.page.toString());
      if (params?.category) url.searchParams.set("category", params.category);
      if (params?.q) url.searchParams.set("q", params.q);
      if (params?.featured) url.searchParams.set("featured", "1");

      const res = await fetch(url.toString(), {
        cache: import.meta.env.DEV ? 'no-store' : 'default'
      });
      
      if (!res.ok) return { data: [], total: 0, totalPages: 0 };
      
      const total = parseInt(res.headers.get("X-WP-Total") || "0", 10);
      const totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "0", 10);
      const data = await res.json();
      
      return { data, total, totalPages };
    } catch (e) {
      console.error("WP getListings failed", e);
      return { data: [], total: 0, totalPages: 0 };
    }
  }

  static async getListing(slug: string): Promise<WPListing | null> {
    try {
      const res = await fetch(`${WP_URL}/listings/${slug}`, {
        cache: import.meta.env.DEV ? 'no-store' : 'default'
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error("WP getListing failed", e);
      return null;
    }
  }
}
