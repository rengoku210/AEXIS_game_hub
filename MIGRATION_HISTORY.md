# Migration History - Aexis Marketplace CMS

## v1.1 - Consolidation of Custom Post Types
**Date**: May 2026

**Problem**:
The plugin originally registered two separate custom post types: `aexis_listing` and `aexis_item`. This created severe fragmentation in the database, where some API queries failed to pick up listings, metadata serialization was inconsistent, and editors were confused as to which post type to use.

**Solution**:
1. Declared `aexis_listing` as the canonical, sole post type for the marketplace.
2. Created a programmatic migration on `admin_init` that executes an SQL update:
   `UPDATE wp_posts SET post_type = 'aexis_listing' WHERE post_type = 'aexis_item'`
3. The plugin tracks the DB version in the `aexis_db_version` option. Once the v1.1 migration runs, all legacy items are seamlessly converted to listings without losing their associated metadata (since WordPress stores post meta via `post_id`, which remains unchanged).
4. Restored `/api/routes.php` and `/admin/meta-boxes.php` to strictly query/manage `aexis_listing` to eliminate redundant checks.

## Future Upgrades
For any future migrations, add logic inside `/admin/migrations.php` and increment the version check in `aexis_run_migrations()`.
