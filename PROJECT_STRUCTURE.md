# Aexis Marketplace - Hybrid Architecture

## Overview
Aexis is built on a **Hybrid Data Architecture**:
- **WordPress (CMS):** Primary source of truth for marketplace catalog (Listings, Categories, Content).
- **React (Frontend):** High-performance, Vite + TanStack router based single page application.
- **Supabase (Backend as a Service):** Handles authentication, transactional data, user profiles, and serves as a fallback database if WordPress is unreachable.
- **Razorpay:** Payment gateway used for INR transactions and order escrow.

## Frontend Architecture
- **Framework:** React 19 + Vite
- **Routing:** `@tanstack/react-router` (File-based routing via `src/routes/`)
- **Data Fetching:** Hybrid orchestrator at `src/lib/marketplace-data.ts`. Tries WordPress via REST API first, falls back to Supabase.
- **Styling:** Tailwind CSS v4 + Radix UI Primitives + Lucide Icons.

## WordPress Plugin Architecture
- **Location:** `C:\Users\rammo\Local Sites\aexis\app\public\wp-content\plugins\aexis-marketplace-cms`
- **Core Files:**
  - `aexis-marketplace-cms.php`: Registers the custom post types (Listings, News), meta boxes, and REST API endpoints.
- **REST API Endpoints:**
  - `GET /wp-json/aexis/v1/listings` - Supports `page`, `limit`, `category`, and `featured` filtering. Includes `X-WP-TotalPages` headers for frontend pagination.
  - `GET /wp-json/aexis/v1/categories` - Returns active categories.
- **Caching:** The REST API utilizes WordPress Transients (cached for 15 mins) and automatically invalidates the cache on post save/update/delete.

## Supabase Integrations
- **Authentication:** Supabase Auth is used for all users (buyers and sellers).
- **Orders:** Escrow and payment state is tracked in the `orders` table.
- **Profiles:** User display names, avatars, and seller ratings.
- **Chat:** Real-time messaging between buyer and seller using Supabase row-level security (RLS).

## Payment Flow
1. Buyer clicks "Buy Now" on `listing.$slug.tsx`.
2. A TanStack server function (`createRazorpayOrder`) initiates an order on Razorpay and stores a 'pending' order in Supabase.
3. React opens the Razorpay checkout modal via `openRazorpayCheckout`.
4. Upon successful payment, a webhook verifies the signature, or the frontend verification fires `verifyRazorpayPayment`.
5. Order status is updated to `paid` and escrow begins.

## Deployment Flow
- **React App:** Deployed on Vercel. Static assets are built via `vite build`. Environment variables (Supabase URL, Razorpay Keys) are securely injected.
- **WordPress CMS:** Hosted independently. Must be accessible over the internet via a public URL for the Vercel app to fetch from `WP_URL`.
