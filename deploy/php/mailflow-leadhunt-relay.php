<?php
declare(strict_types=1);

/**
 * Mail Flow - Lead Hunter Central Management & Authentication Relay
 * Features:
 *  - 2-Device Policy per account with Email OTP Device Verification
 *  - Cryptographic HMAC-SHA256 JWT Token Generation & Verification
 *  - Lead Push & Recipient List Central Management
 *  - Admin License Provisioning & Quota Controller
 */

// 1. CORS & Security Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Mail-Flow-Secret");
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (file_exists(__DIR__ . '/../mailflow-config.php')) {
    require_once __DIR__ . '/../mailflow-config.php';
} elseif (file_exists(__DIR__ . '/mailflow-config.php')) {
    require_once __DIR__ . '/mailflow-config.php';
}

error_reporting(0);
ini_set('display_errors', '0');

function sendJson(array $data, int $statusCode = 200): void {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// Global exception/fatal error handler (Sanitized - no stack traces/SQL exposed)
set_exception_handler(function (\Throwable $e) {
    error_log("MailFlow Relay Exception: " . $e->getMessage() . " in " . $e->getFile() . " on line " . $e->getLine());
    sendJson([
        'ok' => false,
        'status' => 'error',
        'error' => 'A server error occurred. Please try again later.'
    ], 500);
});

register_shutdown_function(function () {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        error_log("MailFlow Relay Fatal: " . $error['message'] . " in " . $error['file'] . " on line " . $error['line']);
        sendJson([
            'ok' => false,
            'status' => 'fatal_error',
            'error' => 'An internal service error occurred. Please contact support.'
        ], 500);
    }
});

// Configuration constants
$dbHost = defined('MAILFLOW_LEADHUNT_DB_HOST') ? MAILFLOW_LEADHUNT_DB_HOST : (defined('MAILFLOW_DB_HOST') ? MAILFLOW_DB_HOST : 'localhost');
$dbPort = defined('MAILFLOW_LEADHUNT_DB_PORT') ? (int)MAILFLOW_LEADHUNT_DB_PORT : (defined('MAILFLOW_DB_PORT') ? (int)MAILFLOW_DB_PORT : 3306);
$dbName = defined('MAILFLOW_LEADHUNT_DB_NAME') ? MAILFLOW_LEADHUNT_DB_NAME : (defined('MAILFLOW_DB_NAME') ? MAILFLOW_DB_NAME : 'annomous_mailflow_lead_hunter');
$dbUser = defined('MAILFLOW_LEADHUNT_DB_USER') ? MAILFLOW_LEADHUNT_DB_USER : (defined('MAILFLOW_DB_USER') ? MAILFLOW_DB_USER : 'annomous_rayhan');
$dbPass = defined('MAILFLOW_LEADHUNT_DB_PASS') ? MAILFLOW_LEADHUNT_DB_PASS : (defined('MAILFLOW_DB_PASS') ? MAILFLOW_DB_PASS : '');
$relaySecret = defined('MAILFLOW_LEADHUNT_RELAY_SECRET') 
    ? MAILFLOW_LEADHUNT_RELAY_SECRET 
    : (defined('MAILFLOW_RELAY_SECRET') ? MAILFLOW_RELAY_SECRET : (defined('MAILFLOW_OTP_RELAY_SECRET') ? MAILFLOW_OTP_RELAY_SECRET : ''));
if (!is_string($relaySecret) || strlen($relaySecret) < 32) {
    sendJson([
        'ok' => false,
        'status' => 'configuration_error',
        'error' => 'Lead Hunter relay is not configured.'
    ], 500);
}

