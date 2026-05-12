# Safe Restore & Recovery Guide

## Accidental Folder Deletion
If you accidentally delete `elite-gamedev-hub-main` or the WordPress plugin directory:
1. Ensure you have run `npm run backup` previously.
2. The backups are stored in `elite-gamedev-hub-main/backups/`. (If the entire root is deleted, hopefully, you have Git pushed to a remote repository).
3. If you just need to restore the environment and plugins, run: `npm run restore`. This will extract the latest `.zip` backup and drop the WordPress plugin into the correct Local WP path.

## Rebuilding the Local WP Environment
1. Open **Local by Flywheel**.
2. If `aexis` site is broken, create a new site named `aexis` (URL: `aexis.local`).
3. Set the installation path to `C:\Users\rammo\Local Sites\aexis`.
4. Copy the plugin back: `npm run restore` will do this automatically if configured, or manually copy `aexis-marketplace-cms` to `app/public/wp-content/plugins/`.
5. Go to WP Admin -> Plugins and Activate `Aexis Marketplace CMS`.
6. Go to Settings -> Permalinks and click **Save Changes** (this flushes rewrite rules required for the REST API).

## Reconnecting WordPress and React
1. In the React project, open `src/lib/wordpress/client.ts`.
2. Ensure `WP_URL` is set to `http://aexis.local/wp-json/aexis/v1`.
3. If you change your Local WP domain, update this constant.
4. Restart your Vite dev server: `npm run dev`.

## Data Fallback Mechanism
If your Local WP is completely wiped out, the React app will *automatically* fall back to querying the old `listings` table in Supabase. You will not experience a frontend crash. Once you rebuild WP and add listings, it will seamlessly switch back to WP as the primary source.
