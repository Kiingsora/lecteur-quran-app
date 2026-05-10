<?php
/**
 * Qira'ah - Configuration & Database Connection
 * SECURITY: credentials loaded from .env, never hardcoded
 */

// ─── Load .env ───
function loadEnv(string $path): void {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        [$key, $val] = array_pad(explode('=', $line, 2), 2, '');
        $key = trim($key);
        $val = trim($val);
        if ($key !== '' && !array_key_exists($key, $_ENV)) {
            $_ENV[$key] = $val;
            putenv("$key=$val");
        }
    }
}

loadEnv(__DIR__ . '/../.env');

define('DB_HOST',        $_ENV['DB_HOST'] ?? 'localhost');
define('DB_NAME',        $_ENV['DB_NAME'] ?? 'qiraah');
define('DB_USER',        $_ENV['DB_USER'] ?? 'root');
define('DB_PASS',        $_ENV['DB_PASS'] ?? '');
define('UPLOAD_DIR',     __DIR__ . '/../uploads/audio/');
define('MAX_UPLOAD_SIZE', 50 * 1024 * 1024); // 50 MB

// ─── Allowed MIME types for audio uploads ───
define('ALLOWED_AUDIO_MIMES', ['audio/webm', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4']);

// ─── PDO singleton ───
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

// ─── Output sanitization ───
function sanitize(string $str): string {
    return htmlspecialchars($str, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

// ─── Security headers (set on every response) ───
function setSecurityHeaders(): void {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; media-src 'self' blob: https://cdn.islamic.network; connect-src 'self' https://api.alquran.cloud https://cdn.islamic.network; img-src 'self' data:; object-src 'none';");
}

// ─── JSON response helpers ───
function jsonResponse(mixed $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    setSecurityHeaders();
    echo json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError(string $message, int $status = 400): void {
    // Never expose internal field names in prod
    jsonResponse(['error' => $message], $status);
}

// ─── Request body parsing ───
function getJsonBody(): array {
    $body = file_get_contents('php://input');
    if (empty($body)) {
        jsonError('Corps de requête vide', 400);
    }
    $data = json_decode($body, true);
    if (!is_array($data) || json_last_error() !== JSON_ERROR_NONE) {
        jsonError('Données invalides', 400);
    }
    return $data;
}

// ─── Required fields validation ───
function validateRequired(array $data, array $fields): void {
    foreach ($fields as $field) {
        if (!array_key_exists($field, $data) ||
            (is_string($data[$field]) && trim($data[$field]) === '')) {
            jsonError('Données manquantes', 400); // Generic: don't expose field names
        }
    }
}

// ─── Integer validation ───
function validateInt(mixed $val, int $min = 0, int $max = PHP_INT_MAX): int {
    $int = filter_var($val, FILTER_VALIDATE_INT, ['options' => ['min_range' => $min, 'max_range' => $max]]);
    if ($int === false) jsonError('Valeur numérique invalide', 400);
    return $int;
}

// ─── Float validation ───
function validateFloat(mixed $val, float $min = 0.0, float $max = 86400.0): float {
    $f = filter_var($val, FILTER_VALIDATE_FLOAT);
    if ($f === false || $f < $min || $f > $max) jsonError('Valeur décimale invalide', 400);
    return $f;
}

// ─── CSRF origin check (call in all mutating API endpoints) ───
function checkOrigin(): void {
    $origin  = $_SERVER['HTTP_ORIGIN']  ?? '';
    $referer = $_SERVER['HTTP_REFERER'] ?? '';
    $host    = $_SERVER['HTTP_HOST']    ?? '';
    // Must come from same origin
    if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== $host) {
        jsonError('Origine non autorisée', 403);
    }
    if ($origin === '' && $referer !== '' && parse_url($referer, PHP_URL_HOST) !== $host) {
        jsonError('Origine non autorisée', 403);
    }
}

// ─── File upload validation ───
function validateAudioUpload(array $file): void {
    if (!isset($file['tmp_name']) || $file['error'] !== UPLOAD_ERR_OK) {
        jsonError('Erreur lors du téléversement', 400);
    }
    if ($file['size'] > MAX_UPLOAD_SIZE) {
        jsonError('Fichier trop volumineux (max 50 Mo)', 413);
    }
    // Server-side MIME check (not trusting client-sent type)
    $mime = mime_content_type($file['tmp_name']);
    if (!in_array($mime, ALLOWED_AUDIO_MIMES, true)) {
        jsonError('Type de fichier non autorisé', 415);
    }
    // Validate filename: only alphanum, dash, underscore, dot
    if (!preg_match('/^[\w\-. ]{1,200}\.(webm|mp3|wav|ogg|m4a)$/i', $file['name'])) {
        jsonError('Nom de fichier invalide', 400);
    }
}
