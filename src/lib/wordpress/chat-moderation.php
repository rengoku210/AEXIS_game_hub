<?php
/**
 * HUXZAIN Chat Moderation — WordPress admin panel
 * Path: /wp-admin/admin.php?page=huxzain-chat-mod
 *
 * Included from huxzain-marketplace.php as huxzain_render_chat_moderation()
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Menu registration handled by huxzain-marketplace.php
// This file is included and renders via huxzain_render_chat_moderation()

/**
 * Enqueue the React-based moderation panel inside WP admin.
 * We embed a minimal iframe pointing to the React admin page (same Supabase session).
 * Alternatively, the JS queries Supabase directly via the service role key passed as a nonce.
 */
function huxzain_enqueue_moderation_assets( $hook ) {
    if ( strpos( $hook, 'huxzain-chat-mod' ) === false ) return;
    // Pass Supabase credentials to JS (NEVER expose service role key here)
    wp_localize_script( 'jquery', 'HUXZAIN_MOD', [
        'supabaseUrl'  => defined( 'HUXZAIN_SUPABASE_URL' )      ? HUXZAIN_SUPABASE_URL      : '',
        'supabaseAnon' => defined( 'HUXZAIN_SUPABASE_ANON_KEY' ) ? HUXZAIN_SUPABASE_ANON_KEY : '',
        'nonce'        => wp_create_nonce( 'huxzain_moderation' ),
        'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
    ] );
}
add_action( 'admin_enqueue_scripts', 'huxzain_enqueue_moderation_assets' );

/**
 * AJAX: Get conversation reports (proxies to Supabase via PHP with service role)
 */
function huxzain_ajax_get_reports() {
    check_ajax_referer( 'huxzain_moderation', 'nonce' );
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( 'Unauthorized', 403 );
    }

    $supabase_url = defined( 'HUXZAIN_SUPABASE_URL' )       ? HUXZAIN_SUPABASE_URL       : '';
    $service_key  = defined( 'HUXZAIN_SUPABASE_SERVICE_KEY' ) ? HUXZAIN_SUPABASE_SERVICE_KEY : '';

    if ( ! $supabase_url || ! $service_key ) {
        wp_send_json_error( 'Supabase not configured in wp-config.php' );
    }

    $status = sanitize_text_field( $_GET['status'] ?? 'pending' );
    $limit  = min( (int) ( $_GET['limit'] ?? 50 ), 200 );

    $endpoint = $supabase_url . '/rest/v1/conversation_reports'
        . '?select=id,conversation_id,reporter_id,report_reason,report_detail,status,created_at'
        . '&order=created_at.desc'
        . '&limit=' . $limit;

    if ( $status !== 'all' ) {
        $endpoint .= '&status=eq.' . rawurlencode( $status );
    }

    $response = wp_remote_get( $endpoint, [
        'headers' => [
            'apikey'        => $service_key,
            'Authorization' => 'Bearer ' . $service_key,
            'Content-Type'  => 'application/json',
        ],
        'timeout' => 15,
    ] );

    if ( is_wp_error( $response ) ) {
        wp_send_json_error( $response->get_error_message() );
    }

    $body = json_decode( wp_remote_retrieve_body( $response ), true );
    wp_send_json_success( $body );
}
add_action( 'wp_ajax_huxzain_get_reports', 'huxzain_ajax_get_reports' );

/**
 * AJAX: Update report status
 */
function huxzain_ajax_update_report() {
    check_ajax_referer( 'huxzain_moderation', 'nonce' );
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( 'Unauthorized', 403 );
    }

    $report_id = sanitize_text_field( $_POST['report_id'] ?? '' );
    $new_status = sanitize_text_field( $_POST['status'] ?? '' );
    $allowed = [ 'pending', 'under_review', 'resolved', 'dismissed' ];

    if ( ! $report_id || ! in_array( $new_status, $allowed, true ) ) {
        wp_send_json_error( 'Invalid parameters' );
    }

    $supabase_url = defined( 'HUXZAIN_SUPABASE_URL' )       ? HUXZAIN_SUPABASE_URL       : '';
    $service_key  = defined( 'HUXZAIN_SUPABASE_SERVICE_KEY' ) ? HUXZAIN_SUPABASE_SERVICE_KEY : '';

    $response = wp_remote_request(
        $supabase_url . '/rest/v1/conversation_reports?id=eq.' . rawurlencode( $report_id ),
        [
            'method'  => 'PATCH',
            'headers' => [
                'apikey'        => $service_key,
                'Authorization' => 'Bearer ' . $service_key,
                'Content-Type'  => 'application/json',
                'Prefer'        => 'return=minimal',
            ],
            'body'    => json_encode( [
                'status'      => $new_status,
                'resolved_at' => gmdate( 'c' ),
            ] ),
            'timeout' => 15,
        ]
    );

    if ( is_wp_error( $response ) ) {
        wp_send_json_error( $response->get_error_message() );
    }

    wp_send_json_success( [ 'updated' => true ] );
}
add_action( 'wp_ajax_huxzain_update_report', 'huxzain_ajax_update_report' );

