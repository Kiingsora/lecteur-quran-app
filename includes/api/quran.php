<?php
/**
 * Qira'ah - Proxy API Coran (alquran.cloud)
 * Sécurité : auth requise, rate limiting, cache fichier 24h, validation stricte
 */

require_once __DIR__ . '/../../php/config.php';
require_once __DIR__ . '/../../php/session.php';

// 1. Headers sécurité
setSecurityHeaders();
header('Content-Type: application/json; charset=utf-8');

// 2. Méthode HTTP
$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method !== 'GET') {
    jsonError('Méthode non autorisée', 405);
}

// 3. Authentification
$user = requireAuth();

// 4. Origine
checkOrigin();

// 5. Rate limiting (30 requêtes / 60s)
rateLimit('quran_api', 30, 60);

// 6. Paramètres validés
$hasPage  = isset($_GET['page'])  && $_GET['page']  !== '';
$hasSurah = isset($_GET['surah']) && $_GET['surah'] !== '';

if (!$hasPage && !$hasSurah) {
    jsonError('Paramètre page (1-604) ou surah (1-114) requis', 400);
}

if ($hasPage) {
    $page = validateInt($_GET['page'], 1, 604);
} else {
    $surah = validateInt($_GET['surah'], 1, 114);
}

// 7. Répertoire de cache (hors webroot — ou protégé par .htaccess)
$cacheDir = __DIR__ . '/../../cache/quran/';
if (!is_dir($cacheDir)) {
    if (!mkdir($cacheDir, 0700, true)) {
        jsonError('Erreur serveur (cache)', 500);
    }
    // Écrire un .htaccess de protection
    file_put_contents($cacheDir . '.htaccess', "Require all denied\n");
}

// 8. Clé de cache et URL API
if ($hasPage) {
    $cacheKey = 'page_' . $page;
    $apiUrl   = 'https://api.alquran.cloud/v1/page/' . $page . '/quran-uthmani';
} else {
    $cacheKey = 'surah_' . $surah;
    $apiUrl   = 'https://api.alquran.cloud/v1/surah/' . $surah . '/quran-uthmani';
}

// Nom de fichier cache : alphanumérique uniquement
$cacheFile = $cacheDir . preg_replace('/[^a-z0-9_]/', '', $cacheKey) . '.json';

// 9. Servir depuis le cache si frais (24h)
if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < 86400)) {
    $cached = file_get_contents($cacheFile);
    if ($cached !== false) {
        echo $cached;
        exit;
    }
}

// 10. Requête vers alquran.cloud
$ctx = stream_context_create([
    'http' => [
        'method'          => 'GET',
        'timeout'         => 10,
        'user_agent'      => 'Qiraah-App/1.0',
        'follow_location' => 0,
    ],
    'ssl' => [
        'verify_peer'      => true,
        'verify_peer_name' => true,
    ],
]);

$raw = @file_get_contents($apiUrl, false, $ctx);
if ($raw === false) {
    jsonError('Impossible de contacter l\'API Coran', 503);
}

// Vérifier taille de réponse avant parse (max 2 Mo)
if (strlen($raw) > 2 * 1024 * 1024) {
    jsonError('Réponse API trop volumineuse', 502);
}

$data = json_decode($raw, true);
if (!is_array($data) || ($data['status'] ?? '') !== 'OK') {
    jsonError('Réponse invalide de l\'API Coran', 502);
}

// 11. Extraire et normaliser les versets
$ayahs = $data['data']['ayahs'] ?? [];
if (!is_array($ayahs)) {
    jsonError('Format de réponse inattendu', 502);
}

$result = [];
foreach ($ayahs as $a) {
    if (!is_array($a)) continue;
    $result[] = [
        'number'        => (int)($a['number']        ?? 0),
        'numberInSurah' => (int)($a['numberInSurah'] ?? 0),
        'surah'         => (int)($a['surah']['number'] ?? 0),
        'surahName'     => (string)($a['surah']['name'] ?? ''),
        'surahNameFr'   => (string)($a['surah']['englishName'] ?? ''),
        'text'          => (string)($a['text'] ?? ''),
        'page'          => (int)($a['page'] ?? 0),
        'juz'           => (int)($a['juz']  ?? 0),
    ];
}

$response = json_encode(
    ['ok' => true, 'ayahs' => $result, 'count' => count($result)],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
);

if ($response === false) {
    jsonError('Erreur d\'encodage JSON', 500);
}

// 12. Écrire cache
file_put_contents($cacheFile, $response, LOCK_EX);

echo $response;
