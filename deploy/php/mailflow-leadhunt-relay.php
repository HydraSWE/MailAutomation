<?php
declare(strict_types=1);

/**
 * Mail Flow - Lead Hunter Central Management & Authentication Relay
 * Reads configuration from upper-level `mailflow-config.php`
 */

if (file_exists(__DIR__ . '/../mailflow-config.php')) {
    require_once __DIR__ . '/../mailflow-config.php';
} elseif (file_exists(__DIR__ . '/mailflow-config.php')) {
    require_once __DIR__ . '/mailflow-config.php';
}

error_reporting(0);
ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');

function sendJson(array $data, int $statusCode = 200): void {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// Global exception/fatal error handler to prevent empty HTTP 500s
set_exception_handler(function (\Throwable $e) {
    sendJson([
        'ok' => false,
        'status' => 'error',
        'error' => 'Server Error: ' . $e->getMessage() . ' on line ' . $e->getLine()
    ], 200);
});

register_shutdown_function(function () {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        sendJson([
            'ok' => false,
            'status' => 'fatal_error',
            'error' => 'Fatal Error: ' . $error['message'] . ' on line ' . $error['line']
        ], 200);
    }
});

// Read configuration from upper-level config constants
$dbHost = defined('MAILFLOW_LEADHUNT_DB_HOST') ? MAILFLOW_LEADHUNT_DB_HOST : (defined('MAILFLOW_DB_HOST') ? MAILFLOW_DB_HOST : 'localhost');
$dbPort = defined('MAILFLOW_LEADHUNT_DB_PORT') ? (int)MAILFLOW_LEADHUNT_DB_PORT : (defined('MAILFLOW_DB_PORT') ? (int)MAILFLOW_DB_PORT : 3306);
$dbName = defined('MAILFLOW_LEADHUNT_DB_NAME') ? MAILFLOW_LEADHUNT_DB_NAME : (defined('MAILFLOW_DB_NAME') ? MAILFLOW_DB_NAME : 'annomous_mailflow_lead_hunter');
$dbUser = defined('MAILFLOW_LEADHUNT_DB_USER') ? MAILFLOW_LEADHUNT_DB_USER : (defined('MAILFLOW_DB_USER') ? MAILFLOW_DB_USER : 'annomous_rayhan');
$dbPass = defined('MAILFLOW_LEADHUNT_DB_PASS') ? MAILFLOW_LEADHUNT_DB_PASS : (defined('MAILFLOW_DB_PASS') ? MAILFLOW_DB_PASS : '');
$relaySecret = defined('MAILFLOW_LEADHUNT_RELAY_SECRET') 
    ? MAILFLOW_LEADHUNT_RELAY_SECRET 
    : (defined('MAILFLOW_RELAY_SECRET') ? MAILFLOW_RELAY_SECRET : (defined('MAILFLOW_OTP_RELAY_SECRET') ? MAILFLOW_OTP_RELAY_SECRET : ''));

// Connect to MySQL Database
try {
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $dbHost, $dbPort, $dbName);
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => true,
    ]);

    // Ensure licenses table exists
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `licenses` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `email` VARCHAR(255) NOT NULL,
            `license_key` VARCHAR(64) NOT NULL UNIQUE,
            `status` ENUM('active', 'expiring_soon', 'expired', 'suspended') DEFAULT 'active',
            `plan` VARCHAR(64) DEFAULT 'Pro',
            `device_id` VARCHAR(128) DEFAULT NULL,
            `device_locked` TINYINT(1) DEFAULT 0,
            `total_extracted` INT DEFAULT 0,
            `issued_at` DATE NOT NULL,
            `expires_at` DATE NOT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX (`email`),
            INDEX (`license_key`),
            INDEX (`status`)
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

} catch (\Throwable $e) {
    sendJson([
        'ok' => false,
        'status' => 'db_error',
        'error' => 'Database Connection Error: ' . $e->getMessage()
    ], 200);
}