/**
 * AJAX: Apply account lock
 */
function huxzain_ajax_apply_lock() {
    check_ajax_referer( 'huxzain_moderation', 'nonce' );
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( 'Unauthorized', 403 );
    }

    $user_id   = sanitize_text_field( $_POST['user_id'] ?? '' );
    $reason    = sanitize_textarea_field( $_POST['reason'] ?? '' );
    $lock_type = sanitize_text_field( $_POST['lock_type'] ?? 'chat' );
    $until     = sanitize_text_field( $_POST['locked_until'] ?? '' );

    if ( ! $user_id || ! $reason ) {
        wp_send_json_error( 'user_id and reason required' );
    }

    $supabase_url = defined( 'HUXZAIN_SUPABASE_URL' )       ? HUXZAIN_SUPABASE_URL       : '';
    $service_key  = defined( 'HUXZAIN_SUPABASE_SERVICE_KEY' ) ? HUXZAIN_SUPABASE_SERVICE_KEY : '';

    // Use upsert (on conflict user_id)
    $payload = [
        'user_id'   => $user_id,
        'locked_by' => 'huxzain-wp-admin',
        'reason'    => $reason,
        'lock_type' => $lock_type,
    ];
    if ( $until ) $payload['locked_until'] = $until;

    $response = wp_remote_post(
        $supabase_url . '/rest/v1/account_locks',
        [
            'headers' => [
                'apikey'        => $service_key,
                'Authorization' => 'Bearer ' . $service_key,
                'Content-Type'  => 'application/json',
                'Prefer'        => 'resolution=merge-duplicates,return=minimal',
            ],
            'body'    => json_encode( $payload ),
            'timeout' => 15,
        ]
    );

    if ( is_wp_error( $response ) ) {
        wp_send_json_error( $response->get_error_message() );
    }

    wp_send_json_success( [ 'locked' => true ] );
}
add_action( 'wp_ajax_huxzain_apply_lock', 'huxzain_ajax_apply_lock' );

/**
 * Main render function — outputs the admin UI
 */
