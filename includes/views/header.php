<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Qira'ah - <?= $pageTitle ?? 'Correction de récitation' ?></title>

    <!-- Security headers -->
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <meta name="referrer" content="strict-origin-when-cross-origin">

    <link rel="stylesheet" href="<?= $basePath ?? '' ?>assets/css/variables.css">
    <link rel="stylesheet" href="<?= $basePath ?? '' ?>assets/css/style.css">
</head>
<body>

<header class="header">
    <div class="header__logo">
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="13" stroke="#D4A847" stroke-width="1.2"/>
            <path d="M15 5 L15 25 M9 10 Q15 8 21 10 M9 15 Q15 13 21 15 M9 20 Q15 18 21 20"
                  stroke="#D4A847" stroke-width="1" stroke-linecap="round" opacity="0.7"/>
        </svg>
        <h1 class="header__title">Qira'ah</h1>
        <span class="header__subtitle"><?= $pageSubtitle ?? 'Correction de récitation' ?></span>
    </div>
    <nav class="header__nav">
        <?php if (!isset($hideModeSwitcher) || !$hideModeSwitcher): ?>
        <!-- Mode switcher -->
        <div class="mode-switcher" id="modeSwitcher" style="display:none;">
            <button class="mode-switcher__btn mode-switcher__btn--active" data-mode="dashboard" id="btnModeDashboard">
                Tableau de bord
            </button>
            <button class="mode-switcher__btn" data-mode="learner" id="btnModeLearner">
                Enregistrement
            </button>
            <button class="mode-switcher__btn" data-mode="reviewer" id="btnModeReviewer">
                Correction
            </button>
        </div>
        <?php else: ?>
        <a href="<?= $basePath ?? '' ?>index.php" class="btn btn--ghost" style="text-decoration: none; font-size: var(--font-size-sm);">Retour au tableau de bord</a>
        <?php endif; ?>

        <!-- Infos user (dropdown) -->
        <div class="user-profile" id="userInfo" style="display:none;">
            <div class="user-profile__avatar" id="userAvatar">?</div>
            <span id="userDisplayName"></span>
            
            <div class="profile-dropdown" id="profileDropdown">
                <a href="#" class="profile-dropdown__item">👤 Mon Profil</a>
                <a href="#" class="profile-dropdown__item">⚙️ Paramètres</a>
                <a href="<?= $basePath ?? '' ?>abonnement.php" class="profile-dropdown__item" <?= isset($activePage) && $activePage === 'abonnement' ? 'style="color:var(--color-gold);"' : '' ?>>⭐ Abonnement</a>
                <button class="profile-dropdown__item profile-dropdown__item--danger" id="btnLogout" style="width: 100%; text-align: left;">🚪 Déconnexion</button>
            </div>
        </div>
    </nav>
</header>
