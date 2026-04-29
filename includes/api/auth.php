<?php
/**
 * Qira'ah - Auth API
 * POST /php/api/auth.php        → login
 * DELETE /php/api/auth.php      → logout
 * GET /php/api/auth.php         → session status + CSRF token
 *
 * SECURITY: session côté serveur, CSRF double-submit, rate limiting
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../core/session.php';

setSecurityHeaders();
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ── GET : retourne l'état de session + token CSRF ──
if ($method === 'GET') {
    $user = sessionUser();
    jsonResponse([
        'authenticated' => $user !== null,
        'user'          => $user,
        'csrf_token'    => getCsrfToken(),
    ]);
}

// ── POST : login ──
if ($method === 'POST') {
    checkOrigin();
    rateLimit('login', 10, 60); // max 10 tentatives / minute

    $data = getJsonBody();
    validateRequired($data, ['username', 'role']);

    $username = trim((string)($data['username'] ?? ''));
    $role     = trim((string)($data['role']     ?? ''));

    // Validation stricte (même règle que JS)
    if (!preg_match('/^[a-zA-Z0-9 \-\']{2,50}$/', $username)) {
        jsonError('Nom d\'utilisateur invalide', 400);
    }
    if (!in_array($role, ['learner', 'reviewer'], true)) {
        jsonError('Rôle invalide', 400);
    }

    sessionLogin($username, $role);

    jsonResponse([
        'ok'         => true,
        'user'       => ['username' => $username, 'role' => $role],
        'csrf_token' => getCsrfToken(),
    ]);
}

// ── DELETE : logout ──
if ($method === 'DELETE') {
    verifyCsrf();
    sessionLogout();
    jsonResponse(['ok' => true]);
}

jsonError('Méthode non autorisée', 405);
