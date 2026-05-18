# Safe Restore & Recovery Guide

## Accidental Folder Deletion
If you accidentally delete `elite-gamedev-hub-main` or the WordPress plugin directory:
1. Ensure you have run `npm run backup` previously.
2. Backups are stored in `elite-gamedev-hub-main/backups/`. (If the entire root is deleted, push to a remote Git repo first.)
3. To restore the environment and plugins, run: `npm run restore`. This will extract the latest `.zip` backup and drop the WordPress plugin into the correct Local WP path.

## Rebuilding the Local WP Environment
1. Open **Local by Flywheel**.
2. If `huxzain` site is broken, create a new site named `huxzain` (URL: `huxzain.local`).
3. Set the installation path to `C:\Users\rammo\Local Sites\huxzain`.
4. Copy the plugin back: `npm run restore` will do this automatically if configured, or manually copy `huxzain-marketplace` to `app/public/wp-content/plugins/`.
5. Go to WP Admin → Plugins and Activate **HUXZAIN Marketplace**.
6. Go to Settings → Permalinks and click **Save Changes** (this flushes rewrite rules required for the REST API).

## Reconnecting WordPress and React
1. In the React project, open `src/lib/wordpress/client.ts`.
2. Ensure `WP_URL` is set to `http://huxzain.local/wp-json/huxzain/v1`.
3. If you change your Local WP domain, update `VITE_WORDPRESS_API_BASE` in `.env.local`.
4. Restart your Vite dev server: `npm run dev`.

## Data Fallback Mechanism
If your Local WP is completely wiped out, the React app will *automatically* fall back to querying the `listings` table in Supabase. You will not experience a frontend crash. Once you rebuild WP and add listings, it will seamlessly switch back to WP as the primary source.

## WordPress Constants (wp-config.php)
Add the following to your `wp-config.php` for the HUXZAIN plugin to proxy Supabase calls:

```php
define('HUXZAIN_SUPABASE_URL', 'https://fqeoracqywgwbvwijwqq.supabase.co');
define('HUXZAIN_SUPABASE_SERVICE_KEY', 'your-service-role-key-here');
define('HUXZAIN_SUPABASE_ANON_KEY', 'your-anon-key-here');
```
