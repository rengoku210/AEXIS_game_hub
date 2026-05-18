# Migration History - HUXZAIN Marketplace Plugin

## v2.0 - HUXZAIN Rebrand & Platform Restructure
**Date**: May 2026

**Changes**:
- Full rebrand from `AEXIS` → `HUXZAIN` across all plugin files, REST namespaces, and post types.
- CPT renamed from `aexis_listing` → `huxzain_listing`.
- REST namespace changed from `/wp-json/aexis/v1/` → `/wp-json/huxzain/v1/`.
- Plugin entry point renamed to `huxzain-marketplace.php`.
- WordPress option key updated from `aexis_db_version` → `huxzain_db_version`.
- Admin menu slug updated from `aexis-marketplace` → `huxzain-marketplace`.
- 11 admin submenus added: Dashboard, Listings, Sellers, Disputes, Payouts, Chat Moderation, KYC Review, Subscriptions, Fraud Logs, Audit Log, Categories.
- Added full pricing meta class with fixed/negotiable/auction/subscription pricing types, expiry, featured toggle, KYC requirement, visibility controls.

## v1.1 - Consolidation of Custom Post Types (AEXIS era)
**Date**: May 2026

**Problem**:
The plugin originally registered two separate custom post types: `aexis_listing` and `aexis_item`. This caused fragmentation — some API queries failed to pick up listings, metadata serialization was inconsistent, and editors were confused about which type to use.

**Solution**:
1. Declared `aexis_listing` as the canonical, sole post type for the marketplace.
2. Created a programmatic migration on `admin_init` via SQL:
   `UPDATE wp_posts SET post_type = 'aexis_listing' WHERE post_type = 'aexis_item'`
3. The plugin tracked the DB version in the `aexis_db_version` option.
4. Restored `/api/routes.php` and `/admin/meta-boxes.php` to strictly query/manage `aexis_listing`.

## Future Upgrades
For any future migrations, add logic inside `/admin/migrations.php` and increment the version check in `huxzain_run_migrations()`.
