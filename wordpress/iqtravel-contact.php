<?php
/**
 * IQ Travel — Contact Form REST API Handler
 * ==========================================
 * INSTALLATION:
 *   Option 1 (Recommended): Copy this entire file into your WordPress theme folder
 *              e.g. wp-content/themes/YOUR-THEME/iqtravel-contact.php
 *              Then add this line to your theme's functions.php:
 *              require_once get_template_directory() . '/iqtravel-contact.php';
 *
 *   Option 2: Create a simple plugin — paste into
 *              wp-content/plugins/iqtravel-contact/iqtravel-contact.php
 *              and add the plugin header below, then activate it in WP Admin.
 *
 * ENDPOINT:  POST  /wp-json/iqtravel/v1/contact
 * PAYLOAD:   { "name": "", "email": "", "subject": "", "message": "" }
 *
 * AFTER INSTALL:
 *   1. Update WP_ENDPOINT in js/app.js to your WordPress domain:
 *      const WP_ENDPOINT = 'https://your-domain.com/wp-json/iqtravel/v1/contact';
 *   2. Flush WP permalinks: WP Admin → Settings → Permalinks → Save
 *
 * VIEWING SUBMISSIONS:
 *   WP Admin → IQ Travel Contacts  (custom post type added below)
 */

/* Plugin header — only needed for Option 2 (standalone plugin)
Plugin Name: IQ Travel Contact Form
Description: Stores IQ Travel contact form submissions via REST API
Version: 1.0
Author: IQ Taxi Inc
*/

if ( ! defined( 'ABSPATH' ) ) exit; // Security: block direct access


/* ==========================================================
   1. REGISTER CUSTOM POST TYPE  "iqtravel_contact"
   Submissions appear in WP Admin → IQ Travel Contacts
   ========================================================== */
add_action( 'init', function () {
    register_post_type( 'iqtravel_contact', [
        'labels' => [
            'name'               => 'IQ Travel Contacts',
            'singular_name'      => 'Contact Submission',
            'menu_name'          => 'IQ Travel Contacts',
            'all_items'          => 'All Submissions',
            'view_item'          => 'View Submission',
            'search_items'       => 'Search Submissions',
            'not_found'          => 'No submissions found',
        ],
        'public'        => false,
        'show_ui'       => true,          // shows in WP Admin sidebar
        'show_in_menu'  => true,
        'menu_icon'     => 'dashicons-email-alt',
        'supports'      => [ 'title', 'editor', 'custom-fields' ],
        'capability_type' => 'post',
        'map_meta_cap'  => true,
    ] );
} );


/* ==========================================================
   2. REGISTER REST API ENDPOINT
   POST /wp-json/iqtravel/v1/contact
   ========================================================== */
