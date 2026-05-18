# HUXZAIN Marketplace - REST API Reference

**Base URL**: `/wp-json/huxzain/v1`

## Listings

### `GET /listings`
Retrieves a paginated list of marketplace listings.

**Query Parameters:**
- `limit` (int, default: 60, max: 100): Number of items per page.
- `page` (int, default: 1): Page number.
- `q` (string): Search text.
- `category` (string): Slug of the category to filter by.
- `featured` (boolean): Only show featured listings.

**Response Headers:**
- `X-WP-Total`: Total number of matching listings.
- `X-WP-TotalPages`: Total number of pages.

**Caching**: 15 minutes transient cache based on query arguments. Rate limited to 120 requests/minute per IP.

### `GET /listings/:slug`
Retrieves a single listing by its slug. Returns 404 if inactive.

---

## Categories

### `GET /categories`
Retrieves all active marketplace categories, ordered by their custom `sort_order` and title.

### `GET /categories/:slug`
Retrieves a specific category by its slug.

---

## News

### `GET /news`
Retrieves the latest news posts.
- `limit` (int, default: 10): Number of posts.

### `GET /news/:slug`
Retrieves a single news post.

---

## Schema (Listing Object)
```json
{
  "id": "wp-listing-123",
  "wp_id": 123,
  "transaction_listing_id": "uuid-from-supabase",
  "slug": "river-bundle",
  "title": "River Bundle",
  "description": "Plain text description",
  "description_html": "<p>HTML Description</p>",
  "price_inr": 1500,
  "delivery_time_hours": 24,
  "cover_image_url": "https://...",
  "images": [],
  "status": "active",
  "rating_avg": 4.5,
  "rating_count": 12,
  "is_featured": false,
  "seller_id": "uuid-for-supabase-seller",
  "category_id": "wp-category-45",
  "category": {
    "id": "wp-category-45",
    "wp_id": 45,
    "slug": "bundles",
    "name": "Bundles",
    "description": null,
    "sort_order": 1
  },
  "seller": {
    "id": "uuid",
    "username": "seller1",
    "display_name": "Pro Seller",
    "avatar_url": "https://...",
    "rating_avg": 4.8,
    "rating_count": 50,
    "seller_status": "approved"
  }
}
```