// 2. Handle GET verification (from Chrome Extension login / startup)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $query = trim($_GET['email'] ?? $_GET['key'] ?? $_GET['license_key'] ?? '');
    $deviceId = trim($_GET['deviceId'] ?? $_GET['device_id'] ?? '');

    if (empty($query)) {
        sendJson(['ok' => false, 'status' => 'not_found', 'error' => 'Email or license key required.'], 400);
    }

    $stmt = $pdo->prepare("
        SELECT * FROM `licenses` 
        WHERE LOWER(`email`) = :q1 OR LOWER(`license_key`) = :q2 
        ORDER BY `id` DESC LIMIT 1
    ");
    $stmt->execute([
        ':q1' => strtolower($query),
        ':q2' => strtolower($query)
    ]);
    $lic = $stmt->fetch();

    if (!$lic) {
        if (filter_var($query, FILTER_VALIDATE_EMAIL)) {
            // Auto-provision 30 days active license for existing/live Mail Flow user
            $autoKey = sprintf(
                'MF-LH-%s-%s-%s',
                strtoupper(substr(bin2hex(random_bytes(2)), 0, 4)),
                strtoupper(substr(bin2hex(random_bytes(2)), 0, 4)),
                strtoupper(substr(bin2hex(random_bytes(2)), 0, 4))
            );
            $issuedAt = date('Y-m-d');
            $expiresAt = date('Y-m-d', strtotime('+30 days'));

            $ins = $pdo->prepare("
                INSERT INTO `licenses` (`email`, `license_key`, `status`, `plan`, `issued_at`, `expires_at`, `device_id`, `device_locked`)
                VALUES (:email, :key, 'active', 'Pro', :issued_at, :expires_at, :dev, :dev_locked)
            ");
            $ins->execute([
                ':email' => strtolower($query),
                ':key' => $autoKey,
                ':issued_at' => $issuedAt,
                ':expires_at' => $expiresAt,
                ':dev' => !empty($deviceId) ? $deviceId : null,
                ':dev_locked' => !empty($deviceId) ? 1 : 0
            ]);

            sendJson([
                'ok' => true,
                'status' => 'active',
                'email' => strtolower($query),
                'plan' => 'Pro',
                'licenseKey' => $autoKey,
                'expireDate' => $expiresAt,
                'daysLeft' => 30,
                'auto_provisioned' => true
            ]);
        } else {
            sendJson(['ok' => false, 'status' => 'not_found', 'error' => 'No active Lead Hunter license found for this key.'], 404);
        }
    }

    if ($lic['status'] === 'suspended') {
        sendJson(['ok' => false, 'status' => 'suspended', 'error' => 'Account access has been suspended. Please contact support.'], 403);
    }

    $today = date('Y-m-d');
    if ($lic['expires_at'] < $today) {
        sendJson(['ok' => false, 'status' => 'expired', 'error' => 'Your subscription has expired. Please renew to continue.'], 403);
    }

    // Hardware lock verification
    if (!empty($deviceId)) {
        if (empty($lic['device_id'])) {
            $upd = $pdo->prepare("UPDATE `licenses` SET `device_id` = :dev, `device_locked` = 1 WHERE `id` = :id");
            $upd->execute([':dev' => $deviceId, ':id' => $lic['id']]);
        } elseif ($lic['device_locked'] && $lic['device_id'] !== $deviceId) {
            sendJson([
                'ok' => false,
                'status' => 'device_locked',
                'error' => 'This account is linked to another computer. Single-device access is enforced.'
            ], 403);
        }
    }

    sendJson([
        'ok' => true,
        'status' => 'active',
        'email' => $lic['email'],
        'plan' => $lic['plan'] ?? 'Pro',
        'licenseKey' => $lic['license_key'],
        'expireDate' => $lic['expires_at'],
        'daysLeft' => (int)((strtotime($lic['expires_at']) - strtotime($today)) / 86400)
    ]);
}

// Helper to query Mail Flow Django REST Backend
function forwardToDjangoBackend(string $endpoint, array $payload, string $secret, string $method = 'POST'): array {
    $backendBase = defined('MAILFLOW_BACKEND_API_URL') 
        ? rtrim(MAILFLOW_BACKEND_API_URL, '/') 
        : (defined('MAILFLOW_API_URL') ? rtrim(MAILFLOW_API_URL, '/') : '');
    
    if (empty($backendBase)) {
        return ['ok' => false, 'error' => 'MAILFLOW_BACKEND_API_URL is not configured in mailflow-config.php'];
    }

    $cleanEndpoint = ltrim($endpoint, '/');
    if (!str_starts_with($cleanEndpoint, 'api/')) {
        $cleanEndpoint = 'api/' . $cleanEndpoint;
    }
    $url = $backendBase . '/' . $cleanEndpoint;

    $ch = curl_init($url);
    $headers = [
        'Content-Type: application/json',
        'X-Mail-Flow-Secret: ' . $secret
    ];
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    } else {
        curl_setopt($ch, CURLOPT_HTTPGET, true);
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || empty($response)) {
        return ['ok' => false, 'error' => 'Could not reach Mail Flow backend server.', 'http_code' => $httpCode];
    }

    $decoded = json_decode($response, true);
    if (is_array($decoded)) {
        return $decoded;
    }
    return ['ok' => false, 'error' => 'Invalid backend response.', 'raw' => $response, 'http_code' => $httpCode];
}