// Connect to MySQL Database & Ensure Tables Exist
try {
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $dbHost, $dbPort, $dbName);
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => true,
    ]);

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `licenses` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `email` VARCHAR(255) NOT NULL,
            `license_key` VARCHAR(64) NOT NULL UNIQUE,
            `status` ENUM('active', 'expiring_soon', 'expired', 'suspended') DEFAULT 'active',
            `plan` VARCHAR(64) DEFAULT 'Pro',
            `device_id` VARCHAR(128) DEFAULT NULL,
            `device_locked` TINYINT(1) DEFAULT 0,
            `max_recipients` INT DEFAULT 10000,
            `max_batch_limit` INT DEFAULT 500,
            `total_extracted` INT DEFAULT 0,
            `issued_at` DATE NOT NULL,
            `expires_at` DATE NOT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX (`email`),
            INDEX (`license_key`),
            INDEX (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS `license_devices` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `license_id` INT NOT NULL,
            `email` VARCHAR(255) NOT NULL,
            `device_id` VARCHAR(128) NOT NULL,
            `device_name` VARCHAR(128) DEFAULT 'PC',
            `last_seen` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY `unique_dev_per_lic` (`license_id`, `device_id`),
            INDEX (`email`),
            INDEX (`device_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS `license_otps` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `email` VARCHAR(255) NOT NULL,
            `device_id` VARCHAR(128) NOT NULL,
            `otp_code` VARCHAR(128) NOT NULL,
            `attempts` INT DEFAULT 0,
            `expires_at` TIMESTAMP NOT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX (`email`),
            INDEX (`device_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS `recipient_lists` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `email` VARCHAR(255) NOT NULL,
            `list_name` VARCHAR(255) NOT NULL,
            `description` TEXT,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX (`email`),
            INDEX (`list_name`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS `recipients` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `list_id` INT NOT NULL,
            `owner_email` VARCHAR(255) NOT NULL,
            `name` VARCHAR(255) DEFAULT '',
            `email` VARCHAR(255) NOT NULL,
            `company` VARCHAR(255) DEFAULT '',
            `phone` VARCHAR(50) DEFAULT '',
            `website` VARCHAR(255) DEFAULT NULL,
            `status` VARCHAR(20) DEFAULT 'active',
            `tags` JSON DEFAULT NULL,
            `metadata` JSON DEFAULT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY `unique_email_per_list` (`list_id`, `email`),
            INDEX (`owner_email`),
            INDEX (`email`),
            INDEX (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // Dynamic schema column integrity migrations
    try { $pdo->exec("ALTER TABLE `licenses` ADD COLUMN `max_recipients` INT DEFAULT 10000"); } catch (\Throwable $e) {}
    try { $pdo->exec("ALTER TABLE `licenses` ADD COLUMN `max_batch_limit` INT DEFAULT 500"); } catch (\Throwable $e) {}
    try { $pdo->exec("ALTER TABLE `license_otps` MODIFY COLUMN `otp_code` VARCHAR(128) NOT NULL"); } catch (\Throwable $e) {}

} catch (\Throwable $e) {
    error_log('MailFlow LeadHunter DB connection failed: ' . $e->getMessage());
    sendJson([
        'ok' => false,
        'status' => 'db_error',
        'error' => 'Lead Hunter service is temporarily unavailable.'
    ], 200);
}

// Dynamic plan limits definition (DB row values take absolute priority)
function getPlanLimits(?string $planName = 'Pro', ?array $licenseRow = null): array {
    if ($licenseRow && isset($licenseRow['max_recipients']) && (int)$licenseRow['max_recipients'] > 0) {
        $rec = (int)$licenseRow['max_recipients'];
        $batch = isset($licenseRow['max_batch_limit']) && (int)$licenseRow['max_batch_limit'] > 0 ? (int)$licenseRow['max_batch_limit'] : 500;
        return ['name' => $licenseRow['plan'] ?? $planName ?? 'Pro', 'max_recipients' => $rec, 'max_batch_limit' => $batch];
    }

    $p = strtolower(trim((string)$planName));
    if (str_contains($p, 'enterprise') || str_contains($p, 'agency') || str_contains($p, 'custom') || str_contains($p, 'diamond')) {
        return ['name' => 'Enterprise', 'max_recipients' => 50000, 'max_batch_limit' => 1000];
    }
    if (str_contains($p, 'starter') || str_contains($p, 'basic') || str_contains($p, 'silver')) {
        return ['name' => 'Starter', 'max_recipients' => 2500, 'max_batch_limit' => 250];
    }
    return ['name' => 'Pro', 'max_recipients' => 10000, 'max_batch_limit' => 500];
}

function getLiveRecipientCount(PDO $pdo, string $email, string $secret): int {
    $email = strtolower(trim($email));
    if (empty($email)) return 0;

    // 1. Try Live Django API summary
    $djangoRes = callDjangoMailFlowApi('/api/recipient-lists/summary/?email=' . urlencode($email), [], 'GET', $secret);
    if ($djangoRes && isset($djangoRes['quota']['current_recipients'])) {
        return (int)$djangoRes['quota']['current_recipients'];
    }

    // 2. Try Django Database Tables
    try {
        $uStmt = $pdo->prepare("SELECT organization_id FROM `users_user` WHERE LOWER(`email`) = :email LIMIT 1");
        $uStmt->execute([':email' => $email]);
        $orgId = $uStmt->fetchColumn();
        if ($orgId) {
            $cnt = $pdo->prepare("SELECT COUNT(*) FROM `recipients_recipient` WHERE `organization_id` = :org");
            $cnt->execute([':org' => $orgId]);
            return (int)$cnt->fetchColumn();
        }
    } catch (\Throwable $e) {}

    // 3. Fallback to Standalone Table
    try {
        $cnt = $pdo->prepare("SELECT COUNT(*) FROM `recipients` WHERE LOWER(`owner_email`) = :email");
        $cnt->execute([':email' => $email]);
        return (int)$cnt->fetchColumn();
    } catch (\Throwable $e) {}

    return 0;
}

// ----------------------------------------------------
// Cryptographic JWT Helpers
// ----------------------------------------------------
function createJwtToken(string $email, string $deviceId, string $plan, ?array $quota, string $secret, ?string $expireDate = null): string {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);

    $exp = !empty($expireDate) ? strtotime($expireDate . (strlen($expireDate) === 10 ? ' 23:59:59' : '')) : null;
    if (!$exp || $exp <= 0) {
        $exp = time() + (86400 * 30); // fallback 30 days
    }

    $payload = json_encode([
        'sub' => strtolower($email),
        'device_id' => $deviceId,
        'plan' => $plan,
        'quota' => $quota,
        'iat' => time(),
        'exp' => $exp,
        'expire_date' => $expireDate ?: date('Y-m-d', $exp)
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    $b64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $b64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
    $signature = hash_hmac('sha256', $b64Header . "." . $b64Payload, $secret, true);
    $b64Sig = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

    return "$b64Header.$b64Payload.$b64Sig";
}

function verifyJwtToken(string $token, string $secret): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    $b64Header = $parts[0];
    $b64Payload = $parts[1];
    $b64Sig = $parts[2];

    $expectedSig = hash_hmac('sha256', $b64Header . "." . $b64Payload, $secret, true);
    $b64ExpectedSig = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($expectedSig));

    if (!hash_equals($b64ExpectedSig, $b64Sig)) {
        return null;
    }

    $json = base64_decode(str_replace(['-', '_'], ['+', '/'], $b64Payload));
    $payload = json_decode($json, true);

    if (!$payload || !isset($payload['exp']) || $payload['exp'] < time()) {
        return null;
    }

    return $payload;
}

// ----------------------------------------------------
// 2-Device Policy Helper Functions
// ----------------------------------------------------
const MAX_DEVICE_LIMIT = 2;

function getActiveDevicesForLicense(PDO $pdo, int $licenseId): array {
    $stmt = $pdo->prepare("SELECT `device_id`, `last_seen` FROM `license_devices` WHERE `license_id` = :lid ORDER BY `last_seen` ASC");
    $stmt->execute([':lid' => $licenseId]);
    return $stmt->fetchAll();
}

function registerDeviceForLicense(PDO $pdo, int $licenseId, string $email, string $deviceId): void {
    $stmt = $pdo->prepare("
        INSERT INTO `license_devices` (`license_id`, `email`, `device_id`, `last_seen`)
        VALUES (:lid, :email, :dev, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE `last_seen` = CURRENT_TIMESTAMP
    ");
    $stmt->execute([':lid' => $licenseId, ':email' => strtolower($email), ':dev' => $deviceId]);
}

function evictOldestDeviceAndAdd(PDO $pdo, int $licenseId, string $email, string $newDeviceId): void {
    $devices = getActiveDevicesForLicense($pdo, $licenseId);
    if (count($devices) >= MAX_DEVICE_LIMIT) {
        $oldest = $devices[0]['device_id'];
        $del = $pdo->prepare("DELETE FROM `license_devices` WHERE `license_id` = :lid AND `device_id` = :oldest LIMIT 1");
        $del->execute([':lid' => $licenseId, ':oldest' => $oldest]);
    }
    registerDeviceForLicense($pdo, $licenseId, $email, $newDeviceId);
}

function createOtpDigest(string $email, string $deviceId, string $otpCode, string $secret): string {
    return hash_hmac('sha256', strtolower($email) . '|' . $deviceId . '|' . $otpCode, $secret);
}

function isRegisteredDevice(PDO $pdo, int $licenseId, string $deviceId): bool {
    if ($deviceId === '') {
        return false;
    }
    $stmt = $pdo->prepare("SELECT 1 FROM `license_devices` WHERE `license_id` = :lid AND `device_id` = :dev LIMIT 1");
    $stmt->execute([':lid' => $licenseId, ':dev' => $deviceId]);
    return (bool)$stmt->fetchColumn();
}

function verifyBearerContext(string $token, string $expectedEmail, string $expectedDevice, string $secret): ?array {
    if ($token === '' || $expectedDevice === '') {
        return null;
    }
    $payload = verifyJwtToken($token, $secret);
    if (!$payload || empty($payload['sub']) || empty($payload['device_id'])) {
        return null;
    }
    if (!hash_equals(strtolower($expectedEmail), strtolower((string)$payload['sub']))) {
        return null;
    }
    if (!hash_equals($expectedDevice, (string)$payload['device_id'])) {
        return null;
    }
    return $payload;
}

function sendOtpRequiredResponse(int $registeredDeviceCount = 0): void {
    sendJson([
        'ok' => false,
        'status' => 'otp_required',
        'otp_required' => true,
        'message' => 'Device verification required. Please enter the code sent to your Mail Flow email.',
        'registered_devices_count' => $registeredDeviceCount
    ], 403);
}

// ----------------------------------------------------
// Email Dispatch Helper
// ----------------------------------------------------
function sendOtpEmail(string $recipientEmail, string $otpCode, string $secret): bool {
    $response = callDjangoMailFlowApi('/api/billing/lead-hunter/device-otp/send/', [
        'email' => strtolower($recipientEmail),
        'code' => $otpCode,
    ], 'POST', $secret);
    if (!$response || (isset($response['ok']) && $response['ok'] === false)) {
        error_log('Lead Hunter OTP backend delivery failed for ' . $recipientEmail);
        return false;
    }
    return true;
}

// ----------------------------------------------------
// 2. Handle GET Verification (Backwards-Compatible)
// ----------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $query = trim($_GET['email'] ?? $_GET['key'] ?? $_GET['license_key'] ?? '');
    $deviceId = trim($_GET['deviceId'] ?? $_GET['device_id'] ?? '');

    if (empty($query)) {
        sendJson(['ok' => false, 'status' => 'not_found', 'error' => 'License key required.'], 400);
    }
    if (filter_var($query, FILTER_VALIDATE_EMAIL)) {
        sendJson(['ok' => false, 'status' => 'otp_required', 'error' => 'Email-only license lookup requires OTP verification.'], 403);
    }
    if (empty($deviceId)) {
        sendJson(['ok' => false, 'status' => 'device_required', 'error' => 'Device identifier is required.'], 400);
    }

    $stmt = $pdo->prepare("
        SELECT * FROM `licenses` 
        WHERE LOWER(`license_key`) = :q2 
        ORDER BY `id` DESC LIMIT 1
    ");
    $stmt->execute([':q2' => strtolower($query)]);
    $lic = $stmt->fetch();

    if ($lic && str_starts_with((string)($lic['license_key'] ?? ''), 'MF-LH-')) {
        $djangoCheck = callDjangoMailFlowApi('/api/recipient-lists/summary/?email=' . urlencode((string)$lic['email']), [], 'GET', $relaySecret);
        if (!$djangoCheck || (isset($djangoCheck['ok']) && $djangoCheck['ok'] === false) || empty($djangoCheck['quota'])) {
            $del = $pdo->prepare("DELETE FROM `licenses` WHERE `id` = :id");
            $del->execute([':id' => $lic['id']]);
            $delDev = $pdo->prepare("DELETE FROM `license_devices` WHERE `license_id` = :id");
            $delDev->execute([':id' => $lic['id']]);
            $lic = null;
        }
    }

    if (!$lic) {
        sendJson(['ok' => false, 'status' => 'not_found', 'error' => 'No active Lead Hunter subscription found for this account.'], 404);
    }

    if ($lic['status'] === 'suspended') {
        sendJson(['ok' => false, 'status' => 'suspended', 'error' => 'Account access has been suspended.'], 403);
    }

    if ($lic['expires_at'] < date('Y-m-d')) {
        sendJson(['ok' => false, 'status' => 'expired', 'error' => 'Your subscription has expired.'], 403);
    }

    // 2-Device verification
    if (!empty($deviceId)) {
        $activeDevs = getActiveDevicesForLicense($pdo, (int)$lic['id']);
        $devList = array_column($activeDevs, 'device_id');

        if (in_array($deviceId, $devList)) {
            registerDeviceForLicense($pdo, (int)$lic['id'], $lic['email'], $deviceId);
        } else {
            sendOtpRequiredResponse(count($activeDevs));
        }
    }

    $currentRecipientsCount = getLiveRecipientCount($pdo, (string)$lic['email'], $relaySecret);

    $planLimits = getPlanLimits($lic['plan'] ?? 'Pro', $lic);
    $maxRecipients = (int)($lic['max_recipients'] ?? $planLimits['max_recipients']);
    $maxBatchLimit = (int)($lic['max_batch_limit'] ?? $planLimits['max_batch_limit']);
    $availableSlots = max(0, $maxRecipients - $currentRecipientsCount);

    $quota = [
        'plan_name' => $lic['plan'] ?? 'Pro',
        'plan_status' => 'active',
        'max_recipients' => $maxRecipients,
        'current_recipients' => $currentRecipientsCount,
        'available_slots' => $availableSlots,
        'max_batch_limit' => min($maxBatchLimit, max(20, $availableSlots)),
    ];

    $token = createJwtToken($lic['email'], $deviceId, $lic['plan'] ?? 'Pro', $quota, $relaySecret, $lic['expires_at'] ?? null);

    sendJson([
        'ok' => true,
        'status' => 'active',
        'token' => $token,
        'email' => $lic['email'],
        'plan' => $lic['plan'] ?? 'Pro',
        'licenseKey' => $lic['license_key'],
        'expireDate' => $lic['expires_at'],
        'quota' => $quota
    ]);
}

// ----------------------------------------------------
// 3. Parse JSON Body for POST Requests
// ----------------------------------------------------
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?? [];
$action = $input['action'] ?? '';

// Check Authorization Bearer Token if present
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
$bearerToken = '';
if (preg_match('/Bearer\s(\S+)/i', $authHeader, $matches)) {
    $bearerToken = $matches[1];
} elseif (!empty($input['token'])) {
    $bearerToken = (string)$input['token'];
}

// ----------------------------------------------------
// ACTION: activate_license (Hardened POST with 2-Device Check)
// ----------------------------------------------------
if ($action === 'activate_license') {
    $email = strtolower(trim($input['email'] ?? ''));
    $deviceId = trim($input['deviceId'] ?? $input['device_id'] ?? '');

    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendJson(['ok' => false, 'status' => 'error', 'error' => 'Valid account email is required.'], 400);
    }
    if (empty($deviceId)) {
        sendJson(['ok' => false, 'status' => 'device_required', 'error' => 'Device identifier is required.'], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM `licenses` WHERE LOWER(`email`) = :email ORDER BY `id` DESC LIMIT 1");
    $stmt->execute([':email' => $email]);
    $lic = $stmt->fetch();

    // Re-verify auto-provisioned licenses against Django to invalidate test rows
    if ($lic && str_starts_with((string)($lic['license_key'] ?? ''), 'MF-LH-')) {
        $djangoCheck = callDjangoMailFlowApi('/api/recipient-lists/summary/?email=' . urlencode($email), [], 'GET', $relaySecret);
        if (!$djangoCheck || (isset($djangoCheck['ok']) && $djangoCheck['ok'] === false) || empty($djangoCheck['quota'])) {
            $del = $pdo->prepare("DELETE FROM `licenses` WHERE `id` = :id");
            $del->execute([':id' => $lic['id']]);
            $delDev = $pdo->prepare("DELETE FROM `license_devices` WHERE `license_id` = :id");
            $delDev->execute([':id' => $lic['id']]);
            $lic = null;
        }
    }

    if (!$lic) {
        // 1. Verify with Django REST API (mailflow.annomous.com)
        $isDjangoUser = false;
        $djangoRes = callDjangoMailFlowApi('/api/recipient-lists/summary/?email=' . urlencode($email), [], 'GET', $relaySecret);
        if ($djangoRes && isset($djangoRes['quota']) && (!isset($djangoRes['ok']) || $djangoRes['ok'] !== false)) {
            $isDjangoUser = true;
        }

        // 2. Check local database table if present
        if (!$isDjangoUser) {
            try {
                $userStmt = $pdo->prepare("SELECT id, organization_id, is_active FROM `users_user` WHERE LOWER(`email`) = :email LIMIT 1");
                $userStmt->execute([':email' => $email]);
                $djangoUser = $userStmt->fetch();
                if ($djangoUser && (!isset($djangoUser['is_active']) || $djangoUser['is_active'])) {
                    $isDjangoUser = true;
                }
            } catch (\Throwable $e) {
                // Standalone DB mode - table users_user not in same MySQL instance
            }
        }

        if (!$isDjangoUser) {
            sendJson([
                'ok' => false,
                'status' => 'unauthorized',
                'error' => 'Access denied. ' . $email . ' requires an Administrator or Owner role with an active paid subscription. Please contact your organization owner or upgrade at mail-flow.annomous.com.'
            ], 403);
        }

        // Verified member of organization -> Link license
        $autoKey = sprintf('MF-LH-%s-%s-%s', strtoupper(bin2hex(random_bytes(2))), strtoupper(bin2hex(random_bytes(2))), strtoupper(bin2hex(random_bytes(2))));
        $issuedAt = date('Y-m-d');
        $expiresAt = date('Y-m-d', strtotime('+30 days'));

        $ins = $pdo->prepare("INSERT INTO `licenses` (`email`, `license_key`, `status`, `plan`, `issued_at`, `expires_at`) VALUES (:email, :key, 'active', 'Pro', :issued_at, :expires_at)");
        $ins->execute([':email' => $email, ':key' => $autoKey, ':issued_at' => $issuedAt, ':expires_at' => $expiresAt]);
        $licId = (int)$pdo->lastInsertId();
        $lic = ['id' => $licId, 'email' => $email, 'plan' => 'Pro', 'status' => 'active', 'expires_at' => $expiresAt];
    }

    if ($lic['status'] === 'suspended') {
        sendJson(['ok' => false, 'status' => 'suspended', 'error' => 'Account access has been suspended.'], 403);
    }

    if ($lic['expires_at'] < date('Y-m-d')) {
        sendJson(['ok' => false, 'status' => 'expired', 'error' => 'Subscription expired. Please renew on Mail Flow.'], 403);
    }

    $licId = (int)$lic['id'];
    $activeDevs = getActiveDevicesForLicense($pdo, $licId);

    $trustedPayload = verifyBearerContext($bearerToken, $email, $deviceId, $relaySecret);
    if (!$trustedPayload || !isRegisteredDevice($pdo, $licId, $deviceId)) {
        sendOtpRequiredResponse(count($activeDevs));
    }

    registerDeviceForLicense($pdo, $licId, $email, $deviceId);
    $currentRecipients = getLiveRecipientCount($pdo, $email, $relaySecret);

    $planLimits = getPlanLimits($lic['plan'] ?? 'Pro', $lic);
    $maxRec = (int)($lic['max_recipients'] ?? $planLimits['max_recipients']);
    $maxBatch = (int)($lic['max_batch_limit'] ?? $planLimits['max_batch_limit']);
    $avail = max(0, $maxRec - $currentRecipients);

    $quota = [
        'plan_name' => $lic['plan'] ?? 'Pro',
        'plan_status' => 'active',
        'max_recipients' => $maxRec,
        'current_recipients' => $currentRecipients,
        'available_slots' => $avail,
        'max_batch_limit' => min($maxBatch, max(20, $avail)),
    ];

    $token = createJwtToken($email, $deviceId, $lic['plan'] ?? 'Pro', $quota, $relaySecret, $lic['expires_at'] ?? null);

    sendJson([
        'ok' => true,
        'status' => 'active',
        'token' => $token,
        'email' => $email,
        'plan' => $lic['plan'] ?? 'Pro',
        'expireDate' => $lic['expires_at'],
        'quota' => $quota
    ]);
}

// ----------------------------------------------------
// ACTION: request_device_otp
// ----------------------------------------------------
if ($action === 'request_device_otp') {
    $email = strtolower(trim($input['email'] ?? ''));
    $deviceId = trim($input['deviceId'] ?? $input['device_id'] ?? '');

    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendJson(['ok' => false, 'error' => 'Valid account email required.'], 400);
    }
    if (empty($deviceId)) {
        sendJson(['ok' => false, 'status' => 'device_required', 'error' => 'Device identifier is required.'], 400);
    }

    $licStmt = $pdo->prepare("SELECT * FROM `licenses` WHERE LOWER(`email`) = :email ORDER BY `id` DESC LIMIT 1");
    $licStmt->execute([':email' => $email]);
    $lic = $licStmt->fetch();
    if (!$lic || $lic['status'] !== 'active' || $lic['expires_at'] < date('Y-m-d')) {
        sendJson(['ok' => false, 'status' => 'expired', 'error' => 'Active subscription required before device verification.'], 403);
    }

    // Rate limit: 1 request per 45 seconds
    $chkStmt = $pdo->prepare("SELECT `created_at` FROM `license_otps` WHERE `email` = :email AND `device_id` = :dev ORDER BY `id` DESC LIMIT 1");
    $chkStmt->execute([':email' => $email, ':dev' => $deviceId]);
    $lastOtp = $chkStmt->fetch();
    if ($lastOtp && (time() - strtotime($lastOtp['created_at'])) < 45) {
        sendJson(['ok' => true, 'message' => "Verification code already sent. Please check your inbox."]);
    }

    $otp = strval(random_int(100000, 999999));
    $otpDigest = createOtpDigest($email, $deviceId, $otp, $relaySecret);
    $expiresAt = date('Y-m-d H:i:s', time() + 300); // 5 minutes TTL

    $insOtp = $pdo->prepare("INSERT INTO `license_otps` (`email`, `device_id`, `otp_code`, `expires_at`) VALUES (:email, :dev, :otp, :exp)");
    $insOtp->execute([':email' => $email, ':dev' => $deviceId, ':otp' => $otpDigest, ':exp' => $expiresAt]);

    if (!sendOtpEmail($email, $otp, $relaySecret)) {
        $delOtp = $pdo->prepare("DELETE FROM `license_otps` WHERE `email` = :email AND `device_id` = :dev AND `otp_code` = :otp");
        $delOtp->execute([':email' => $email, ':dev' => $deviceId, ':otp' => $otpDigest]);
        sendJson([
            'ok' => false,
            'status' => 'email_delivery_failed',
            'error' => 'Verification email could not be sent. Please try again or contact support.'
        ], 502);
    }

    sendJson([
        'ok' => true,
        'status' => 'otp_sent',
        'message' => "Verification code sent from Mail Flow Billing to {$email}"
    ]);
}

// ----------------------------------------------------
// ACTION: verify_device_otp (Verify Code & Transfer Slot)
// ----------------------------------------------------
if ($action === 'verify_device_otp') {
    $email = strtolower(trim($input['email'] ?? ''));
    $deviceId = trim($input['deviceId'] ?? $input['device_id'] ?? '');
    $otp = trim($input['otp'] ?? '');

    if (empty($email) || empty($deviceId) || empty($otp)) {
        sendJson(['ok' => false, 'status' => 'error', 'error' => 'Email, device, and 6-digit code are required.'], 400);
    }

    $stmt = $pdo->prepare("
        SELECT * FROM `license_otps` 
        WHERE `email` = :email AND `device_id` = :dev AND `expires_at` > NOW()
        ORDER BY `id` DESC LIMIT 1
    ");
    $stmt->execute([':email' => $email, ':dev' => $deviceId]);
    $otpRecord = $stmt->fetch();

    if (!$otpRecord) {
        sendJson(['ok' => false, 'status' => 'invalid_otp', 'error' => 'Invalid or expired verification code. Please request a new one.'], 400);
    }

    $attempts = (int)($otpRecord['attempts'] ?? 0);
    if ($attempts >= 5) {
        $del = $pdo->prepare("DELETE FROM `license_otps` WHERE `id` = :id");
        $del->execute([':id' => $otpRecord['id']]);
        sendJson(['ok' => false, 'status' => 'too_many_attempts', 'error' => 'Too many failed attempts. Verification code has been revoked. Please request a new code.'], 429);
    }

    $expectedOtpDigest = createOtpDigest($email, $deviceId, $otp, $relaySecret);
    if (!hash_equals(trim((string)$otpRecord['otp_code']), $expectedOtpDigest)) {
        $attempts++;
        if ($attempts >= 5) {
            $del = $pdo->prepare("DELETE FROM `license_otps` WHERE `id` = :id");
            $del->execute([':id' => $otpRecord['id']]);
            sendJson(['ok' => false, 'status' => 'too_many_attempts', 'error' => 'Too many failed attempts. Verification code has been revoked.'], 429);
        } else {
            $upd = $pdo->prepare("UPDATE `license_otps` SET `attempts` = :att WHERE `id` = :id");
            $upd->execute([':att' => $attempts, ':id' => $otpRecord['id']]);
            $remaining = 5 - $attempts;
            sendJson(['ok' => false, 'status' => 'invalid_otp', 'error' => "Incorrect verification code. {$remaining} attempt(s) remaining."], 400);
        }
    }

    // Valid OTP - Invalidate and delete OTP
    $del = $pdo->prepare("DELETE FROM `license_otps` WHERE `id` = :id");
    $del->execute([':id' => $otpRecord['id']]);

    // Find license
    $licStmt = $pdo->prepare("SELECT * FROM `licenses` WHERE LOWER(`email`) = :email ORDER BY `id` DESC LIMIT 1");
    $licStmt->execute([':email' => $email]);
    $lic = $licStmt->fetch();

    if (!$lic) {
        sendJson(['ok' => false, 'error' => 'Subscription record not found.'], 404);
    }
    if ($lic['status'] !== 'active' || $lic['expires_at'] < date('Y-m-d')) {
        sendJson(['ok' => false, 'status' => 'expired', 'error' => 'Active subscription required.'], 403);
    }

    $licId = (int)$lic['id'];
    if (isRegisteredDevice($pdo, $licId, $deviceId)) {
        registerDeviceForLicense($pdo, $licId, $email, $deviceId);
    } else {
        evictOldestDeviceAndAdd($pdo, $licId, $email, $deviceId);
    }

    $currentRecipients = getLiveRecipientCount($pdo, $email, $relaySecret);

    $planLimits = getPlanLimits($lic['plan'] ?? 'Pro', $lic);
    $maxRec = (int)($lic['max_recipients'] ?? $planLimits['max_recipients']);
    $maxBatch = (int)($lic['max_batch_limit'] ?? $planLimits['max_batch_limit']);
    $avail = max(0, $maxRec - $currentRecipients);

    $quota = [
        'plan_name' => $lic['plan'] ?? 'Pro',
        'plan_status' => 'active',
        'max_recipients' => $maxRec,
        'current_recipients' => $currentRecipients,
        'available_slots' => $avail,
        'max_batch_limit' => min($maxBatch, max(20, $avail)),
    ];

    $token = createJwtToken($email, $deviceId, $lic['plan'] ?? 'Pro', $quota, $relaySecret, $lic['expires_at'] ?? null);

    sendJson([
        'ok' => true,
        'status' => 'active',
        'token' => $token,
        'email' => $email,
        'plan' => $lic['plan'] ?? 'Pro',
        'expireDate' => $lic['expires_at'],
        'quota' => $quota
    ]);
}

// ----------------------------------------------------
// ACTION: heartbeat (Periodic Token Health Check)
// ----------------------------------------------------
if ($action === 'heartbeat') {
    $token = !empty($bearerToken) ? $bearerToken : trim($input['token'] ?? '');
    $deviceId = trim($input['deviceId'] ?? $input['device_id'] ?? '');

    $payload = !empty($token) ? verifyJwtToken($token, $relaySecret) : null;
    $verifiedEmail = $payload['sub'] ?? '';
    $verifiedDevice = $payload['device_id'] ?? '';

    if (empty($verifiedEmail) || !filter_var($verifiedEmail, FILTER_VALIDATE_EMAIL) || empty($verifiedDevice)) {
        sendJson(['ok' => false, 'status' => 'unauthorized'], 401);
    }
    if ($deviceId !== '' && !hash_equals((string)$verifiedDevice, $deviceId)) {
        sendJson(['ok' => false, 'status' => 'device_locked', 'message' => 'Device token mismatch. Please sign in again.'], 403);
    }

    $stmt = $pdo->prepare("SELECT * FROM `licenses` WHERE LOWER(`email`) = :email ORDER BY `id` DESC LIMIT 1");
    $stmt->execute([':email' => $verifiedEmail]);
    $lic = $stmt->fetch();

    if (!$lic || $lic['status'] !== 'active' || $lic['expires_at'] < date('Y-m-d')) {
        sendJson(['ok' => false, 'status' => 'expired', 'message' => 'Subscription inactive or expired.']);
    }
    if (!isRegisteredDevice($pdo, (int)$lic['id'], (string)$verifiedDevice)) {
        sendJson(['ok' => false, 'status' => 'device_locked', 'message' => 'Device unauthorized. Please verify via OTP.'], 403);
    }
    registerDeviceForLicense($pdo, (int)$lic['id'], $verifiedEmail, (string)$verifiedDevice);

    $currentTotal = getLiveRecipientCount($pdo, $verifiedEmail, $relaySecret);

    $planLimits = getPlanLimits($lic['plan'] ?? 'Pro', $lic);
    $maxRec = (int)($lic['max_recipients'] ?? $planLimits['max_recipients']);
    $maxBatch = (int)($lic['max_batch_limit'] ?? $planLimits['max_batch_limit']);
    $availSlots = max(0, $maxRec - $currentTotal);

    $expTime = !empty($lic['expires_at']) ? strtotime($lic['expires_at'] . (strlen($lic['expires_at']) === 10 ? ' 23:59:59' : '')) : (time() + 86400 * 30);

    sendJson([
        'ok' => true,
        'status' => 'active',
        'expireDate' => $lic['expires_at'],
        'exp' => $expTime,
        'quota' => [
            'plan_name' => $lic['plan'] ?? 'Pro',
            'plan_status' => 'active',
            'max_recipients' => $maxRec,
            'current_recipients' => $currentTotal,
            'available_slots' => $availSlots,
            'max_batch_limit' => min($maxBatch, max(20, $availSlots)),
        ]
    ]);
}

// ----------------------------------------------------
// Helper: Direct Django API Forwarder
// ----------------------------------------------------
function callDjangoMailFlowApi(string $path, array $data = [], string $method = 'POST', string $secret = ''): ?array {
    $urls = [
        'https://mailflow.annomous.com' . $path,
        'http://127.0.0.1:8000' . $path,
        'http://localhost:8000' . $path,
        'https://mail.annomous.com' . $path,
    ];

    foreach ($urls as $fullUrl) {
        $ch = curl_init($fullUrl);
        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
            'X-Mail-Flow-Secret: ' . $secret,
        ];
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } else {
            curl_setopt($ch, CURLOPT_HTTPGET, true);
        }

        $res = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($res && $httpCode >= 200 && $httpCode < 300) {
            $json = json_decode($res, true);
            if (is_array($json) && (!isset($json['ok']) || $json['ok'] !== false)) {
                return $json;
            }
        }
    }
    return null;
}

// ----------------------------------------------------
// Handle Client Lead Push & Lists Actions
// ----------------------------------------------------
if (in_array($action, ['push_leads', 'get_recipient_lists', 'verify_license', 'get_scraper_rules'])) {
    $clientDevice = trim($input['deviceId'] ?? $input['device_id'] ?? '');
    $jwtPayload = !empty($bearerToken) ? verifyJwtToken($bearerToken, $relaySecret) : null;

    if (!$jwtPayload || empty($jwtPayload['sub']) || empty($jwtPayload['device_id'])) {
        sendJson(['ok' => false, 'status' => 'unauthorized', 'error' => 'Valid Lead Hunter session token required.'], 401);
    }
    $clientEmail = strtolower((string)$jwtPayload['sub']);
    $tokenDevice = (string)$jwtPayload['device_id'];
    if (empty($clientEmail) || !filter_var($clientEmail, FILTER_VALIDATE_EMAIL)) {
        sendJson(['ok' => false, 'status' => 'unauthorized', 'error' => 'Valid Lead Hunter session token required.'], 401);
    }
    if ($clientDevice !== '' && !hash_equals($tokenDevice, $clientDevice)) {
        sendJson(['ok' => false, 'status' => 'device_locked', 'error' => 'Device token mismatch. Please verify via OTP.'], 403);
    }

    $stmt = $pdo->prepare("SELECT * FROM `licenses` WHERE LOWER(`email`) = :email ORDER BY `id` DESC LIMIT 1");
    $stmt->execute([':email' => $clientEmail]);
    $lic = $stmt->fetch();

    if (!$lic || $lic['status'] !== 'active' || $lic['expires_at'] < date('Y-m-d')) {
        sendJson(['ok' => false, 'status' => 'expired', 'error' => 'Active subscription required.'], 403);
    }
    if (!isRegisteredDevice($pdo, (int)$lic['id'], $tokenDevice)) {
        sendJson(['ok' => false, 'status' => 'device_locked', 'error' => 'Device unauthorized. Please verify via OTP.'], 403);
    }
    registerDeviceForLicense($pdo, (int)$lic['id'], $clientEmail, $tokenDevice);

    if ($action === 'verify_license') {
        $currentRecipients = getLiveRecipientCount($pdo, $clientEmail, $relaySecret);
        $planLimits = getPlanLimits($lic['plan'] ?? 'Pro', $lic);
        $maxRec = (int)($lic['max_recipients'] ?? $planLimits['max_recipients']);
        $maxBatch = (int)($lic['max_batch_limit'] ?? $planLimits['max_batch_limit']);
        $avail = max(0, $maxRec - $currentRecipients);

        sendJson([
            'ok' => true,
            'status' => 'active',
            'email' => $clientEmail,
            'plan' => $lic['plan'] ?? 'Pro',
            'expireDate' => $lic['expires_at'],
            'quota' => [
                'plan_name' => $lic['plan'] ?? 'Pro',
                'plan_status' => 'active',
                'max_recipients' => $maxRec,
                'current_recipients' => $currentRecipients,
                'available_slots' => $avail,
                'max_batch_limit' => min($maxBatch, max(20, $avail)),
            ]
        ]);
    }

    // Dynamic Server-Gated Extraction Rules
    if ($action === 'get_scraper_rules') {
        $rules = [
            'version' => '1.0.0',
            'timestamp' => time(),
            'modules' => [
                'maps' => [
                    'feedSelectors' => [
                        'div[role="feed"]',
                        'div[aria-label^="Results for"]',
                        '.m6QErb[aria-label]',
                        '.m6QErb.DxyBCb'
                    ],
                    'cardSelectors' => [
                        'div.Nv2PK',
                        'div[role="article"]',
                        'div.THOPZb',
                        'div.m6QErb > div[jsaction]',
                        'div:has(> a.hfpxzc)'
                    ],
                    'nameSelectors' => [
                        '.qBF1Pd',
                        '.fontHeadlineSmall',
                        '[class*="fontHeadline"]',
                        'a.hfpxzc',
                        'h2'
                    ],
                    'ratingSelectors' => [
                        '.MW4etd',
                        'span[aria-label*="stars" i]',
                        'span[aria-label*="star" i]',
                        'span[role="img"][aria-label*="stars" i]'
                    ],
                    'reviewCountSelectors' => [
                        '.UY7F9',
                        '.RDApEe'
                    ],
                    'websiteSelectors' => [
                        'a[data-item-id="authority"]',
                        'a[aria-label*="website" i]',
                        'a[aria-label*="Website" i]',
                        'a[data-tooltip*="website" i]',
                        'a[href^="http"]:not([href*="google."]):not([href*="gstatic."])'
                    ],
                    'phoneSelectors' => [
                        'button[data-item-id*="phone"]',
                        'button[data-tooltip*="phone" i]',
                        'button[aria-label*="Phone" i]',
                        'button[aria-label*="phone" i]',
                        '[data-item-id*="phone"]'
                    ],
                    'addressSelectors' => [
                        'button[data-item-id="address"]',
                        'button[data-tooltip*="address" i]',
                        'button[aria-label*="Address" i]',
                        '[data-item-id*="address"]',
                        'div.W4Efsd > span:last-child'
                    ],
                    'emailRegex' => '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})',
                    'scrollWaitMs' => 1200,
                    'maxScrollAttempts' => 200
                ],
                'scraper' => [
                    'directoryDomains' => ['yelp.', 'theknot.', 'bbb.org', 'yellowpages.', 'manta.', 'thumbtack.', 'clutch.co', 'angi.', 'bark.com', 'trustpilot.'],
                    'badDomains' => ['google.', 'facebook.', 'instagram.', 'twitter.', 'x.com', 'pinterest.', 'linkedin.', 'youtube.', 'onetrust.com', 'privacypolicy', 'terms', 'cookie'],
                    'emailRegex' => '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})',
                    'phoneRegex' => '(\\+?\\d{1,4}[\\s.-]?)?\\(?\\d{2,4}\\)?[\\s.-]?\\d{3,4}[\\s.-]?\\d{3,4}'
                ],
                'instagram' => [
                    'profileBio' => 'header section > div:last-child',
                    'followers' => 'header section ul li:nth-child(2)',
                    'emailRegex' => '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})'
                ],
                'facebook' => [
                    'groupMemberCards' => 'div[role="listitem"], div[data-visualcompletion="ignore-dynamic-snippet"]',
                    'pageAbout' => 'div[role="main"]',
                    'emailRegex' => '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})'
                ]
            ]
        ];

        sendJson([
            'ok' => true,
            'status' => 'success',
            'rules' => $rules,
            'plan' => $lic['plan'] ?? 'Pro',
            'email' => $clientEmail
        ]);
    }

    if ($action === 'get_recipient_lists') {
        // 1. Try Forwarding directly to Django API
        $djangoRes = callDjangoMailFlowApi('/api/recipient-lists/summary/?email=' . urlencode($clientEmail), [], 'GET', $relaySecret);
        if ($djangoRes && !empty($djangoRes['results'])) {
            sendJson($djangoRes);
        }

        // 2. Try Querying Django tables in database (Scoped to Organization)
        try {
            $uStmt = $pdo->prepare("SELECT organization_id FROM `users_user` WHERE LOWER(`email`) = :email LIMIT 1");
            $uStmt->execute([':email' => $clientEmail]);
            $orgId = $uStmt->fetchColumn();

            if ($orgId) {
                $stmt = $pdo->prepare("
                    SELECT l.id, l.list_name, l.description, COUNT(r.id) AS recipient_count, DATE_FORMAT(l.created_at, '%Y-%m-%d %H:%i') AS created_at
                    FROM `recipients_recipientlist` l
                    LEFT JOIN `recipients_recipient` r ON r.recipient_list_id = l.id
                    WHERE l.organization_id = :orgId
                    GROUP BY l.id
                    ORDER BY l.id DESC
                ");
                $stmt->execute([':orgId' => $orgId]);
                $rows = $stmt->fetchAll();
                if (!empty($rows)) {
                    sendJson([
                        'ok' => true,
                        'results' => $rows
                    ]);
                }
            }
        } catch (\Throwable $e) {}

        // 3. Fallback to standalone table
        $stmt = $pdo->prepare("
            SELECT l.id, l.list_name, l.description, COUNT(r.id) AS recipient_count, DATE_FORMAT(l.created_at, '%Y-%m-%d %H:%i') AS created_at
            FROM `recipient_lists` l
            LEFT JOIN `recipients` r ON r.list_id = l.id
            WHERE LOWER(l.email) = :email
            GROUP BY l.id
            ORDER BY l.id DESC
        ");
        $stmt->execute([':email' => $clientEmail]);
        $rows = $stmt->fetchAll();

        sendJson([
            'ok' => true,
            'results' => $rows
        ]);
    }

    if ($action === 'push_leads') {
        $leads = $input['leads'] ?? [];
        if (!is_array($leads) || empty($leads)) {
            sendJson(['ok' => false, 'error' => 'No leads provided in push payload.'], 400);
        }

        // 1. Try Forwarding directly to Django API
        $djangoPayload = [
            'email' => $clientEmail,
            'list_id' => $input['list_id'] ?? null,
            'list_name' => $input['list_name'] ?? '',
            'list_description' => $input['list_description'] ?? 'Imported from Mail Flow Lead Hunter',
            'leads' => $leads,
            'tags' => $input['tags'] ?? ['lead-hunter']
        ];
        $djangoRes = callDjangoMailFlowApi('/api/recipients/push_leads/', $djangoPayload, 'POST', $relaySecret);
        if ($djangoRes && isset($djangoRes['ok']) && $djangoRes['ok'] !== false) {
            sendJson($djangoRes);
        }
        sendJson([
            'ok' => false,
            'status' => 'django_sync_failed',
            'error' => 'Lead import could not be verified by Mail Flow. Please try again later.'
        ], 502);

        // 2. Direct Sync into Django Database Tables if present in MySQL
        try {
            $userStmt = $pdo->prepare("SELECT id, organization_id FROM `users_user` WHERE LOWER(`email`) = :email LIMIT 1");
            $userStmt->execute([':email' => $clientEmail]);
            $djangoUser = $userStmt->fetch();
            
            $orgId = $djangoUser['organization_id'] ?? null;
            $userId = $djangoUser['id'] ?? null;
            if (!$orgId) {
                sendJson([
                    'ok' => false,
                    'status' => 'unauthorized_organization',
                    'error' => 'Account is not associated with an active organization on Mail Flow.'
                ], 403);
            }

            $listId = !empty($input['list_id']) ? (int)$input['list_id'] : null;
            $listName = trim($input['list_name'] ?? 'Lead Hunter - ' . date('M d, Y'));
            $listDesc = trim($input['list_description'] ?? 'Imported from Mail Flow Lead Hunter');

            if (!$listId) {
                $chkList = $pdo->prepare("SELECT id FROM `recipients_recipientlist` WHERE LOWER(`list_name`) = :name AND `organization_id` = :org LIMIT 1");
                $chkList->execute([':name' => strtolower($listName), ':org' => $orgId]);
                $listId = (int)$chkList->fetchColumn();

                if (!$listId) {
                    $insList = $pdo->prepare("INSERT INTO `recipients_recipientlist` (`list_name`, `description`, `created_by_id`, `organization_id`, `created_at`) VALUES (:name, :desc, :user, :org, NOW())");
                    $insList->execute([':name' => $listName, ':desc' => $listDesc, ':user' => $userId, ':org' => $orgId]);
                    $listId = (int)$pdo->lastInsertId();
                }
            }

            if ($listId) {
                $stmt = $pdo->prepare("SELECT LOWER(`email`) FROM `recipients_recipient` WHERE `recipient_list_id` = :lid");
                $stmt->execute([':lid' => $listId]);
                $existingDjangoEmails = array_flip($stmt->fetchAll(PDO::FETCH_COLUMN));

                $insDjangoRec = $pdo->prepare("
                    INSERT INTO `recipients_recipient` (`recipient_list_id`, `organization_id`, `name`, `email`, `company`, `phone`, `website`, `status`, `tags`, `metadata`, `created_at`)
                    VALUES (:lid, :org, :name, :email, :company, :phone, :website, 'active', :tags, :metadata, NOW())
                ");

                $djangoInserted = 0;
                $djangoDups = 0;

                foreach ($leads as $lead) {
                    $rawEmails = $lead['emails'] ?? $lead['email'] ?? [];
                    if (is_string($rawEmails)) $rawEmails = array_filter(array_map('trim', explode(',', str_replace(';', ',', $rawEmails))));
                    if (!is_array($rawEmails)) continue;

                    $leadName = trim($lead['name'] ?? $lead['username'] ?? '');
                    $leadCompany = trim($lead['company'] ?? $leadName);
                    $rawPhones = $lead['phones'] ?? $lead['phone'] ?? [];
                    $leadPhone = is_array($rawPhones) ? implode(', ', array_filter($rawPhones)) : (string)$rawPhones;
                    $leadWebsite = trim($lead['website'] ?? $lead['url'] ?? '');

                    foreach ($rawEmails as $em) {
                        $cleanEm = strtolower(trim((string)$em));
                        if (!filter_var($cleanEm, FILTER_VALIDATE_EMAIL)) continue;

                        if (isset($existingDjangoEmails[$cleanEm])) {
                            $djangoDups++;
                            continue;
                        }

                        $insDjangoRec->execute([
                            ':lid' => $listId,
                            ':org' => $orgId,
                            ':name' => mb_substr($leadName, 0, 255),
                            ':email' => $cleanEm,
                            ':company' => mb_substr($leadCompany, 0, 255),
                            ':phone' => mb_substr($leadPhone, 0, 50),
                            ':website' => $leadWebsite ?: null,
                            ':tags' => json_encode(['lead-hunter']),
                            ':metadata' => json_encode(['source' => $lead['source'] ?? 'lead_hunter']),
                        ]);
                        $existingDjangoEmails[$cleanEm] = true;
                        $djangoInserted++;
                    }
                }

                $planLimits = getPlanLimits($lic['plan'] ?? 'Pro', $lic);
                $maxRecipients = (int)($lic['max_recipients'] ?? $planLimits['max_recipients']);
                $cntTotal = $pdo->prepare("SELECT COUNT(*) FROM `recipients_recipient` WHERE `organization_id` = :org");
                $cntTotal->execute([':org' => $orgId]);
                $updatedTotal = (int)$cntTotal->fetchColumn();
                $availSlots = max(0, $maxRecipients - $updatedTotal);

                sendJson([
                    'ok' => true,
                    'list_id' => $listId,
                    'list_name' => $listName,
                    'inserted' => $djangoInserted,
                    'duplicates' => $djangoDups,
                    'total_processed' => count($leads),
                    'quota' => [
                        'max_recipients' => $maxRecipients,
                        'current_recipients' => $updatedTotal,
                        'available_slots' => $availSlots,
                    ]
                ]);
            }
        } catch (\Throwable $e) {
            // Continue to standalone table fallback
        }

        $cntTotal = $pdo->prepare("SELECT COUNT(*) FROM `recipients` WHERE LOWER(`owner_email`) = :email");
        $cntTotal->execute([':email' => $clientEmail]);
        $currentTotal = (int)$cntTotal->fetchColumn();

        $planLimits = getPlanLimits($lic['plan'] ?? 'Pro', $lic);
        $maxRecipients = (int)($lic['max_recipients'] ?? $planLimits['max_recipients']);
        $availableSlots = max(0, $maxRecipients - $currentTotal);

        if ($availableSlots <= 0) {
            sendJson([
                'ok' => false,
                'status' => 'quota_exceeded',
                'error' => "Recipient limit reached ({$currentTotal}/{$maxRecipients}). Upgrade your {$lic['plan']} plan to import more leads.",
                'quota_exceeded' => true,
                'max_recipients' => $maxRecipients,
                'current_recipients' => $currentTotal,
                'available_slots' => 0
            ], 403);
        }

        $listId = !empty($input['list_id']) ? (int)$input['list_id'] : null;
        $listName = trim($input['list_name'] ?? '');
        $listDesc = trim($input['list_description'] ?? 'Imported from Mail Flow Lead Hunter');
        $customTags = $input['tags'] ?? [];
        if (is_string($customTags)) $customTags = [$customTags];

        // Resolve or create recipient list in standalone table
        $recipientList = null;
        if ($listId) {
            $stmt = $pdo->prepare("SELECT * FROM `recipient_lists` WHERE `id` = :id AND LOWER(`email`) = :email LIMIT 1");
            $stmt->execute([':id' => $listId, ':email' => $clientEmail]);
            $recipientList = $stmt->fetch();
        }

        if (!$recipientList) {
            if (empty($listName)) $listName = 'Lead Hunter - ' . date('M d, Y');
            $stmt = $pdo->prepare("SELECT * FROM `recipient_lists` WHERE LOWER(`list_name`) = :name AND LOWER(`email`) = :email LIMIT 1");
            $stmt->execute([':name' => strtolower($listName), ':email' => $clientEmail]);
            $recipientList = $stmt->fetch();

            if (!$recipientList) {
                $insList = $pdo->prepare("INSERT INTO `recipient_lists` (`email`, `list_name`, `description`) VALUES (:email, :name, :desc)");
                $insList->execute([':email' => $clientEmail, ':name' => $listName, ':desc' => $listDesc]);
                $listId = (int)$pdo->lastInsertId();
                $recipientList = ['id' => $listId, 'list_name' => $listName];
            } else {
                $listId = (int)$recipientList['id'];
            }
        } else {
            $listId = (int)$recipientList['id'];
            $listName = $recipientList['list_name'];
        }

        $stmt = $pdo->prepare("SELECT LOWER(`email`) AS email FROM `recipients` WHERE `list_id` = :list_id");
        $stmt->execute([':list_id' => $listId]);
        $existingMap = array_flip(array_column($stmt->fetchAll(), 'email'));

        $insertedCount = 0;
        $duplicatesCount = 0;
        $batchSeen = [];
        $quotaWarning = null;

        $insStmt = $pdo->prepare("
            INSERT INTO `recipients` (`list_id`, `owner_email`, `name`, `email`, `company`, `phone`, `website`, `status`, `tags`, `metadata`)
            VALUES (:list_id, :owner_email, :name, :email, :company, :phone, :website, 'active', :tags, :metadata)
        ");

        foreach ($leads as $lead) {
            if (!is_array($lead)) continue;

            $rawEmails = $lead['emails'] ?? $lead['email'] ?? [];
            if (is_string($rawEmails)) {
                $rawEmails = array_filter(array_map('trim', explode(',', str_replace(';', ',', $rawEmails))));
            } elseif (!is_array($rawEmails)) {
                $rawEmails = [];
            }

            $validEmails = [];
            foreach ($rawEmails as $em) {
                $cleanEm = strtolower(trim((string)$em));
                if (filter_var($cleanEm, FILTER_VALIDATE_EMAIL)) $validEmails[] = $cleanEm;
            }

            if (empty($validEmails)) continue;

            $leadName = trim($lead['name'] ?? $lead['username'] ?? '');
            $leadCompany = trim($lead['company'] ?? $leadName);
            $rawPhones = $lead['phones'] ?? $lead['phone'] ?? [];
            $leadPhone = is_array($rawPhones) ? implode(', ', array_filter($rawPhones)) : (string)$rawPhones;
            $leadWebsite = trim($lead['website'] ?? $lead['url'] ?? $lead['profileUrl'] ?? '');
            if (!empty($leadWebsite) && !preg_match('~^https?://~i', $leadWebsite)) $leadWebsite = 'https://' . $leadWebsite;

            $source = $lead['source'] ?? 'lead_hunter';
            $leadTags = array_values(array_unique(array_merge($customTags, ['lead-hunter', strtolower(str_replace(' ', '-', (string)$source))])));

            $metadata = [
                'source' => $source,
                'address' => $lead['address'] ?? '',
                'rating' => $lead['rating'] ?? '',
                'socials' => $lead['socials'] ?? new stdClass(),
                'bio' => $lead['bio'] ?? '',
                'avatar_url' => $lead['image'] ?? '',
                'extracted_at' => $lead['extracted_at'] ?? date('c'),
            ];

            foreach ($validEmails as $emailAddr) {
                if (isset($existingMap[$emailAddr]) || isset($batchSeen[$emailAddr])) {
                    $duplicatesCount++;
                    continue;
                }

                if ($insertedCount >= $availableSlots) {
                    $quotaWarning = "Plan limit reached ({$maxRecipients} total). Some leads were skipped.";
                    break 2;
                }

                $batchSeen[$emailAddr] = true;

                try {
                    $insStmt->execute([
                        ':list_id' => $listId,
                        ':owner_email' => $clientEmail,
                        ':name' => mb_substr($leadName, 0, 255),
                        ':email' => $emailAddr,
                        ':company' => mb_substr($leadCompany, 0, 255),
                        ':phone' => mb_substr($leadPhone, 0, 50),
                        ':website' => !empty($leadWebsite) ? mb_substr($leadWebsite, 0, 255) : null,
                        ':tags' => json_encode($leadTags, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                        ':metadata' => json_encode($metadata, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    ]);
                    $insertedCount++;
                    $existingMap[$emailAddr] = true;
                } catch (\Throwable $e) {
                    $duplicatesCount++;
                }
            }
        }

        $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM `recipients` WHERE `list_id` = :list_id");
        $cntStmt->execute([':list_id' => $listId]);
        $totalInList = (int)$cntStmt->fetchColumn();

        $newTotalRecipients = $currentTotal + $insertedCount;
        $newAvailableSlots = max(0, $maxRecipients - $newTotalRecipients);

        // Update extraction counter
        $upd = $pdo->prepare("UPDATE `licenses` SET `total_extracted` = `total_extracted` + :cnt WHERE `id` = :id");
        $upd->execute([':cnt' => count($leads), ':id' => $lic['id']]);

        sendJson([
            'ok' => true,
            'list_id' => $listId,
            'list_name' => $listName,
            'inserted' => $insertedCount,
            'duplicates' => $duplicatesCount,
            'total_processed' => count($leads),
            'total_recipients_in_list' => $totalInList,
            'quota_warning' => $quotaWarning,
            'quota' => [
                'max_recipients' => $maxRecipients,
                'current_recipients' => $newTotalRecipients,
                'available_slots' => $newAvailableSlots,
            ]
        ]);
    }
}

// ----------------------------------------------------
// 4. Admin API Actions (Protected by X-Mail-Flow-Secret)
// ----------------------------------------------------
$providedSecret = $headers['X-Mail-Flow-Secret'] ?? $headers['x-mail-flow-secret'] ?? '';

if (empty($providedSecret) || !hash_equals($relaySecret, $providedSecret)) {
    sendJson(['ok' => false, 'error' => 'Unauthorized: Invalid secret signature.'], 401);
}

switch ($action) {
    case 'list_licenses':
        $stmt = $pdo->query("SELECT * FROM `licenses` ORDER BY `id` DESC");
        $rows = $stmt->fetchAll();
        $today = date('Y-m-d');
        $licenses = [];

        foreach ($rows as $row) {
            $email = $row['email'] ?? '';
            $expiresAt = $row['expires_at'] ?? date('Y-m-d', strtotime('+30 days'));
            $isExpired = $expiresAt < $today;
            $daysLeft = (int)((strtotime($expiresAt) - strtotime($today)) / 86400);

            $status = $row['status'] ?? 'active';
            if ($status !== 'suspended') {
                $status = $isExpired ? 'expired' : ($daysLeft <= 7 ? 'expiring_soon' : 'active');
            }

            $devStmt = $pdo->prepare("SELECT `device_id`, `last_seen` FROM `license_devices` WHERE `license_id` = :lid");
            $devStmt->execute([':lid' => $row['id']]);
            $registeredDevs = $devStmt->fetchAll();

            $licenses[] = [
                'id' => (int)$row['id'],
                'email' => $email,
                'licenseKey' => $row['license_key'],
                'status' => $status,
                'plan' => $row['plan'] ?? 'Pro',
                'maxRecipients' => (int)($row['max_recipients'] ?? 10000),
                'maxBatchLimit' => (int)($row['max_batch_limit'] ?? 500),
                'issuedAt' => $row['issued_at'],
                'expiresAt' => $expiresAt,
                'activeDevicesCount' => count($registeredDevs),
                'activeDevices' => $registeredDevs,
                'totalExtracted' => (int)($row['total_extracted'] ?? 0),
            ];
        }
        sendJson(['ok' => true, 'licenses' => $licenses]);
        break;

    case 'provision':
        $email = trim(strtolower($input['email'] ?? ''));
        $days = (int)($input['days'] ?? 30);
        $plan = $input['plan'] ?? 'Pro';
        $maxRec = isset($input['max_recipients']) ? (int)$input['max_recipients'] : 10000;
        $maxBatch = isset($input['max_batch_limit']) ? (int)$input['max_batch_limit'] : 500;
        $customKey = trim($input['license_key'] ?? '');

        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            sendJson(['ok' => false, 'error' => 'Invalid email address.'], 400);
        }

        $key = !empty($customKey) ? $customKey : sprintf('MF-LH-%s-%s-%s', strtoupper(bin2hex(random_bytes(2))), strtoupper(bin2hex(random_bytes(2))), strtoupper(bin2hex(random_bytes(2))));
        $issuedAt = date('Y-m-d');
        $expiresAt = trim($input['expires_at'] ?? '') ?: date('Y-m-d', strtotime("+{$days} days"));

        $stmt = $pdo->prepare("
            INSERT INTO `licenses` (`email`, `license_key`, `status`, `plan`, `max_recipients`, `max_batch_limit`, `issued_at`, `expires_at`)
            VALUES (:email, :key, 'active', :plan, :max_rec, :max_batch, :issued_at, :expires_at)
            ON DUPLICATE KEY UPDATE `expires_at` = :expires_at_upd, `status` = 'active', `plan` = :plan_upd, `max_recipients` = :max_rec_upd, `max_batch_limit` = :max_batch_upd, `updated_at` = CURRENT_TIMESTAMP
        ");
        $stmt->execute([
            ':email' => $email, ':key' => $key, ':plan' => $plan, ':max_rec' => $maxRec, ':max_batch' => $maxBatch,
            ':issued_at' => $issuedAt, ':expires_at' => $expiresAt,
            ':expires_at_upd' => $expiresAt, ':plan_upd' => $plan, ':max_rec_upd' => $maxRec, ':max_batch_upd' => $maxBatch
        ]);

        sendJson([
            'ok' => true,
            'message' => 'License provisioned successfully.',
            'license_key' => $key,
            'email' => $email,
            'plan' => $plan,
            'max_recipients' => $maxRec,
            'max_batch_limit' => $maxBatch,
            'expires_at' => $expiresAt
        ]);
        break;

    case 'update_limits':
        $key = trim($input['license_key'] ?? '');
        $email = trim(strtolower($input['email'] ?? ''));
        $maxRec = isset($input['max_recipients']) ? (int)$input['max_recipients'] : null;
        $maxBatch = isset($input['max_batch_limit']) ? (int)$input['max_batch_limit'] : null;
        $plan = trim($input['plan'] ?? '');

        if (empty($key) && empty($email)) {
            sendJson(['ok' => false, 'error' => 'License key or email required.'], 400);
        }

        $fields = [];
        $params = [];
        if ($maxRec !== null && $maxRec > 0) {
            $fields[] = "`max_recipients` = :max_rec";
            $params[':max_rec'] = $maxRec;
        }
        if ($maxBatch !== null && $maxBatch > 0) {
            $fields[] = "`max_batch_limit` = :max_batch";
            $params[':max_batch'] = $maxBatch;
        }
        if (!empty($plan)) {
            $fields[] = "`plan` = :plan";
            $params[':plan'] = $plan;
        }

        if (empty($fields)) {
            sendJson(['ok' => false, 'error' => 'No limit fields provided to update.'], 400);
        }

        $whereClause = !empty($key) ? "`license_key` = :where_key" : "LOWER(`email`) = :where_email";
        if (!empty($key)) $params[':where_key'] = $key;
        else $params[':where_email'] = $email;

        $sql = "UPDATE `licenses` SET " . implode(', ', $fields) . ", `updated_at` = CURRENT_TIMESTAMP WHERE " . $whereClause;
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        sendJson([
            'ok' => true,
            'message' => 'License limits updated successfully.',
            'max_recipients' => $maxRec,
            'max_batch_limit' => $maxBatch,
            'plan' => $plan
        ]);
        break;

    case 'extend':
        $key = trim($input['license_key'] ?? '');
        $days = (int)($input['days'] ?? 30);
        $stmt = $pdo->prepare("UPDATE `licenses` SET `expires_at` = DATE_ADD(GREATEST(`expires_at`, CURDATE()), INTERVAL :days DAY), `status` = 'active' WHERE `license_key` = :key");
        $stmt->execute([':days' => $days, ':key' => $key]);
        sendJson(['ok' => true, 'message' => "License extended by +{$days} days."]);
        break;

    case 'suspend':
        $key = trim($input['license_key'] ?? '');
        $stmt = $pdo->prepare("UPDATE `licenses` SET `status` = 'suspended' WHERE `license_key` = :key");
        $stmt->execute([':key' => $key]);
        sendJson(['ok' => true, 'message' => 'License suspended.']);
        break;

    case 'activate':
        $key = trim($input['license_key'] ?? '');
        $stmt = $pdo->prepare("UPDATE `licenses` SET `status` = 'active' WHERE `license_key` = :key");
        $stmt->execute([':key' => $key]);
        sendJson(['ok' => true, 'message' => 'License activated.']);
        break;

    case 'reset_hwid':
    case 'clear_devices':
        $key = trim($input['license_key'] ?? '');
        $stmt = $pdo->prepare("SELECT `id` FROM `licenses` WHERE `license_key` = :key");
        $stmt->execute([':key' => $key]);
        $lic = $stmt->fetch();
        if ($lic) {
            $del = $pdo->prepare("DELETE FROM `license_devices` WHERE `license_id` = :lid");
            $del->execute([':lid' => $lic['id']]);
        }
        sendJson(['ok' => true, 'message' => 'All active device bindings reset.']);
        break;

    case 'delete':
        $key = trim($input['license_key'] ?? '');
        $stmt = $pdo->prepare("DELETE FROM `licenses` WHERE `license_key` = :key");
        $stmt->execute([':key' => $key]);
        sendJson(['ok' => true, 'message' => 'License deleted successfully.']);
        break;

    default:
        sendJson(['ok' => false, 'error' => 'Unknown action.'], 400);
        break;
}
