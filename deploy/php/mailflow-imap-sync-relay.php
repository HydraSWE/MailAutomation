<?php
declare(strict_types=1);

require __DIR__ . '/../mailflow-config.php';
header('Content-Type: application/json; charset=utf-8');

const MAX_REQUEST_BYTES = 65536;
const MAX_SYNC_LIMIT = 50;

register_shutdown_function(function (): void {
    $error = error_get_last();
    if ($error !== null && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        http_response_code(500);
        echo json_encode([
            'ok' => false,
            'stage' => 'php',
            'message' => 'IMAP relay PHP fatal error: ' . substr((string)$error['message'], 0, 240),
            'messages' => [],
        ], JSON_UNESCAPED_SLASHES);
    }
});

function respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function clean_text(string $value, int $limit): string
{
    return substr(str_replace(["\r", "\n"], '', trim($value)), 0, $limit);
}

function relay_error(string $stage, string $message): never
{
    respond(400, [
        'ok' => false,
        'stage' => $stage,
        'message' => $message,
        'messages' => [],
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['detail' => 'Method not allowed.']);
}
if (!function_exists('imap_open')) {
    respond(503, ['detail' => 'PHP IMAP extension is not available on this host.']);
}

$rawBody = file_get_contents('php://input') ?: '';
if ($rawBody === '' || strlen($rawBody) > MAX_REQUEST_BYTES) {
    respond(413, ['detail' => 'IMAP relay payload is empty or too large.']);
}

$timestamp = (string)($_SERVER['HTTP_X_MAIL_FLOW_TIMESTAMP'] ?? '');
$signature = (string)($_SERVER['HTTP_X_MAIL_FLOW_SIGNATURE'] ?? '');
$secret = defined('MAILFLOW_IMAP_SYNC_RELAY_SECRET')
    ? MAILFLOW_IMAP_SYNC_RELAY_SECRET
    : (defined('MAILFLOW_SMTP_TEST_RELAY_SECRET') ? MAILFLOW_SMTP_TEST_RELAY_SECRET : MAILFLOW_RELAY_SECRET);
if ($timestamp === '' || !ctype_digit($timestamp) || abs(time() - (int)$timestamp) > MAILFLOW_MAX_CLOCK_SKEW_SECONDS) {
    respond(401, ['detail' => 'Expired request.']);
}
$expected = hash_hmac('sha256', $rawBody, $secret);
if ($signature === '' || !hash_equals($expected, $signature)) {
    respond(401, ['detail' => 'Invalid signature.']);
}

$payload = json_decode($rawBody, true);
if (!is_array($payload) || (string)($payload['timestamp'] ?? '') !== $timestamp) {
    respond(400, ['detail' => 'Invalid JSON payload.']);
}
$operation = (string)($payload['operation'] ?? '');
if (!in_array($operation, ['connection_test', 'sync'], true)) {
    respond(400, ['detail' => 'Invalid relay operation.']);
}
$imap = $payload['imap'] ?? null;
if (!is_array($imap)) {
    respond(400, ['detail' => 'IMAP configuration is required.']);
}

$host = strtolower(trim((string)($imap['host'] ?? '')));
$port = (int)($imap['port'] ?? 0);
$encryption = strtolower(trim((string)($imap['encryption'] ?? 'ssl')));
$username = clean_text((string)($imap['username'] ?? ''), 255);
$password = (string)($imap['password'] ?? '');
$mailboxName = clean_text((string)($imap['mailbox'] ?? 'INBOX'), 80) ?: 'INBOX';
$limit = min(max((int)($payload['limit'] ?? 20), 1), MAX_SYNC_LIMIT);

if ($host === '' || strlen($host) > 253 || !preg_match('/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i', $host)) {
    respond(400, ['detail' => 'Invalid IMAP hostname.']);
}
if (!in_array($port, [143, 993], true) || !in_array($encryption, ['none', 'tls', 'ssl'], true)) {
    respond(400, ['detail' => 'Unsupported IMAP port or encryption mode.']);
}
if ($username === '' || $password === '') {
    respond(400, ['detail' => 'IMAP username and password are required.']);
}

$flags = '/imap';
if ($encryption === 'ssl' || $port === 993) {
    $flags .= '/ssl/novalidate-cert';
} elseif ($encryption === 'tls') {
    $flags .= '/tls/novalidate-cert';
} else {
    $flags .= '/notls';
}
$mailboxPath = sprintf('{%s:%d%s}%s', $host, $port, $flags, $mailboxName);
$connection = @imap_open($mailboxPath, $username, $password, 0, 1);
if ($connection === false) {
    $error = imap_last_error() ?: 'IMAP authentication failed.';
    relay_error(stripos($error, 'AUTHENTICATION') !== false ? 'auth' : 'connect', 'IMAP connection failed. ' . $error);
}

try {
    if ($operation === 'connection_test') {
        imap_close($connection);
        $connection = false;
        respond(200, [
            'ok' => true,
            'stage' => 'complete',
            'message' => 'IMAP connection successful through the relay.',
            'messages' => [],
        ]);
    }

    $ids = imap_search($connection, 'ALL') ?: [];
    sort($ids, SORT_NUMERIC);
    $ids = array_slice($ids, -$limit);
    $messages = [];
    foreach ($ids as $messageNumber) {
        $header = imap_fetchheader($connection, $messageNumber, FT_PREFETCHTEXT);
        $body = imap_body($connection, $messageNumber, FT_PEEK);
        if ($header === false || $body === false) {
            continue;
        }
        $raw = $header . "\r\n" . $body;
        $messages[] = [
            'message_number' => (int)$messageNumber,
            'raw' => base64_encode($raw),
        ];
        imap_setflag_full($connection, (string)$messageNumber, '\\Seen');
    }
    imap_close($connection);
    $connection = false;
    respond(200, [
        'ok' => true,
        'stage' => 'complete',
        'message' => 'IMAP sync completed through the relay.',
        'messages' => $messages,
    ]);
} finally {
    if ($connection !== false && is_resource($connection)) {
        @imap_close($connection);
    }
}
