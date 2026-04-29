<?php
/**
 * Qira'ah - Server-Side Session & CSRF Manager
 * SECURITY: sessions HTTP-only, SameSite=Strict, CSRF via double-submit token
 */

require_once __DIR__ . '/config.php';

// ─── Session configuration (avant session_start) ───
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_strict_mode', '1');
ini_set('session.cookie_secure',   isset($_SERVER['HTTPS']) ? '1' : '0');
ini_set('session.gc_maxlifetime',  3600);     // 1h
ini_set('session.use_only_cookies','1');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ─── Session user helpers ───

function sessionLogin(string $username, string $role): void {
    // Validate before storing
    if (!preg_match('/^[a-zA-Z0-9 \-\']{2,50}$/', $username)) {
        jsonError('Nom d\'utilisateur invalide', 400);
    }
    if (!in_array($role, ['learner', 'reviewer'], true)) {
        jsonError('Rôle invalide', 400);
    }

    session_regenerate_id(true); // Prevent session fixation

    $_SESSION['user']       = $username;
    $_SESSION['role']       = $role;
    $_SESSION['created_at'] = time();
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

function sessionLogout(): void {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 3600,
            $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

function sessionUser(): ?array {
    if (!isset($_SESSION['user'], $_SESSION['role'])) return null;
    // Expire after 1h of inactivity
    if (isset($_SESSION['created_at']) && time() - $_SESSION['created_at'] > 3600) {
        sessionLogout();
        return null;
    }
    return [
        'username' => $_SESSION['user'],
        'role'     => $_SESSION['role'],
    ];
}

function requireAuth(): array {
    $user = sessionUser();
    if (!$user) jsonError('Non authentifié', 401);
    return $user;
}

function requireRole(string $role): array {
    $user = requireAuth();
    if ($user['role'] !== $role) jsonError('Accès interdit', 403);
    return $user;
}

// ─── CSRF ───

function getCsrfToken(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCsrf(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN']
          ?? $_POST['csrf_token']
          ?? '';
    if (empty($token) || !isset($_SESSION['csrf_token'])) {
        jsonError('Token CSRF manquant', 403);
    }
    if (!hash_equals($_SESSION['csrf_token'], $token)) {
        jsonError('Token CSRF invalide', 403);
    }
}

// ─── Rate limiting (simple, en session) ───
function rateLimit(string $key, int $maxAttempts = 10, int $windowSec = 60): void {
    $rlKey = 'rl_' . $key;
    $now   = time();
    if (!isset($_SESSION[$rlKey])) {
        $_SESSION[$rlKey] = ['count' => 0, 'window_start' => $now];
    }
    $rl = &$_SESSION[$rlKey];
    if ($now - $rl['window_start'] > $windowSec) {
        $rl = ['count' => 0, 'window_start' => $now];
    }
    $rl['count']++;
    if ($rl['count'] > $maxAttempts) {
        http_response_code(429);
        header('Retry-After: ' . ($windowSec - ($now - $rl['window_start'])));
        jsonError('Trop de tentatives, réessayez dans un moment', 429);
    }
}
