<?php
$pageTitle = "Abonnements Professeur";
$pageSubtitle = "Espace Professeur";
$hideModeSwitcher = true;
$activePage = "abonnement";
require_once __DIR__ . '/includes/views/header.php';
?>
<style>
        .pricing-container {
            display: flex;
            flex-wrap: wrap;
            gap: var(--space-xl);
            justify-content: center;
            align-items: stretch;
            padding: var(--space-2xl) var(--space-md);
            max-width: 1200px;
            margin: 0 auto;
        }

        .pricing-card {
            background-color: var(--color-bg-panel);
            border: var(--border-panel);
            border-radius: var(--radius-lg);
            padding: var(--space-xl);
            width: 100%;
            max-width: 350px;
            display: flex;
            flex-direction: column;
            transition: var(--transition-normal);
            position: relative;
            overflow: hidden;
        }

        .pricing-card:hover {
            transform: translateY(-5px);
            border-color: var(--color-gold);
            box-shadow: var(--shadow-gold);
        }

        .pricing-card--pro {
            border-color: var(--color-gold);
            box-shadow: 0 0 15px rgba(212, 168, 71, 0.15);
        }

        .pricing-card--pro::before {
            content: "Recommandé";
            position: absolute;
            top: 15px;
            right: -35px;
            background-color: var(--color-gold);
            color: var(--color-bg-dark);
            font-size: var(--font-size-xs);
            font-weight: bold;
            padding: 5px 40px;
            transform: rotate(45deg);
        }

        .pricing-header {
            text-align: center;
            margin-bottom: var(--space-xl);
            padding-bottom: var(--space-md);
            border-bottom: 1px solid rgba(212, 168, 71, 0.1);
        }

        .pricing-title {
            font-size: var(--font-size-xl);
            color: var(--color-gold);
            margin-bottom: var(--space-sm);
        }

        .pricing-price {
            font-size: 2.5rem;
            color: var(--color-text);
            font-weight: bold;
            display: flex;
            justify-content: center;
            align-items: baseline;
        }

        .pricing-currency {
            font-size: var(--font-size-lg);
            margin-right: 2px;
            color: var(--color-text-muted);
        }

        .pricing-period {
            font-size: var(--font-size-sm);
            color: var(--color-text-muted);
            font-weight: normal;
        }

        .pricing-features {
            list-style: none;
            padding: 0;
            margin: 0 0 var(--space-xl) 0;
            flex-grow: 1;
        }

        .pricing-feature {
            display: flex;
            align-items: flex-start;
            margin-bottom: var(--space-md);
            color: var(--color-text);
            font-size: var(--font-size-sm);
            line-height: 1.4;
        }

        .pricing-feature svg {
            color: var(--color-success);
            flex-shrink: 0;
            margin-right: var(--space-sm);
            margin-top: 2px;
        }

        .pricing-feature.disabled {
            color: var(--color-text-muted);
        }

        .pricing-feature.disabled svg {
            color: var(--color-text-muted);
            opacity: 0.5;
        }

        .page-intro {
            text-align: center;
            margin-top: var(--space-2xl);
            padding: 0 var(--space-md);
        }
        
        .page-intro h1 {
            color: var(--color-gold);
            font-size: var(--font-size-2xl);
            margin-bottom: var(--space-sm);
        }
        
        .page-intro p {
            color: var(--color-text-muted);
            max-width: 600px;
            margin: 0 auto;
            line-height: 1.6;
        }
</style>

<div class="page-intro">
    <h1>Monétisez votre enseignement</h1>
    <p>Passez au niveau supérieur. Activez les pourboires, développez votre audience et bénéficiez d'outils d'analyse avancés pour le suivi de vos élèves.</p>
</div>

<div class="pricing-container">
    <!-- Gratuit -->
    <div class="pricing-card">
        <div class="pricing-header">
            <h3 class="pricing-title">Gratuit</h3>
            <div class="pricing-price"><span class="pricing-currency">€</span>0<span class="pricing-period">/mois</span></div>
        </div>
        <ul class="pricing-features">
            <li class="pricing-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Correction de récitations illimitée
            </li>
            <li class="pricing-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Accès aux outils de base (Madd, Makhraj...)
            </li>
            <li class="pricing-feature disabled">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Recevoir des pourboires (Tips)
            </li>
            <li class="pricing-feature disabled">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Statistiques avancées des élèves
            </li>
            <li class="pricing-feature disabled">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Badge Professeur Certifié
            </li>
        </ul>
        <button class="btn btn--ghost" style="width: 100%;">Plan actuel</button>
    </div>

    <!-- Plus -->
    <div class="pricing-card">
        <div class="pricing-header">
            <h3 class="pricing-title">Plus</h3>
            <div class="pricing-price"><span class="pricing-currency">€</span>9.99<span class="pricing-period">/mois</span></div>
        </div>
        <ul class="pricing-features">
            <li class="pricing-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Correction de récitations illimitée
            </li>
            <li class="pricing-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Accès aux outils de base
            </li>
            <li class="pricing-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <strong style="color:var(--color-gold); margin-right: 4px;">Recevoir des pourboires (Tips)</strong> de vos élèves
            </li>
            <li class="pricing-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Commission réduite sur les Tips (10%)
            </li>
            <li class="pricing-feature disabled">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Statistiques avancées des élèves
            </li>
            <li class="pricing-feature disabled">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Badge Professeur Certifié
            </li>
        </ul>
        <button class="btn btn--primary" style="width: 100%;">S'abonner à Plus</button>
    </div>

    <!-- Pro -->
    <div class="pricing-card pricing-card--pro">
        <div class="pricing-header">
            <h3 class="pricing-title">Pro</h3>
            <div class="pricing-price"><span class="pricing-currency">€</span>24.99<span class="pricing-period">/mois</span></div>
        </div>
        <ul class="pricing-features">
            <li class="pricing-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Toutes les fonctionnalités du plan Plus
            </li>
            <li class="pricing-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <strong style="color:var(--color-gold); margin-right: 4px;">0% de commission</strong> sur les Tips
            </li>
            <li class="pricing-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Statistiques avancées et suivi de progression des élèves
            </li>
            <li class="pricing-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Badge Professeur Certifié (Mise en avant)
            </li>
            <li class="pricing-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Support prioritaire
            </li>
        </ul>
        <button class="btn btn--gold" style="width: 100%;">Devenir Pro</button>
    </div>
</div>

<?php
require_once __DIR__ . '/includes/views/footer.php';
?>
