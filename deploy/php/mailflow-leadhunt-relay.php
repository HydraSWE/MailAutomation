<?php
declare(strict_types=1);

require __DIR__ . '/../mailflow-config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Mail-Flow-Secret, X-Mail-Flow-Signature, X-Mail-Flow-Timestamp');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond(int $statusCode, array $payload): never
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function get_db_connection(): PDO
{
    $host = defined('MAILFLOW_LEADHUNT_DB_HOST') ? MAILFLOW_LEADHUNT_DB_HOST : 'localhost';
    $port = defined('MAILFLOW_LEADHUNT_DB_PORT') ? MAILFLOW_LEADHUNT_DB_PORT : 3306;
    $dbName = defined('MAILFLOW_LEADHUNT_DB_NAME') ? MAILFLOW_LEADHUNT_DB_NAME : '';
    $user = defined('MAILFLOW_LEADHUNT_DB_USER') ? MAILFLOW_LEADHUNT_DB_USER : '';
    $pass = defined('MAILFLOW_LEADHUNT_DB_PASS') ? MAILFLOW_LEADHUNT_DB_PASS : '';

    $dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
        
        // Auto-create table if not exists
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `mailflow_leadhunt_licenses` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `email` VARCHAR(255) NOT NULL UNIQUE,
                `plan` VARCHAR(50) DEFAULT 'Pro',
                `status` ENUM('active', 'expired', 'suspended') DEFAULT 'active',
                `device_id` VARCHAR(120) DEFAULT NULL,
                `expire_date` DATETIME NOT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX (`email`),
                INDEX (`status`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        return $pdo;
    } catch (PDOException $e) {
        respond(500, [
            'status' => 'error',
            'message' => 'Database connection failed. Please verify credentials in mailflow-config.php.'
        ]);
    }
}

// -------------------------------------------------------------------------
// 1. EXTENSION LICENSE VERIFICATION (GET)
// -------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $email = strtolower(trim((string)($_GET['email'] ?? '')));
    $deviceId = trim((string)($_GET['deviceId'] ?? ''));

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(400, ['status' => 'invalid_email', 'message' => 'Valid email is required.']);
    }

    $db = get_db_connection();
    $stmt = $db->prepare("SELECT * FROM `mailflow_leadhunt_licenses` WHERE `email` = :email LIMIT 1");
    $stmt->execute([':email' => $email]);
    $license = $stmt->fetch();

    if (!$license) {
        respond(200, ['status' => 'not_found']);
    }

    // Check expiration
    $now = new DateTime('now', new DateTimeZone('UTC'));
    $expireDate = new DateTime($license['expire_date'], new DateTimeZone('UTC'));

    if ($license['status'] === 'suspended') {
        respond(200, ['status' => 'expired', 'message' => 'Subscription suspended.']);
    }

    if ($license['status'] === 'expired' || $expireDate < $now) {
        if ($license['status'] !== 'expired') {
            $upd = $db->prepare("UPDATE `mailflow_leadhunt_licenses` SET `status` = 'expired' WHERE `id` = :id");
            $upd->execute([':id' => $license['id']]);
        }
        respond(200, ['status' => 'expired']);
    }

    // Device ID Lock Check
    $storedDeviceId = (string)($license['device_id'] ?? '');

    if ($storedDeviceId === '' || $storedDeviceId === null) {
        // First activation: bind this device ID
        if ($deviceId !== '') {
            $upd = $db->prepare("UPDATE `mailflow_leadhunt_licenses` SET `device_id` = :device_id, `updated_at` = NOW() WHERE `id` = :id");
            $upd->execute([':device_id' => $deviceId, ':id' => $license['id']]);
        }
        respond(200, [
            'status' => 'success',
            'plan' => $license['plan'] ?: 'Pro',
            'expireDate' => $expireDate->format('c')
        ]);
    }

    if ($deviceId !== '' && $storedDeviceId === $deviceId) {
        respond(200, [
            'status' => 'success',
            'plan' => $license['plan'] ?: 'Pro',
            'expireDate' => $expireDate->format('c')
        ]);
    }

    // Device mismatch
    respond(200, ['status' => 'device_locked']);
}

// -------------------------------------------------------------------------
// 2. BACKEND PROVISIONING & MANAGEMENT (POST)
// -------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $providedSecret = (string)($_SERVER['HTTP_X_MAIL_FLOW_SECRET'] ?? '');
    $validSecret = defined('MAILFLOW_LEADHUNT_RELAY_SECRET') 
        ? MAILFLOW_LEADHUNT_RELAY_SECRET 
        : (defined('MAILFLOW_RELAY_SECRET') ? MAILFLOW_RELAY_SECRET : '');

    if ($validSecret === '' || !hash_equals($validSecret, $providedSecret)) {
        respond(401, ['ok' => false, 'message' => 'Unauthorized: Invalid relay secret.']);
    }

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        respond(400, ['ok' => false, 'message' => 'Invalid JSON payload.']);
    }

    $action = (string)($data['action'] ?? 'provision');
    $email = strtolower(trim((string)($data['email'] ?? '')));

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(400, ['ok' => false, 'message' => 'Valid email is required.']);
    }

    $db = get_db_connection();

    if ($action === 'provision') {
        $plan = trim((string)($data['plan'] ?? 'Pro'));
        $days = (int)($data['days'] ?? 30);
        $resetDevice = !empty($data['reset_device']);

        $expire = new DateTime('now', new DateTimeZone('UTC'));
        $expire->modify("+{$days} days");
        $expireFormatted = $expire->format('Y-m-d H:i:s');

        $stmt = $db->prepare("SELECT id FROM `mailflow_leadhunt_licenses` WHERE `email` = :email LIMIT 1");
        $stmt->execute([':email' => $email]);
        $existing = $stmt->fetch();

        if ($existing) {
            $sql = "UPDATE `mailflow_leadhunt_licenses` SET `plan` = :plan, `status` = 'active', `expire_date` = :expire_date";
            if ($resetDevice) {
                $sql .= ", `device_id` = NULL";
            }
            $sql .= " WHERE `id` = :id";
            $upd = $db->prepare($sql);
            $upd->execute([
                ':plan' => $plan,
                ':expire_date' => $expireFormatted,
                ':id' => $existing['id']
            ]);
        } else {
            $ins = $db->prepare("
                INSERT INTO `mailflow_leadhunt_licenses` (`email`, `plan`, `status`, `expire_date`) 
                VALUES (:email, :plan, 'active', :expire_date)
            ");
            $ins->execute([
                ':email' => $email,
                ':plan' => $plan,
                ':expire_date' => $expireFormatted
            ]);
        }

        respond(200, [
            'ok' => true,
            'message' => "License successfully provisioned for {$email}",
            'expire_date' => $expire->format('c')
        ]);
    }

    if ($action === 'reset_device') {
        $upd = $db->prepare("UPDATE `mailflow_leadhunt_licenses` SET `device_id` = NULL WHERE `email` = :email");
        $upd->execute([':email' => $email]);
        respond(200, ['ok' => true, 'message' => "Device lock reset for {$email}."]);
    }

    if ($action === 'revoke') {
        $upd = $db->prepare("UPDATE `mailflow_leadhunt_licenses` SET `status` = 'expired' WHERE `email` = :email");
        $upd->execute([':email' => $email]);
        respond(200, ['ok' => true, 'message' => "License revoked for {$email}."]);
    }

    respond(400, ['ok' => false, 'message' => "Unknown action '{$action}'."]);
}

respond(405, ['status' => 'method_not_allowed']);
