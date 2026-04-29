# Règles de sécurité — Qira'ah
> Appliquer SYSTÉMATIQUEMENT à chaque nouveau fichier PHP ou JS créé.

## PHP — Checklist obligatoire par endpoint API

```php
<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../session.php';

// 1. Headers sécurité toujours en premier
setSecurityHeaders();
header('Content-Type: application/json; charset=utf-8');

// 2. Méthode HTTP validée
$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method !== 'POST') jsonError('Méthode non autorisée', 405);

// 3. Authentification vérifiée
$user = requireAuth();               // ou requireRole('reviewer')

// 4. CSRF vérifié sur toute mutation (POST/PUT/DELETE)
verifyCsrf();

// 5. Origine vérifiée
checkOrigin();

// 6. Rate limiting si nécessaire
rateLimit('action_name', 20, 60);

// 7. Données validées
$data = getJsonBody();
validateRequired($data, ['field1', 'field2']);
$field1 = sanitize((string)$data['field1']);
$int    = validateInt($data['id'], 1, PHP_INT_MAX);
$float  = validateFloat($data['time'], 0.0, 86400.0);

// 8. SQL TOUJOURS en prepared statements
$stmt = getDB()->prepare('SELECT * FROM table WHERE id = :id');
$stmt->execute([':id' => $int]);

// 9. Output toujours via jsonResponse (encode HEX_TAG, HEX_AMP, HEX_APOS, HEX_QUOT)
jsonResponse(['ok' => true, 'data' => $result]);
```

## JavaScript — Checklist obligatoire

- **innerHTML** → toujours passer par `esc()` pour toute donnée externe
- **onclick inline** → INTERDIT, utiliser `addEventListener`
- **fetch** → toujours passer par `api.get/post/del` (CSRF auto)
- **console.error** → toujours `logError('context', err)` (pas de stack en prod)
- **validation** → ASCII strict `/^[a-zA-Z0-9 \-']{2,50}$/` pour les noms
- **audio/fichiers** → `validateAudioFile(file)` avant `loadAudioBuffer()`
- **window.xxx** → PAS d'exposition globale pour des handlers

## Données utilisateur — règle d'or

Toute donnée qui vient de l'utilisateur (form, URL, fichier, API tierce) est **hostile** par défaut.
- Valider le type, la longueur, le format
- Échapper à la sortie (HTML → esc, SQL → prepared statements)
- Ne jamais faire confiance au rôle envoyé par le client → vérifier en session PHP