function verifyClientLicense(PDO $pdo, string $email, string $deviceId = ''): array {
    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'error' => 'Valid account email is required.'];
    }
    $stmt = $pdo->prepare("SELECT * FROM `licenses` WHERE LOWER(`email`) = :email ORDER BY `id` DESC LIMIT 1");
    $stmt->execute([':email' => strtolower($email)]);
    $lic = $stmt->fetch();
    if (!$lic) {
        return ['ok' => false, 'error' => 'No active Mail Flow Lead Hunter subscription found for this email.'];
    }
    if ($lic['status'] === 'suspended') {
        return ['ok' => false, 'error' => 'Account access has been suspended. Please contact support.'];
    }
    if ($lic['expires_at'] < date('Y-m-d')) {
        return ['ok' => false, 'error' => 'Your Mail Flow subscription has expired. Please renew to continue.'];
    }
    if (!empty($deviceId) && !empty($lic['device_id']) && $lic['device_locked'] && $lic['device_id'] !== $deviceId) {
        return ['ok' => false, 'error' => 'This account is linked to another machine. Single-device access is enforced.'];
    }
    return ['ok' => true, 'license' => $lic];
}

// 3. Parse JSON Body
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $input['action'] ?? '';

// Handle Client-facing actions (authenticated via email & active license)
if (in_array($action, ['push_leads', 'get_recipient_lists', 'verify_license'])) {
    $clientEmail = trim(strtolower($input['email'] ?? ''));
    $clientDevice = trim($input['deviceId'] ?? $input['device_id'] ?? '');

    $clientAuth = verifyClientLicense($pdo, $clientEmail, $clientDevice);
    if (!$clientAuth['ok']) {
        sendJson($clientAuth, 403);
    }

    if ($action === 'get_recipient_lists') {
        if (defined('MAILFLOW_BACKEND_API_URL') && !empty(MAILFLOW_BACKEND_API_URL)) {
            $backendResp = forwardToDjangoBackend('api/recipient-lists/summary/?email=' . urlencode($clientEmail), [], $relaySecret, 'GET');
            if (!empty($backendResp) && !empty($backendResp['ok'])) {
                sendJson($backendResp);
            }
        }

        // Direct MySQL Query
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

        // Update statistics
        $countExtracted = count($leads);
        $upd = $pdo->prepare("UPDATE `licenses` SET `total_extracted` = `total_extracted` + :cnt WHERE `id` = :id");
        $upd->execute([':cnt' => $countExtracted, ':id' => $clientAuth['license']['id']]);

        // If Django backend is explicitly configured, attempt forward
        if (defined('MAILFLOW_BACKEND_API_URL') && !empty(MAILFLOW_BACKEND_API_URL)) {
            $backendResp = forwardToDjangoBackend('api/recipients/push_leads/', $input, $relaySecret, 'POST');
            if (!empty($backendResp) && !empty($backendResp['ok'])) {
                sendJson($backendResp);
            }
        }

        // Direct MySQL Insertion
        $listId = !empty($input['list_id']) ? (int)$input['list_id'] : null;
        $listName = trim($input['list_name'] ?? '');
        $listDesc = trim($input['list_description'] ?? 'Imported from Mail Flow Lead Hunter');
        $customTags = $input['tags'] ?? [];
        if (is_string($customTags)) $customTags = [$customTags];

        // 1. Resolve or create recipient list
        $recipientList = null;
        if ($listId) {
            $stmt = $pdo->prepare("SELECT * FROM `recipient_lists` WHERE `id` = :id AND LOWER(`email`) = :email LIMIT 1");
            $stmt->execute([':id' => $listId, ':email' => $clientEmail]);
            $recipientList = $stmt->fetch();
        }

        if (!$recipientList) {
            if (empty($listName)) {
                $listName = 'Lead Hunter - ' . date('M d, Y');
            }
            // Check if list with this name exists for this user
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

        // 2. Fetch existing emails in this list for in-memory deduplication
        $stmt = $pdo->prepare("SELECT LOWER(`email`) AS email FROM `recipients` WHERE `list_id` = :list_id");
        $stmt->execute([':list_id' => $listId]);
        $existingEmails = array_column($stmt->fetchAll(), 'email');
        $existingMap = array_flip($existingEmails);

        $insertedCount = 0;
        $duplicatesCount = 0;
        $batchSeen = [];

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
                if (filter_var($cleanEm, FILTER_VALIDATE_EMAIL)) {
                    $validEmails[] = $cleanEm;
                }
            }

            if (empty($validEmails)) continue;

            $leadName = trim($lead['name'] ?? $lead['username'] ?? '');
            $leadCompany = trim($lead['company'] ?? $leadName);

            $rawPhones = $lead['phones'] ?? $lead['phone'] ?? [];
            $leadPhone = is_array($rawPhones) ? implode(', ', array_filter($rawPhones)) : (string)$rawPhones;

            $leadWebsite = trim($lead['website'] ?? $lead['url'] ?? $lead['profileUrl'] ?? '');
            if (!empty($leadWebsite) && !preg_match('~^https?://~i', $leadWebsite)) {
                $leadWebsite = 'https://' . $leadWebsite;
            }

            $source = $lead['source'] ?? 'lead_hunter';
            $leadTags = array_values(array_unique(array_merge($customTags, ['lead-hunter', strtolower(str_replace(' ', '-', (string)$source))])));
            if (!empty($lead['tags']) && is_array($lead['tags'])) {
                $leadTags = array_values(array_unique(array_merge($leadTags, $lead['tags'])));
            }

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

        // Get total count in list
        $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM `recipients` WHERE `list_id` = :list_id");
        $cntStmt->execute([':list_id' => $listId]);
        $totalInList = (int)$cntStmt->fetchColumn();

        sendJson([
            'ok' => true,
            'list_id' => $listId,
            'list_name' => $listName,
            'inserted' => $insertedCount,
            'duplicates' => $duplicatesCount,
            'total_processed' => count($leads),
            'total_recipients_in_list' => $totalInList
        ]);
    }

    if ($action === 'verify_license') {
        sendJson([
            'ok' => true,
            'email' => $clientAuth['license']['email'],
            'plan' => $clientAuth['license']['plan'] ?? 'Pro',
            'expires_at' => $clientAuth['license']['expires_at'],
            'status' => 'active'
        ]);
    }
}

