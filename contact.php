<?php
/**
 * IQ Travel — Simple Contact Form Handler
 * Receives POST data and sends an email notification.
 */

// ── CORS: allow same-origin requests ──
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// ── Rate limiting (file-based, simple) ──
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rate_file = sys_get_temp_dir() . '/iqtravel_rate_' . md5($ip);
$now = time();
if (file_exists($rate_file)) {
    $data = json_decode(file_get_contents($rate_file), true);
    // Reset if older than 1 hour
    if ($now - $data['first'] > 3600) {
        $data = ['count' => 0, 'first' => $now];
    }
    if ($data['count'] >= 5) {
        http_response_code(429);
        echo json_encode(['success' => false, 'message' => 'Πολλές υποβολές. Δοκιμάστε αργότερα.']);
        exit;
    }
    $data['count']++;
} else {
    $data = ['count' => 1, 'first' => $now];
}
file_put_contents($rate_file, json_encode($data));

// ── Parse input ──
$input = json_decode(file_get_contents('php://input'), true);

$name    = trim($input['name'] ?? '');
$email   = trim($input['email'] ?? '');
$subject = trim($input['subject'] ?? 'Γενική Απορία');
$message = trim($input['message'] ?? '');

// ── Validate ──
if ($name === '' || $email === '' || $message === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Συμπληρώστε όλα τα υποχρεωτικά πεδία.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Μη έγκυρη διεύθυνση email.']);
    exit;
}

// ── Send email ──
$to = 'info@iqtaxi.com'; // ← Change this to your email
$mail_subject = "[IQ Travel] Νέο μήνυμα: $subject";
$mail_body  = "Νέο μήνυμα από τη φόρμα επικοινωνίας IQ Travel:\n\n";
$mail_body .= "Όνομα:   $name\n";
$mail_body .= "Email:   $email\n";
$mail_body .= "Θέμα:    $subject\n";
$mail_body .= "IP:      $ip\n";
$mail_body .= "Ημ/νία:  " . date('d/m/Y H:i') . "\n\n";
$mail_body .= "Μήνυμα:\n$message\n";

$headers  = "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "From: IQ Travel <noreply@iqtaxi.com>\r\n";
$headers .= "Reply-To: $name <$email>\r\n";

$sent = mail($to, $mail_subject, $mail_body, $headers);

if (!$sent) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Σφάλμα αποστολής. Δοκιμάστε ξανά.']);
    exit;
}

// ── Success ──
echo json_encode(['success' => true, 'message' => 'Το μήνυμά σας εστάλη επιτυχώς!']);