function huxzain_render_chat_moderation() {
    ?>
    <div class="wrap" id="huxzain-moderation-root" style="background:#080808;color:#f5f5f5;font-family:'Helvetica Neue',sans-serif;min-height:100vh;">
      <style>
        #huxzain-moderation-root * { box-sizing: border-box; }
        #huxzain-moderation-root h1 { color:#f5f5f5; font-size:26px; font-weight:700; margin-bottom:8px; }
        .hxz-badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:10px; font-family:monospace; text-transform:uppercase; letter-spacing:0.1em; border:1px solid; }
        .badge-pending { background:rgba(234,179,8,0.1); color:#facc15; border-color:rgba(234,179,8,0.3); }
        .badge-under_review { background:rgba(59,130,246,0.1); color:#60a5fa; border-color:rgba(59,130,246,0.3); }
        .badge-resolved { background:rgba(34,197,94,0.1); color:#4ade80; border-color:rgba(34,197,94,0.3); }
        .badge-dismissed { background:rgba(255,255,255,0.05); color:#888; border-color:#333; }
        .hxz-table { width:100%; border-collapse:collapse; font-size:13px; }
        .hxz-table th { background:#111; color:#666; font-family:monospace; font-size:10px; text-transform:uppercase; letter-spacing:0.15em; text-align:left; padding:10px 14px; border-bottom:1px solid #222; }
        .hxz-table td { padding:12px 14px; border-bottom:1px solid #1a1a1a; color:#ccc; vertical-align:top; }
        .hxz-table tr:hover td { background:#0f0f0f; }
        .hxz-btn { padding:6px 14px; border-radius:6px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.1em; cursor:pointer; border:1px solid; transition:all 0.2s; }
        .btn-crimson { background:#dc2626; border-color:#dc2626; color:#fff; }
        .btn-crimson:hover { background:#ef4444; }
        .btn-outline { background:transparent; border-color:#333; color:#999; }
        .btn-outline:hover { background:#111; color:#fff; }
        .btn-blue { background:rgba(59,130,246,0.15); border-color:rgba(59,130,246,0.3); color:#60a5fa; }
        .btn-green { background:rgba(34,197,94,0.15); border-color:rgba(34,197,94,0.3); color:#4ade80; }
        .hxz-card { background:#0d0d0d; border:1px solid #1f1f1f; border-radius:12px; padding:20px; margin-bottom:20px; }
        .hxz-input { background:#111; border:1px solid #2a2a2a; border-radius:8px; color:#f5f5f5; padding:8px 12px; font-size:13px; width:100%; }
        .hxz-input:focus { outline:none; border-color:#dc2626; }
        .hxz-label { font-family:monospace; font-size:10px; text-transform:uppercase; letter-spacing:0.15em; color:#666; display:block; margin-bottom:6px; }
        .hxz-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        @media(max-width:600px){ .hxz-grid { grid-template-columns:1fr; } }
        #hxz-reports-list { margin-top:16px; }
        .hxz-filters { display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
        .hxz-crimson { color:#dc2626; }
        .hxz-mono { font-family:monospace; font-size:11px; }
      </style>

      <h1><span style="color:#dc2626;">●</span> HUXZAIN — Chat Moderation</h1>
      <p style="color:#666;margin-top:0;font-size:13px;">Review reported conversations, inspect messages, and apply account/chat locks.</p>

      <!-- Reports -->
      <div class="hxz-card">
        <h2 style="font-size:16px;font-weight:600;margin:0 0 16px;color:#f5f5f5;">📋 Conversation Reports</h2>
        <div class="hxz-filters">
          <select id="hxz-status-filter" class="hxz-input" style="width:auto;">
            <option value="all">All Statuses</option>
            <option value="pending" selected>Pending</option>
            <option value="under_review">Under Review</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <input type="text" id="hxz-search" class="hxz-input" style="width:240px;" placeholder="Search reason or ID…" />
          <button class="hxz-btn btn-crimson" onclick="hxzLoadReports()">🔄 Load Reports</button>
        </div>
        <div id="hxz-reports-list" style="color:#666;">Click "Load Reports" to fetch data.</div>
      </div>

      <!-- Chat Viewer -->
      <div class="hxz-card">
        <h2 style="font-size:16px;font-weight:600;margin:0 0 16px;color:#f5f5f5;">💬 Chat Viewer</h2>
        <p style="color:#666;font-size:13px;">Enter a conversation UUID to inspect all messages (admin only).</p>
        <div style="display:flex;gap:10px;margin-bottom:16px;">
          <input type="text" id="hxz-conv-id" class="hxz-input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style="font-family:monospace;" />
          <button class="hxz-btn btn-crimson" onclick="hxzLoadChat()">Load Chat</button>
        </div>
        <div id="hxz-chat-output" style="color:#666;">Enter a conversation ID above.</div>
      </div>

      <!-- Account Lock -->
      <div class="hxz-card">
        <h2 style="font-size:16px;font-weight:600;margin:0 0 16px;color:#f5f5f5;">🔒 Apply Account Lock</h2>
        <div class="hxz-grid">
          <div>
            <label class="hxz-label">User UUID</label>
            <input type="text" id="lock-user-id" class="hxz-input" placeholder="xxxxxxxx-xxxx-…" style="font-family:monospace;" />
          </div>
          <div>
            <label class="hxz-label">Lock Type</label>
            <select id="lock-type" class="hxz-input">
              <option value="chat">Chat Only</option>
              <option value="listings">Listings Only</option>
              <option value="account">Full Account</option>
            </select>
          </div>
          <div>
            <label class="hxz-label">Reason</label>
            <input type="text" id="lock-reason" class="hxz-input" placeholder="Suspected scam, investigation…" />
          </div>
          <div>
            <label class="hxz-label">Locked Until (optional)</label>
            <input type="datetime-local" id="lock-until" class="hxz-input" />
          </div>
        </div>
        <button class="hxz-btn btn-crimson" style="margin-top:14px;" onclick="hxzApplyLock()">Apply Lock</button>
        <div id="lock-result" style="margin-top:10px;font-size:13px;"></div>
      </div>

      <script>
      const HXZ = typeof HUXZAIN_MOD !== 'undefined' ? HUXZAIN_MOD : {};

      async function hxzAjax(action, data) {
        const form = new FormData();
        form.append('action', action);
        form.append('nonce', HXZ.nonce || '');
        for (const [k, v] of Object.entries(data || {})) form.append(k, v);
        const res = await fetch(HXZ.ajaxUrl, { method: 'POST', body: form });
        return res.json();
      }

      async function hxzLoadReports() {
        const status = document.getElementById('hxz-status-filter').value;
        const el = document.getElementById('hxz-reports-list');
        el.innerHTML = '<p style="color:#666;">Loading…</p>';
        const res = await hxzAjax('huxzain_get_reports', { status });
        if (!res.success) { el.innerHTML = '<p style="color:#e53e3e;">Error: ' + (res.data || 'Unknown') + '</p>'; return; }
        const rows = res.data || [];
        if (!rows.length) { el.innerHTML = '<p style="color:#555;">No reports found.</p>'; return; }
        const badgeClass = { pending:'badge-pending', under_review:'badge-under_review', resolved:'badge-resolved', dismissed:'badge-dismissed' };
        el.innerHTML = '<table class="hxz-table"><thead><tr><th>Status</th><th>Reason</th><th>Conversation ID</th><th>Created</th><th>Actions</th></tr></thead><tbody>'
          + rows.map(r => `<tr>
            <td><span class="hxz-badge ${badgeClass[r.status]||''}">${r.status.replace('_',' ')}</span></td>
            <td class="hxz-crimson hxz-mono">${r.report_reason}</td>
            <td class="hxz-mono" style="font-size:10px;">${r.conversation_id}</td>
            <td style="font-size:11px;color:#555;">${new Date(r.created_at).toLocaleString()}</td>
            <td style="white-space:nowrap;">
              <button class="hxz-btn btn-blue" style="margin-right:4px;" onclick="hxzUpdateReport('${r.id}','under_review')">Review</button>
              <button class="hxz-btn btn-green" style="margin-right:4px;" onclick="hxzUpdateReport('${r.id}','resolved')">Resolve</button>
              <button class="hxz-btn btn-outline" onclick="hxzUpdateReport('${r.id}','dismissed')">Dismiss</button>
            </td>
          </tr>`).join('')
          + '</tbody></table>';
      }

      async function hxzUpdateReport(reportId, status) {
        const res = await hxzAjax('huxzain_update_report', { report_id: reportId, status });
        if (res.success) { alert('Report updated to: ' + status); hxzLoadReports(); }
        else alert('Error: ' + (res.data || 'Unknown'));
      }

      async function hxzLoadChat() {
        const convId = document.getElementById('hxz-conv-id').value.trim();
        const el = document.getElementById('hxz-chat-output');
        if (!convId) { el.innerHTML = '<p style="color:#e53e3e;">Enter a conversation ID.</p>'; return; }
        el.innerHTML = '<p style="color:#666;">Loading messages…</p>';

        // Query Supabase REST directly with anon key (RLS: admin only policy applies)
        // NOTE: For chat viewer in WP we display a read-only view
        const url = HXZ.supabaseUrl + '/rest/v1/messages?conversation_id=eq.' + encodeURIComponent(convId)
          + '&select=id,sender_id,body,created_at&order=created_at.asc&limit=200';
        const res = await fetch(url, {
          headers: { 'apikey': HXZ.supabaseAnon, 'Authorization': 'Bearer ' + HXZ.supabaseAnon }
        });
        const msgs = await res.json();
        if (!Array.isArray(msgs) || !msgs.length) {
          el.innerHTML = '<p style="color:#555;">No messages found (or access denied for anon key).<br>Use the React admin panel for full access.</p>';
          return;
        }
        el.innerHTML = '<div style="background:#111;border:1px solid #1f1f1f;border-radius:10px;padding:14px;max-height:400px;overflow-y:auto;">'
          + msgs.map(m => `<div style="margin-bottom:12px;">
            <span class="hxz-mono" style="color:#666;">[${new Date(m.created_at).toLocaleTimeString()}]</span>
            <span style="color:#dc2626;font-family:monospace;font-size:11px;margin-left:6px;">${m.sender_id.slice(0,8)}…</span>
            <p style="margin:4px 0 0;color:#ccc;font-size:13px;">${m.body.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
          </div>`).join('')
          + '</div>';
      }

      async function hxzApplyLock() {
        const userId = document.getElementById('lock-user-id').value.trim();
        const reason = document.getElementById('lock-reason').value.trim();
        const lockType = document.getElementById('lock-type').value;
        const until = document.getElementById('lock-until').value;
        const el = document.getElementById('lock-result');

        if (!userId || !reason) { el.innerHTML = '<span style="color:#e53e3e;">User ID and reason are required.</span>'; return; }
        const res = await hxzAjax('huxzain_apply_lock', { user_id: userId, reason, lock_type: lockType, locked_until: until });
        if (res.success) {
          el.innerHTML = '<span style="color:#4ade80;">✓ Lock applied successfully.</span>';
          document.getElementById('lock-user-id').value = '';
          document.getElementById('lock-reason').value = '';
          document.getElementById('lock-until').value = '';
        } else {
          el.innerHTML = '<span style="color:#e53e3e;">Error: ' + (res.data || 'Unknown') + '</span>';
        }
      }
      </script>
    </div>
    <?php
}