// 4. For Administrative actions, verify the Admin Secret Header
$headers = getallheaders();
$providedSecret = $headers['X-Mail-Flow-Secret'] ?? $headers['x-mail-flow-secret'] ?? '';

if (empty($providedSecret) || !hash_equals($relaySecret, $providedSecret)) {
    sendJson(['ok' => false, 'error' => 'Unauthorized: Invalid secret signature.'], 401);
}

switch ($action) {
    // -------------------------------------------------------------
    // Action: LIST ALL LICENSES (For Admin Panel)
    // -------------------------------------------------------------
    case 'list_licenses':
        $stmt = $pdo->query("SELECT * FROM `licenses` ORDER BY `id` DESC");
        $rows = $stmt->fetchAll();
        $today = date('Y-m-d');

        $licenses = [];
        foreach ($rows as $row) {
            $email = $row['email'] ?? $row['user_email'] ?? '';
            $key = $row['license_key'] ?? $row['license'] ?? $row['key'] ?? '';
            $expiresAt = $row['expires_at'] ?? $row['expiry_date'] ?? $row['expire_date'] ?? $row['valid_until'] ?? date('Y-m-d', strtotime('+30 days'));
            $issuedAt = !empty($row['issued_at']) ? substr($row['issued_at'], 0, 10) : (!empty($row['created_at']) ? substr($row['created_at'], 0, 10) : date('Y-m-d'));
            
            $isExpired = $expiresAt < $today;
            $daysLeft = (int)((strtotime($expiresAt) - strtotime($today)) / 86400);

            $status = $row['status'] ?? (isset($row['is_active']) ? ($row['is_active'] ? 'active' : 'suspended') : 'active');
            if ($status !== 'suspended') {
                if ($isExpired) {
                    $status = 'expired';
                } elseif ($daysLeft <= 7) {
                    $status = 'expiring_soon';
                } else {
                    $status = 'active';
                }
            }

            $licenses[] = [
                'id' => (int)$row['id'],
                'email' => $email,
                'licenseKey' => $key,
                'status' => $status,
                'plan' => $row['plan'] ?? 'Pro',
                'issuedAt' => $issuedAt,
                'expiresAt' => $expiresAt,
                'deviceLocked' => !empty($row['device_locked']),
                'deviceId' => $row['device_id'] ?? null,
                'totalExtracted' => (int)($row['total_extracted'] ?? 0),
            ];
        }

        sendJson(['ok' => true, 'licenses' => $licenses]);
        break;

    // -------------------------------------------------------------
    // Action: PROVISION / ISSUE NEW LICENSE
    // -------------------------------------------------------------
    case 'provision':
        $email = trim(strtolower($input['email'] ?? ''));
        $days = (int)($input['days'] ?? 30);
        $plan = $input['plan'] ?? 'Pro';
        $customKey = trim($input['license_key'] ?? '');

        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            sendJson(['ok' => false, 'error' => 'Invalid email address.'], 400);
        }

        // Generate key if not provided
        $key = !empty($customKey) ? $customKey : sprintf(
            'MF-LH-%s-%s-%s',
            strtoupper(substr(bin2hex(random_bytes(2)), 0, 4)),
            strtoupper(substr(bin2hex(random_bytes(2)), 0, 4)),
            strtoupper(substr(bin2hex(random_bytes(2)), 0, 4))
        );

        $explicitExpiry = trim($input['expires_at'] ?? '');
        $issuedAt = date('Y-m-d');
        $expiresAt = !empty($explicitExpiry) ? $explicitExpiry : date('Y-m-d', strtotime("+{$days} days"));

        $stmt = $pdo->prepare("
            INSERT INTO `licenses` (`email`, `license_key`, `status`, `plan`, `issued_at`, `expires_at`)
            VALUES (:email, :key, 'active', :plan, :issued_at, :expires_at)
            ON DUPLICATE KEY UPDATE
                `expires_at` = :expires_at_upd,
                `status` = 'active',
                `plan` = :plan_upd,
                `updated_at` = CURRENT_TIMESTAMP
        ");
        $stmt->execute([
            ':email' => $email,
            ':key' => $key,
            ':plan' => $plan,
            ':issued_at' => $issuedAt,
            ':expires_at' => $expiresAt,
            ':expires_at_upd' => $expiresAt,
            ':plan_upd' => $plan,
        ]);

        sendJson([
            'ok' => true,
            'message' => 'License provisioned successfully.',
            'license_key' => $key,
            'email' => $email,
            'expires_at' => $expiresAt
        ]);
        break;

    // -------------------------------------------------------------
    // Action: EXTEND SUBSCRIPTION (+X DAYS)
    // -------------------------------------------------------------
    case 'extend':
        $key = trim($input['license_key'] ?? '');
        $days = (int)($input['days'] ?? 30);

        if (empty($key)) {
            sendJson(['ok' => false, 'error' => 'License key is required.'], 400);
        }

        $stmt = $pdo->prepare("
            UPDATE `licenses`
            SET `expires_at` = DATE_ADD(GREATEST(`expires_at`, CURDATE()), INTERVAL :days DAY),
                `status` = 'active'
            WHERE `license_key` = :key
        ");
        $stmt->execute([':days' => $days, ':key' => $key]);

        sendJson(['ok' => true, 'message' => "License extended by +{$days} days."]);
        break;

    // -------------------------------------------------------------
    // Action: SUSPEND LICENSE
    // -------------------------------------------------------------
    case 'suspend':
        $key = trim($input['license_key'] ?? '');
        $stmt = $pdo->prepare("UPDATE `licenses` SET `status` = 'suspended' WHERE `license_key` = :key");
        $stmt->execute([':key' => $key]);
        sendJson(['ok' => true, 'message' => 'License suspended.']);
        break;

    // -------------------------------------------------------------
    // Action: ACTIVATE / REACTIVATE LICENSE
    // -------------------------------------------------------------
    case 'activate':
        $key = trim($input['license_key'] ?? '');
        $stmt = $pdo->prepare("UPDATE `licenses` SET `status` = 'active' WHERE `license_key` = :key");
        $stmt->execute([':key' => $key]);
        sendJson(['ok' => true, 'message' => 'License activated.']);
        break;

    // -------------------------------------------------------------
    // Action: RESET HARDWARE ID / DEVICE LOCK
    // -------------------------------------------------------------
    case 'reset_hwid':
        $key = trim($input['license_key'] ?? '');
        $stmt = $pdo->prepare("UPDATE `licenses` SET `device_id` = NULL, `device_locked` = 0 WHERE `license_key` = :key");
        $stmt->execute([':key' => $key]);
        sendJson(['ok' => true, 'message' => 'Device lock reset. User can now bind a new machine.']);
        break;

    // -------------------------------------------------------------
    // Action: DELETE / REVOKE LICENSE
    // -------------------------------------------------------------
    case 'delete':
        $key = trim($input['license_key'] ?? '');
        $stmt = $pdo->prepare("DELETE FROM `licenses` WHERE `license_key` = :key");
        $stmt->execute([':key' => $key]);
        sendJson(['ok' => true, 'message' => 'License deleted successfully.']);
        break;

    // -------------------------------------------------------------
    // Action: VERIFY LICENSE (Used by Chrome Extension)
    // -------------------------------------------------------------
    case 'verify_license':
        $key = trim($input['license_key'] ?? '');
        $deviceId = trim($input['device_id'] ?? '');

        if (empty($key)) {
            sendJson(['ok' => false, 'error' => 'License key required.'], 400);
        }

        $stmt = $pdo->prepare("SELECT * FROM `licenses` WHERE `license_key` = :key LIMIT 1");
        $stmt->execute([':key' => $key]);
        $lic = $stmt->fetch();

        if (!$lic) {
            sendJson(['ok' => false, 'error' => 'Invalid license key.'], 404);
        }

        if ($lic['status'] === 'suspended') {
            sendJson(['ok' => false, 'error' => 'License has been suspended. Please contact support.'], 403);
        }

        if ($lic['expires_at'] < date('Y-m-d')) {
            sendJson(['ok' => false, 'error' => 'License has expired.'], 403);
        }

        // Hardware lock enforcement
        if (!empty($deviceId)) {
            if (empty($lic['device_id'])) {
                // Bind new device
                $upd = $pdo->prepare("UPDATE `licenses` SET `device_id` = :dev, `device_locked` = 1 WHERE `id` = :id");
                $upd->execute([':dev' => $deviceId, ':id' => $lic['id']]);
            } elseif ($lic['device_locked'] && $lic['device_id'] !== $deviceId) {
                sendJson([
                    'ok' => false,
                    'error' => 'License is locked to another machine. Please request a device reset from admin.'
                ], 403);
            }
        }

        sendJson([
            'ok' => true,
            'email' => $lic['email'],
            'plan' => $lic['plan'],
            'expires_at' => $lic['expires_at'],
            'status' => 'active'
        ]);
        break;

    default:
        sendJson(['ok' => false, 'error' => 'Unknown action.'], 400);
        break;
}
