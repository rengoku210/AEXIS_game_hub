<?php
/**
 * HUXZAIN — Listing Pricing Meta
 * Adds full pricing controls to the WordPress listing editor.
 * Save as: wp-content/plugins/huxzain-marketplace/includes/class-pricing-meta.php
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class HUXZAIN_Pricing_Meta {

    public function __construct() {
        add_action( 'add_meta_boxes', [ $this, 'register_meta_boxes' ] );
        add_action( 'save_post_huxzain_listing', [ $this, 'save_meta' ], 10, 2 );
        add_action( 'enqueue_block_editor_assets', [ $this, 'enqueue_block_sidebar' ] );
        add_action( 'rest_api_init', [ $this, 'register_rest_fields' ] );
    }

    /** Classic editor fallback meta box */
    public function register_meta_boxes() {
        add_meta_box(
            'huxzain_pricing',
            '💰 Pricing & Visibility — HUXZAIN',
            [ $this, 'render_meta_box' ],
            'huxzain_listing',
            'side',
            'high'
        );
        add_meta_box(
            'huxzain_listing_settings',
            '⚙️ Listing Settings — HUXZAIN',
            [ $this, 'render_settings_box' ],
            'huxzain_listing',
            'normal',
            'high'
        );
    }

    /** Render pricing sidebar meta box */
    public function render_meta_box( WP_Post $post ) {
        wp_nonce_field( 'huxzain_pricing_nonce', 'huxzain_pricing_nonce_field' );

        $price_inr      = get_post_meta( $post->ID, '_huxzain_price_inr', true );
        $original_price = get_post_meta( $post->ID, '_huxzain_original_price', true );
        $pricing_type   = get_post_meta( $post->ID, '_huxzain_pricing_type', true ) ?: 'fixed';
        $is_negotiable  = get_post_meta( $post->ID, '_huxzain_is_negotiable', true );
        $is_featured    = get_post_meta( $post->ID, '_huxzain_is_featured', true );
        $sub_required   = get_post_meta( $post->ID, '_huxzain_subscription_required', true );
        $requires_kyc   = get_post_meta( $post->ID, '_huxzain_requires_seller_verification', true );
        $visibility     = get_post_meta( $post->ID, '_huxzain_visibility', true ) ?: 'public';
        $expiry_date    = get_post_meta( $post->ID, '_huxzain_expiry_date', true );
        $delivery_hours = get_post_meta( $post->ID, '_huxzain_delivery_time_hours', true );

        $style = 'style="background:#111;color:#f5f5f5;font-family:\'Helvetica Neue\',sans-serif;"';
        ?>
        <div <?php echo $style; ?>>
          <style>
            .hxz-field { margin-bottom:14px; }
            .hxz-label { display:block; font-size:10px; font-family:monospace; text-transform:uppercase; letter-spacing:0.15em; color:#666; margin-bottom:5px; }
            .hxz-input { width:100%; background:#1a1a1a; border:1px solid #2a2a2a; border-radius:6px; color:#f5f5f5; padding:7px 10px; font-size:13px; box-sizing:border-box; }
            .hxz-input:focus { outline:none; border-color:#dc2626; }
            .hxz-select { width:100%; background:#1a1a1a; border:1px solid #2a2a2a; border-radius:6px; color:#f5f5f5; padding:7px 10px; font-size:13px; }
            .hxz-toggle { display:flex; align-items:center; gap:8px; font-size:13px; color:#ccc; cursor:pointer; }
            .hxz-toggle input[type=checkbox] { width:16px; height:16px; accent-color:#dc2626; }
            .hxz-divider { border:none; border-top:1px solid #222; margin:14px 0; }
            .hxz-badge { display:inline-block; background:rgba(220,38,38,0.1); border:1px solid rgba(220,38,38,0.3); color:#dc2626; padding:2px 8px; border-radius:4px; font-size:10px; font-family:monospace; text-transform:uppercase; }
          </style>

          <div class="hxz-field">
            <label class="hxz-label" for="hxz_price">Price (INR) <span class="hxz-badge">Required</span></label>
            <input id="hxz_price" type="number" name="hxz_price_inr" step="0.01" min="0"
                   value="<?php echo esc_attr($price_inr); ?>" class="hxz-input" placeholder="0.00" />
          </div>

          <div class="hxz-field">
            <label class="hxz-label" for="hxz_original_price">Original Price (INR) — for discount display</label>
            <input id="hxz_original_price" type="number" name="hxz_original_price" step="0.01" min="0"
                   value="<?php echo esc_attr($original_price); ?>" class="hxz-input" placeholder="Leave blank if no discount" />
          </div>

          <div class="hxz-field">
            <label class="hxz-label">Pricing Type</label>
            <select name="hxz_pricing_type" class="hxz-select">
              <option value="fixed"       <?php selected($pricing_type,'fixed'); ?>>Fixed Price</option>
              <option value="negotiable"  <?php selected($pricing_type,'negotiable'); ?>>Negotiable</option>
              <option value="auction"     <?php selected($pricing_type,'auction'); ?>>Auction</option>
              <option value="subscription"<?php selected($pricing_type,'subscription'); ?>>Subscription</option>
            </select>
          </div>

          <div class="hxz-field">
            <label class="hxz-label" for="hxz_delivery">Delivery Time (hours)</label>
            <input id="hxz_delivery" type="number" name="hxz_delivery_time_hours" min="0"
                   value="<?php echo esc_attr($delivery_hours); ?>" class="hxz-input" placeholder="24" />
          </div>

          <hr class="hxz-divider" />

          <div class="hxz-field">
            <label class="hxz-label">Visibility</label>
            <select name="hxz_visibility" class="hxz-select">
              <option value="public"   <?php selected($visibility,'public'); ?>>Public</option>
              <option value="unlisted" <?php selected($visibility,'unlisted'); ?>>Unlisted (link only)</option>
              <option value="private"  <?php selected($visibility,'private'); ?>>Private (draft)</option>
            </select>
          </div>

          <div class="hxz-field">
            <label class="hxz-label" for="hxz_expiry">Listing Expiry Date</label>
            <input id="hxz_expiry" type="date" name="hxz_expiry_date"
                   value="<?php echo esc_attr($expiry_date); ?>" class="hxz-input" />
          </div>

          <hr class="hxz-divider" />

          <div class="hxz-field">
            <label class="hxz-toggle">
              <input type="checkbox" name="hxz_is_negotiable" value="1" <?php checked($is_negotiable,'1'); ?> />
              Price is negotiable
            </label>
          </div>

          <div class="hxz-field">
            <label class="hxz-toggle">
              <input type="checkbox" name="hxz_is_featured" value="1" <?php checked($is_featured,'1'); ?> />
              Featured listing
            </label>
          </div>

          <div class="hxz-field">
            <label class="hxz-toggle">
              <input type="checkbox" name="hxz_subscription_required" value="1" <?php checked($sub_required,'1'); ?> />
              Requires seller subscription
            </label>
          </div>

          <div class="hxz-field">
            <label class="hxz-toggle">
              <input type="checkbox" name="hxz_requires_seller_verification" value="1" <?php checked($requires_kyc,'1'); ?> />
              Requires seller KYC verification
            </label>
          </div>
        </div>
        <?php
    }

    /** Render listing settings meta box (tags, category-specific fields) */
    public function render_settings_box( WP_Post $post ) {
        $tags      = get_post_meta( $post->ID, '_huxzain_tags', true );
        $seller_id = get_post_meta( $post->ID, '_huxzain_seller_id', true );
        $notes     = get_post_meta( $post->ID, '_huxzain_admin_notes', true );
        ?>
        <table class="form-table" style="background:#111;">
          <tr>
            <th><label for="hxz_tags" style="color:#ccc;">Tags</label></th>
            <td>
              <input id="hxz_tags" type="text" name="hxz_tags"
                     value="<?php echo esc_attr( is_array($tags) ? implode(',', $tags) : $tags ); ?>"
                     class="large-text" placeholder="comma,separated,tags" style="background:#1a1a1a;color:#f5f5f5;border-color:#333;" />
              <p class="description" style="color:#666;">Comma-separated tags for search and filtering.</p>
            </td>
          </tr>
          <tr>
            <th><label for="hxz_seller_id" style="color:#ccc;">Seller UUID</label></th>
            <td>
              <input id="hxz_seller_id" type="text" name="hxz_seller_id"
                     value="<?php echo esc_attr($seller_id); ?>"
                     class="large-text" placeholder="Supabase user UUID" style="background:#1a1a1a;color:#f5f5f5;border-color:#333;font-family:monospace;" />
            </td>
          </tr>
          <tr>
            <th><label for="hxz_admin_notes" style="color:#ccc;">Admin Notes</label></th>
            <td>
              <textarea id="hxz_admin_notes" name="hxz_admin_notes" rows="3" class="large-text"
                        style="background:#1a1a1a;color:#f5f5f5;border-color:#333;"><?php echo esc_textarea($notes); ?></textarea>
              <p class="description" style="color:#666;">Internal notes (not shown to users).</p>
            </td>
          </tr>
        </table>
        <?php
    }

    /** Save all meta fields */
    public function save_meta( int $post_id, WP_Post $post ) {
        if ( ! isset( $_POST['huxzain_pricing_nonce_field'] ) ) return;
        if ( ! wp_verify_nonce( $_POST['huxzain_pricing_nonce_field'], 'huxzain_pricing_nonce' ) ) return;
        if ( defined('DOING_AUTOSAVE') && DOING_AUTOSAVE ) return;
        if ( ! current_user_can( 'edit_post', $post_id ) ) return;

        $fields = [
            'hxz_price_inr'                    => '_huxzain_price_inr',
            'hxz_original_price'               => '_huxzain_original_price',
            'hxz_pricing_type'                 => '_huxzain_pricing_type',
            'hxz_delivery_time_hours'          => '_huxzain_delivery_time_hours',
            'hxz_visibility'                   => '_huxzain_visibility',
            'hxz_expiry_date'                  => '_huxzain_expiry_date',
            'hxz_seller_id'                    => '_huxzain_seller_id',
            'hxz_admin_notes'                  => '_huxzain_admin_notes',
        ];

        foreach ( $fields as $post_key => $meta_key ) {
            if ( isset( $_POST[ $post_key ] ) ) {
                update_post_meta( $post_id, $meta_key, sanitize_text_field( $_POST[ $post_key ] ) );
            }
        }

        // Checkboxes
        $checkboxes = [
            'hxz_is_negotiable'                => '_huxzain_is_negotiable',
            'hxz_is_featured'                  => '_huxzain_is_featured',
            'hxz_subscription_required'        => '_huxzain_subscription_required',
            'hxz_requires_seller_verification' => '_huxzain_requires_seller_verification',
        ];

        foreach ( $checkboxes as $post_key => $meta_key ) {
            update_post_meta( $post_id, $meta_key, isset( $_POST[ $post_key ] ) ? '1' : '0' );
        }

        // Tags (comma-separated → array)
        if ( isset( $_POST['hxz_tags'] ) ) {
            $tags = array_filter( array_map( 'trim', explode( ',', sanitize_text_field( $_POST['hxz_tags'] ) ) ) );
            update_post_meta( $post_id, '_huxzain_tags', $tags );
        }
    }

    /** Register REST fields so Gutenberg sidebar can read/write */
    public function register_rest_fields() {
        $meta_map = [
            'price_inr'                    => '_huxzain_price_inr',
            'original_price'               => '_huxzain_original_price',
            'pricing_type'                 => '_huxzain_pricing_type',
            'delivery_time_hours'          => '_huxzain_delivery_time_hours',
            'visibility'                   => '_huxzain_visibility',
            'is_negotiable'                => '_huxzain_is_negotiable',
            'is_featured'                  => '_huxzain_is_featured',
            'subscription_required'        => '_huxzain_subscription_required',
            'requires_seller_verification' => '_huxzain_requires_seller_verification',
        ];

        foreach ( $meta_map as $field => $meta_key ) {
            register_rest_field( 'huxzain_listing', $field, [
                'get_callback'    => fn( $obj ) => get_post_meta( $obj['id'], $meta_key, true ),
                'update_callback' => fn( $val, $post ) => update_post_meta( $post->ID, $meta_key, $val ),
                'schema'          => [ 'type' => 'string' ],
            ] );
        }
    }

    /** Enqueue Gutenberg sidebar script */
    public function enqueue_block_sidebar() {
        global $pagenow, $post_type;
        if ( ! in_array( $pagenow, ['post.php','post-new.php'], true ) ) return;
        if ( 'huxzain_listing' !== $post_type ) return;

        wp_enqueue_script(
            'huxzain-gutenberg-sidebar',
            plugins_url( 'assets/js/gutenberg-sidebar.js', __FILE__ ),
            [ 'wp-plugins', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-data', 'wp-api-fetch' ],
            HUXZAIN_VERSION,
            true
        );
    }
}

new HUXZAIN_Pricing_Meta();