add_action( 'rest_api_init', function () {
    register_rest_route( 'iqtravel/v1', '/contact', [
        'methods'             => 'POST',
        'callback'            => 'iqtravel_handle_contact',
        'permission_callback' => '__return_true', // public endpoint — rate limited below
        'args'                => [
            'name'    => [ 'required' => true,  'sanitize_callback' => 'sanitize_text_field' ],
            'email'   => [ 'required' => true,  'sanitize_callback' => 'sanitize_email'      ],
            'subject' => [ 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
            'message' => [ 'required' => true,  'sanitize_callback' => 'sanitize_textarea_field' ],
        ],
    ] );
} );


/* ==========================================================
   3. HANDLE SUBMISSION
   ========================================================== */
function iqtravel_handle_contact( WP_REST_Request $request ) {

    $name    = $request->get_param( 'name' );
    $email   = $request->get_param( 'email' );
    $subject = $request->get_param( 'subject' ) ?: 'Γενική Απορία';
    $message = $request->get_param( 'message' );
    $ip      = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

    // ── Validate email ──
    if ( ! is_email( $email ) ) {
        return new WP_Error( 'invalid_email', 'Μη έγκυρη διεύθυνση email.', [ 'status' => 422 ] );
    }

    // ── Basic rate limiting: max 3 submissions per IP per hour ──
    $transient_key = 'iqtravel_contact_' . md5( $ip );
    $count = (int) get_transient( $transient_key );
    if ( $count >= 3 ) {
        return new WP_Error( 'rate_limit', 'Πολλές υποβολές. Δοκιμάστε αργότερα.', [ 'status' => 429 ] );
    }
    set_transient( $transient_key, $count + 1, HOUR_IN_SECONDS );

    // ── Save to WordPress database as custom post ──
    $post_id = wp_insert_post( [
        'post_type'   => 'iqtravel_contact',
        'post_title'  => sprintf( '[%s] %s — %s', date('d/m/Y H:i'), $subject, $name ),
        'post_content'=> wp_kses_post( $message ),
        'post_status' => 'publish',
        'meta_input'  => [
            '_contact_name'    => $name,
            '_contact_email'   => $email,
            '_contact_subject' => $subject,
            '_contact_ip'      => $ip,
            '_contact_date'    => current_time( 'mysql' ),
        ],
    ] );

    if ( is_wp_error( $post_id ) ) {
        return new WP_Error( 'db_error', 'Σφάλμα αποθήκευσης. Παρακαλώ δοκιμάστε ξανά.', [ 'status' => 500 ] );
    }

    // ── Send email notification to site admin ──
    $admin_email = get_option( 'admin_email' );
    $mail_subject = '[IQ Travel] Νέο μήνυμα επικοινωνίας: ' . $subject;
    $mail_body  = "Νέο μήνυμα από τη φόρμα επικοινωνίας IQ Travel:\n\n";
    $mail_body .= "Όνομα:   {$name}\n";
    $mail_body .= "Email:   {$email}\n";
    $mail_body .= "Θέμα:    {$subject}\n";
    $mail_body .= "IP:      {$ip}\n";
    $mail_body .= "Ημ/νία:  " . current_time( 'mysql' ) . "\n\n";
    $mail_body .= "Μήνυμα:\n{$message}\n\n";
    $mail_body .= "---\nΔείτε στο WordPress Admin: " . admin_url( 'edit.php?post_type=iqtravel_contact' );

    wp_mail( $admin_email, $mail_subject, $mail_body, [
        'Content-Type: text/plain; charset=UTF-8',
        'From: IQ Travel <noreply@' . parse_url( home_url(), PHP_URL_HOST ) . '>',
        'Reply-To: ' . $name . ' <' . $email . '>',
    ] );

    // ── Return success ──
    return rest_ensure_response( [
        'success' => true,
        'message' => 'Το μήνυμά σας εστάλη επιτυχώς!',
        'id'      => $post_id,
    ] );
}


/* ==========================================================
   4. CORS HEADERS
   Allows your static IQ Travel page (different domain) to
   POST to this WordPress REST endpoint.
   Replace 'https://iqtravel.iqtaxi.com' with your actual
   landing page domain.
   ========================================================== */
add_action( 'rest_api_init', function () {
    remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );

    add_filter( 'rest_pre_serve_request', function ( $value ) {
        // Allowed origins — add your landing page domain here
        $allowed_origins = [
            'https://iqtravel.iqtaxi.com',      // production landing page
            'https://aggelos1991.github.io',     // GitHub Pages preview
            'http://localhost',                   // local dev
            'http://127.0.0.1',                  // local dev
        ];

        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

        if ( in_array( rtrim( $origin, '/' ), $allowed_origins, true ) ) {
            header( 'Access-Control-Allow-Origin: ' . $origin );
        }

        header( 'Access-Control-Allow-Methods: POST, OPTIONS' );
        header( 'Access-Control-Allow-Headers: Content-Type, X-WP-Nonce' );
        header( 'Access-Control-Max-Age: 600' );

        return $value;
    } );
}, 15 );


/* ==========================================================
   5. ADMIN COLUMN DISPLAY
   Shows Name, Email, Subject columns in the WP Admin list
   ========================================================== */
add_filter( 'manage_iqtravel_contact_posts_columns', function ( $cols ) {
    return [
        'cb'      => $cols['cb'],
        'title'   => 'Θέμα / Ημ/νία',
        'name'    => 'Όνομα',
        'email'   => 'Email',
        'subject' => 'Κατηγορία',
        'date'    => 'Ημερομηνία',
    ];
} );

add_action( 'manage_iqtravel_contact_posts_custom_column', function ( $col, $post_id ) {
    switch ( $col ) {
        case 'name':    echo esc_html( get_post_meta( $post_id, '_contact_name',    true ) ); break;
        case 'email':   echo '<a href="mailto:' . esc_attr( get_post_meta( $post_id, '_contact_email', true ) ) . '">'
                           . esc_html( get_post_meta( $post_id, '_contact_email', true ) ) . '</a>'; break;
        case 'subject': echo esc_html( get_post_meta( $post_id, '_contact_subject', true ) ); break;
    }
}, 10, 2 );
