<?php
/**
 * Qira'ah - Proxy API Coran (alquran.cloud)
 * Sécurité : auth requise, rate limiting, cache fichier 24h, validation stricte
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../core/session.php';

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
// We fetch: Tajweed (Arabic), French Translation, English Transliteration
$editions = 'quran-tajweed,fr.hamidullah,en.transliteration';

if ($hasPage) {
    $cacheKey = 'page_editions_' . $page;
    $apiUrl   = 'https://api.alquran.cloud/v1/page/' . $page . '/editions/' . $editions;
} else {
    $cacheKey = 'surah_editions_' . $surah;
    $apiUrl   = 'https://api.alquran.cloud/v1/surah/' . $surah . '/editions/' . $editions;
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
if (!is_array($data) || ($data['status'] ?? '') !== 'OK' || !isset($data['data'])) {
    jsonError('Réponse invalide de l\'API Coran', 502);
}

// 11. Formater les données (fusionner les 3 éditions)
// $data['data'] is an array of 3 edition objects.
$tajweedData = $data['data'][0];
$frData = $data['data'][1];
$transData = $data['data'][2];

$ayahs = [];
$surahName = $tajweedData['name'] ?? '';
$surahNameFr = $tajweedData['englishName'] ?? '';

$tajweedAyahs = $hasPage ? $tajweedData['ayahs'] : $tajweedData['ayahs'];
$frAyahs = $hasPage ? $frData['ayahs'] : $frData['ayahs'];
$transAyahs = $hasPage ? $transData['ayahs'] : $transData['ayahs'];

foreach ($tajweedAyahs as $i => $a) {
    $ayahs[] = [
        'number'        => $a['number'],
        'surah'         => $a['surah']['number'] ?? $surah,
        'numberInSurah' => $a['numberInSurah'],
        'page'          => $a['page'],
        'text'          => $a['text'], // Tajweed text (can contain HTML/tags)
        'translation'   => $frAyahs[$i]['text'] ?? '',
        'phonetics'     => $transAyahs[$i]['text'] ?? '',
        'surahName'     => $a['surah']['name'] ?? $surahName,
        'surahNameFr'   => $a['surah']['englishName'] ?? $surahNameFr
    ];
}

$response = json_encode(
    ['ok' => true, 'ayahs' => $ayahs, 'count' => count($ayahs)],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
);

if ($response === false) {
    jsonError('Erreur d\'encodage JSON', 500);
}

// 12. Écrire cache
file_put_contents($cacheFile, $response, LOCK_EX);

echo $response;
