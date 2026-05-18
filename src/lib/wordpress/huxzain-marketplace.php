<?php
/**
 * Plugin Name: HUXZAIN Marketplace
 * Description: Core marketplace plugin for HUXZAIN Digital Marketplace
 * Version: 2.0.0
 * Author: HUXZAIN
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'HUXZAIN_VERSION', '2.0.0' );
define( 'HUXZAIN_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

// ================================================================
// BOOTSTRAP
// ================================================================

add_action( 'plugins_loaded', 'huxzain_bootstrap' );
function huxzain_bootstrap() {
    require_once HUXZAIN_PLUGIN_DIR . 'includes/class-post-types.php';
    require_once HUXZAIN_PLUGIN_DIR . 'includes/class-listing-meta.php';
    require_once HUXZAIN_PLUGIN_DIR . 'includes/class-pricing-meta.php';
    require_once HUXZAIN_PLUGIN_DIR . 'includes/class-rest-api.php';
    require_once HUXZAIN_PLUGIN_DIR . 'includes/class-category-manager.php';
    require_once HUXZAIN_PLUGIN_DIR . 'admin/admin-pages.php';
    require_once HUXZAIN_PLUGIN_DIR . 'admin/chat-moderation.php';
    require_once HUXZAIN_PLUGIN_DIR . 'admin/listing-moderation.php';
    require_once HUXZAIN_PLUGIN_DIR . 'admin/seller-verification.php';
    require_once HUXZAIN_PLUGIN_DIR . 'admin/payout-management.php';
    require_once HUXZAIN_PLUGIN_DIR . 'admin/dispute-center.php';
}

// ================================================================
// ADMIN MENU STRUCTURE
// ================================================================

add_action( 'admin_menu', 'huxzain_register_admin_menus' );
function huxzain_register_admin_menus() {
    add_menu_page(
        'HUXZAIN Marketplace',
        'HUXZAIN',
        'manage_options',
        'huxzain-marketplace',
        'huxzain_render_dashboard',
        'dashicons-store',
        4
    );

    $submenus = [
        [ 'huxzain-marketplace',    'Dashboard',         'huxzain_render_dashboard' ],
        [ 'huxzain-listings',       'Listings',          'huxzain_render_listings' ],
        [ 'huxzain-sellers',        'Sellers',           'huxzain_render_sellers' ],
        [ 'huxzain-disputes',       'Disputes',          'huxzain_render_disputes' ],
        [ 'huxzain-payouts',        'Payouts',           'huxzain_render_payouts' ],
        [ 'huxzain-chat-mod',       'Chat Moderation',   'huxzain_render_chat_moderation' ],
        [ 'huxzain-kyc',            'KYC Review',        'huxzain_render_kyc' ],
        [ 'huxzain-subscriptions',  'Subscriptions',     'huxzain_render_subscriptions' ],
        [ 'huxzain-fraud',          'Fraud Logs',        'huxzain_render_fraud' ],
        [ 'huxzain-audit',          'Audit Log',         'huxzain_render_audit' ],
        [ 'huxzain-categories',     'Categories',        'huxzain_render_categories' ],
    ];

    foreach ( $submenus as $sub ) {
        add_submenu_page(
            'huxzain-marketplace',
            $sub[1] . ' — HUXZAIN',
            $sub[1],
            'manage_options',
            $sub[0],
            $sub[2]
        );
    }
}

// ================================================================
// SHARED SUPABASE PROXY HELPER
// ================================================================

function huxzain_supabase_request( string $endpoint, string $method = 'GET', array $body = [], array $extra_headers = [] ): array {
    $url      = defined('HUXZAIN_SUPABASE_URL')      ? HUXZAIN_SUPABASE_URL      : '';
    $svc_key  = defined('HUXZAIN_SUPABASE_SERVICE_KEY') ? HUXZAIN_SUPABASE_SERVICE_KEY : '';

    if ( ! $url || ! $svc_key ) {
        return [ 'error' => 'Supabase not configured' ];
    }

    $args = [
        'method'  => $method,
        'timeout' => 20,
        'headers' => array_merge( [
            'apikey'        => $svc_key,
            'Authorization' => 'Bearer ' . $svc_key,
            'Content-Type'  => 'application/json',
            'Prefer'        => 'return=representation',
        ], $extra_headers ),
    ];

    if ( ! empty( $body ) ) {
        $args['body'] = wp_json_encode( $body );
    }

    $response = wp_remote_request( $url . '/rest/v1/' . ltrim( $endpoint, '/' ), $args );

    if ( is_wp_error( $response ) ) {
        return [ 'error' => $response->get_error_message() ];
    }

    return [
        'status' => wp_remote_retrieve_response_code( $response ),
        'data'   => json_decode( wp_remote_retrieve_body( $response ), true ),
    ];
}

// ================================================================
// DASHBOARD
// ================================================================

function huxzain_render_dashboard() {
    // Fetch quick stats from Supabase
    $listings  = huxzain_supabase_request('listings?select=count&status=eq.pending');
    $disputes  = huxzain_supabase_request('disputes?select=count&status=eq.open');
    $payouts   = huxzain_supabase_request('payout_requests?select=count&status=eq.pending');
    $fraud     = huxzain_supabase_request('fraud_logs?select=count&reviewed=eq.false&severity=in.(high,critical)');

    $pending_listings = isset($listings['data'][0]['count']) ? $listings['data'][0]['count'] : '—';
    $open_disputes    = isset($disputes['data'][0]['count']) ? $disputes['data'][0]['count'] : '—';
    $pending_payouts  = isset($payouts['data'][0]['count']) ? $payouts['data'][0]['count'] : '—';
    $fraud_alerts     = isset($fraud['data'][0]['count'])   ? $fraud['data'][0]['count']   : '—';
    ?>
    <div class="wrap" style="font-family:'Helvetica Neue',sans-serif;">
      <h1 style="font-size:24px;font-weight:700;margin-bottom:4px;">⬡ HUXZAIN Control Center</h1>
      <p style="color:#888;margin-top:0;margin-bottom:24px;font-size:13px;">Digital Marketplace Admin Dashboard · v<?php echo HUXZAIN_VERSION; ?></p>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px;">
        <?php
        $cards = [
            [ 'label'=>'Pending Listings',  'value'=>$pending_listings, 'color'=>'#f59e0b', 'link'=>'?page=huxzain-listings' ],
            [ 'label'=>'Open Disputes',     'value'=>$open_disputes,    'color'=>'#ef4444', 'link'=>'?page=huxzain-disputes' ],
            [ 'label'=>'Pending Payouts',   'value'=>$pending_payouts,  'color'=>'#3b82f6', 'link'=>'?page=huxzain-payouts' ],
            [ 'label'=>'Fraud Alerts',      'value'=>$fraud_alerts,     'color'=>'#dc2626', 'link'=>'?page=huxzain-fraud' ],
        ];
        foreach( $cards as $c ): ?>
        <a href="<?php echo esc_url($c['link']); ?>" style="text-decoration:none;">
          <div style="background:#0d0d0d;border:1px solid #1f1f1f;border-top:3px solid <?php echo $c['color']; ?>;border-radius:10px;padding:20px;">
            <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.15em;color:#666;margin:0 0 8px;"><?php echo esc_html($c['label']); ?></p>
            <p style="font-size:36px;font-weight:700;color:#f5f5f5;margin:0;"><?php echo esc_html($c['value']); ?></p>
          </div>
        </a>
        <?php endforeach; ?>
      </div>

      <div style="background:#0d0d0d;border:1px solid #1f1f1f;border-radius:10px;padding:20px;">
        <h2 style="font-size:14px;color:#f5f5f5;margin:0 0 12px;">Quick Actions</h2>
        <div style="display:flex;flex-wrap:wrap;gap:10px;">
          <?php
          $actions = [
            ['?page=huxzain-listings',  'Review Listings',    '#f59e0b'],
            ['?page=huxzain-disputes',  'Resolve Disputes',   '#ef4444'],
            ['?page=huxzain-payouts',   'Process Payouts',    '#3b82f6'],
            ['?page=huxzain-kyc',       'Review KYC',         '#10b981'],
            ['?page=huxzain-chat-mod',  'Chat Moderation',    '#8b5cf6'],
            ['?page=huxzain-fraud',     'Fraud Logs',         '#dc2626'],
          ];
          foreach( $actions as $a ): ?>
          <a href="<?php echo esc_url($a[0]); ?>"
             style="background:<?php echo $a[2]; ?>18;border:1px solid <?php echo $a[2]; ?>44;color:<?php echo $a[2]; ?>;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;font-family:monospace;text-transform:uppercase;letter-spacing:0.1em;">
            <?php echo esc_html($a[1]); ?> →
          </a>
          <?php endforeach; ?>
        </div>
      </div>
    </div>
    <?php
}

// Stubs for other admin pages (each is in its own file)
function huxzain_render_listings()      { include HUXZAIN_PLUGIN_DIR . 'admin/listing-moderation.php'; }
function huxzain_render_sellers()       { echo '<div class="wrap"><h1>Seller Management</h1><p>Coming soon: seller management panel.</p></div>'; }
function huxzain_render_disputes()      { include HUXZAIN_PLUGIN_DIR . 'admin/dispute-center.php'; }
function huxzain_render_payouts()       { include HUXZAIN_PLUGIN_DIR . 'admin/payout-management.php'; }
function huxzain_render_kyc()           { include HUXZAIN_PLUGIN_DIR . 'admin/seller-verification.php'; }
function huxzain_render_subscriptions() { echo '<div class="wrap"><h1>Subscription Management</h1><p>Coming soon: subscription management panel.</p></div>'; }
function huxzain_render_fraud()         { echo '<div class="wrap"><h1>Fraud Detection Logs</h1><p>Coming soon: fraud log viewer.</p></div>'; }
function huxzain_render_audit()         { echo '<div class="wrap"><h1>Admin Audit Log</h1><p>Coming soon: audit log viewer.</p></div>'; }
function huxzain_render_categories()    { echo '<div class="wrap"><h1>Category Manager</h1><p>Manage the 16 HUXZAIN marketplace categories.</p></div>'; }
