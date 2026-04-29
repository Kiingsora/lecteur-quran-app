<?php
$pageTitle = "Correction de récitation";
require_once __DIR__ . '/includes/views/header.php';
require_once __DIR__ . '/includes/views/modals/login.php';
?>

<!-- ============================================================
     MAIN APP LAYOUT
     ============================================================ -->
<div class="app-layout">

    <!-- ─── MAIN CONTENT ─── -->
    <main class="main-content" id="mainContent">

        <!-- ============ DASHBOARD APPRENANT ============ -->
        <div id="viewDashboardLearner" style="display:none; padding: var(--space-lg);">
            <div class="page-header" style="margin-bottom:var(--space-xl); display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h2 class="page-title" id="dashLearnerTitle">Tableau de bord</h2>
                    <p class="page-subtitle">Suivi de votre progression et de vos récitations</p>
                </div>
                <button class="btn btn--gold" id="btnNewRecitation">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style="display:inline;vertical-align:middle;margin-right:4px;">
                        <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Nouvelle session
                </button>
            </div>

            <!-- Stats -->
            <div class="stats-row" style="margin-bottom:var(--space-xl); display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-md);">
                <div class="stat-card" style="background:linear-gradient(135deg, rgba(212,168,71,0.1), transparent); border-color:var(--color-gold-dim);">
                    <div class="stat-card__value" style="color:var(--color-gold);">12</div>
                    <div class="stat-card__label">Jours consécutifs 🔥</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card__value" id="statTotal">0</div>
                    <div class="stat-card__label">Versets maîtrisés</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card__value" id="statSubmitted">0</div>
                    <div class="stat-card__label">En attente de correction</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card__value" id="statReviewed">0</div>
                    <div class="stat-card__label">Corrections reçues</div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 2fr 1fr; gap:var(--space-xl); align-items:start;">
                
                <!-- Grille de récitations -->
                <div>
                    <h3 style="margin-bottom:var(--space-md); color:var(--color-text);">Historique de vos récitations</h3>
                    <div class="dashboard-grid" id="learnerRecitationGrid" style="grid-template-columns: 1fr;">
                        <div class="empty-state" style="grid-column:1/-1;">
                            <div class="empty-state__icon">🎙️</div>
                            <div class="empty-state__text">Vous n'avez pas encore commencé. Lancez votre première session d'apprentissage !</div>
                        </div>
                    </div>
                </div>

                <!-- Derniers Retours & Objectifs -->
                <div style="display:flex; flex-direction:column; gap:var(--space-lg);">
                    <div class="panel">
                        <div class="panel__header">
                            <h3 class="panel__title">Dernier retour Professeur</h3>
                        </div>
                        <div style="padding:var(--space-md); color:var(--color-text-muted); font-size:var(--font-size-sm); text-align:center;">
                            <i>Aucun retour pour le moment.</i>
                        </div>
                    </div>

                    <div class="panel">
                        <div class="panel__header">
                            <h3 class="panel__title">Objectif de la semaine</h3>
                        </div>
                        <div style="padding:var(--space-md);">
                            <div style="display:flex; justify-content:space-between; margin-bottom:var(--space-sm); font-size:var(--font-size-sm);">
                                <span>Sourate Al-Mulk</span>
                                <span style="color:var(--color-gold);">30%</span>
                            </div>
                            <div style="height:8px; background:var(--color-bg-dark); border-radius:4px; overflow:hidden;">
                                <div style="height:100%; width:30%; background:var(--color-gold);"></div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>

        <!-- ============ DASHBOARD RELECTEUR ============ -->
        <div id="viewDashboardReviewer" style="display:none;">
            <div class="page-header" style="margin-bottom:var(--space-xl);">
                <div>
                    <h2 class="page-title" id="dashReviewerTitle">Apprenants à corriger</h2>
                    <p class="page-subtitle">Récitations soumises en attente de votre correction</p>
                </div>
            </div>

            <!-- Stats relecteur -->
            <div class="stats-row" style="margin-bottom:var(--space-xl);">
                <div class="stat-card">
                    <div class="stat-card__value" id="statPending">0</div>
                    <div class="stat-card__label">En attente</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card__value" id="statDone">0</div>
                    <div class="stat-card__label">Corrigées</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card__value" id="statLearners">0</div>
                    <div class="stat-card__label">Apprenants</div>
                </div>
            </div>

            <!-- Grille récitations à corriger -->
            <div class="dashboard-grid" id="reviewerRecitationGrid">
                <div class="empty-state" style="grid-column:1/-1;">
                    <div class="empty-state__icon">📋</div>
                    <div class="empty-state__text">Aucune récitation soumise pour le moment.</div>
                </div>
            </div>
        </div>

        <!-- ============ VUE ENREGISTREMENT (Apprenant) ============ -->
        <div id="viewLearner" style="display:none;">

            <!-- Interface Split Screen -->
            <div style="display:flex; gap:var(--space-xl); align-items:flex-start; min-height: 80vh;">
                
                <!-- Colonne Gauche : Enregistrement et Blocs -->
                <div style="flex: 35; display:flex; flex-direction:column; gap:var(--space-lg);">

                    
                    <!-- Bouton Push-to-Talk -->
                    <div class="panel" style="text-align:center; padding:var(--space-2xl) var(--space-lg); position:sticky; top:20px; z-index:10;">
                        <h3 style="color:var(--color-text-muted); margin-bottom:var(--space-md);">Enregistrement par verset</h3>
                        <button class="btn--record" id="btnPttRecord" style="width:100px; height:100px; margin:0 auto; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;" title="Maintenez la barre ESPACE enfoncée pour enregistrer">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="iconMic"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                        </button>
                        <p style="margin-top:var(--space-md); font-size:var(--font-size-sm); color:var(--color-gold);" id="pttStatus">Maintenez la barre <kbd style="background:var(--color-gold-dim); padding:2px 6px; border-radius:4px; color:var(--color-gold);">ESPACE</kbd> enfoncée pour parler</p>
                    </div>

                    <!-- Liste des Blocs -->
                    <div class="panel" id="blocksPanel">
                        <div class="panel__header">
                            <h2 class="panel__title">Vos versets enregistrés</h2>
                        </div>
                        <div id="blocksContainer" style="display:flex; flex-direction:column; gap:var(--space-sm); min-height: 200px;">
                            <div class="empty-state" id="blocksEmptyState" style="padding:var(--space-xl); text-align:center;">
                                <div class="empty-state__icon">🎙️</div>
                                <div class="empty-state__text">Maintenez Espace pour commencer à réciter. Vos blocs s'afficheront ici.</div>
                            </div>
                            <!-- Les blocs audio s'ajouteront ici -->
                        </div>
                    </div>

                    <!-- Soumettre -->
                    <div id="panelSubmit" style="display:none; text-align:center; padding:var(--space-lg);">
                        <button class="btn btn--gold btn--lg" id="btnSubmitReview" style="width:100%;">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" style="display:inline;vertical-align:middle;margin-right:6px;"><path d="M2 16l16-7L2 2v5.5l11 1.5-11 1.5z"/></svg>
                            Envoyer la récitation complète
                        </button>
                    </div>
                </div>

                <!-- Colonne Droite : Coran Dynamique -->
                <div class="panel" id="panelQuran" style="flex: 65; display:flex; flex-direction:column; position:sticky; top:20px; height:calc(100vh - 120px);">

                    
                    <!-- Choix de la Sourate -->
                    <div class="panel__header" style="flex-direction:column; align-items:stretch; gap:var(--space-md); padding-bottom:var(--space-md); border-bottom:1px solid var(--border-panel);">
                        <h2 class="panel__title">Texte Coranique</h2>
                        
                        <div class="surah-selector" style="display:flex; flex-wrap:wrap; gap:var(--space-sm); background:transparent; padding:0; border:none;">
                            <div class="surah-selector__group" style="flex:1; min-width:150px;">
                                <label class="surah-selector__label" for="surahSelect">Sourate</label>
                                <select id="surahSelect" class="form-input">
                                    <option value="">— Sélectionner —</option>
                                </select>
                            </div>
                            <div class="surah-selector__group" style="width:70px;">
                                <label class="surah-selector__label" for="ayahFrom">Du</label>
                                <input type="number" id="ayahFrom" class="form-input" min="1" max="286" value="1" placeholder="1">
                            </div>
                            <div class="surah-selector__group" style="width:70px;">
                                <label class="surah-selector__label" for="ayahTo">Au</label>
                                <input type="number" id="ayahTo" class="form-input" min="1" max="286" value="" placeholder="Fin">
                            </div>
                        </div>

                        
                        <!-- Toolbar des options de lecture -->
                        <div style="background:var(--color-bg-dark); padding:var(--space-sm) var(--space-md); border-radius:var(--radius-sm); border:1px solid var(--border-panel); display:flex; flex-direction:column; gap:var(--space-md);">
                            
                            <!-- Tab: Affichage -->
                            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm);">
                                <div style="display:flex; gap:var(--space-md); align-items:center;">
                                    <label style="display:flex; align-items:center; gap:var(--space-xs); font-size:var(--font-size-sm); cursor:pointer; color:var(--color-text);">
                                        <input type="checkbox" id="optTajweed" checked> Couleurs Tajweed
                                    </label>
                                    <label style="display:flex; align-items:center; gap:var(--space-xs); font-size:var(--font-size-sm); cursor:pointer; color:var(--color-text);">
                                        <input type="checkbox" id="optTranslation" checked> Traduction
                                    </label>
                                    <label style="display:flex; align-items:center; gap:var(--space-xs); font-size:var(--font-size-sm); cursor:pointer; color:var(--color-text);">
                                        <input type="checkbox" id="optPhonetics"> Phonétique
                                    </label>
                                </div>
                                
                                <div style="display:flex; align-items:center; gap:var(--space-sm);">
                                    <span style="font-size:var(--font-size-xs); color:var(--color-text-muted);">Taille Texte:</span>
                                    <button class="btn btn--ghost" id="btnFontDec" style="padding:2px 8px; font-size:12px;">A-</button>
                                    <button class="btn btn--ghost" id="btnFontInc" style="padding:2px 8px; font-size:16px;">A+</button>
                                </div>
                            </div>
                            
                            <hr style="border:0; border-top:1px solid rgba(255,255,255,0.05); margin:0;">

                            <!-- Tab: Apprentissage -->
                            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-sm);">
                                <label style="display:flex; align-items:center; gap:var(--space-xs); font-size:var(--font-size-sm); cursor:pointer; color:var(--color-text);">
                                    <input type="checkbox" id="optSingleVerse" checked>
                                    Cibler uniquement le verset en cours
                                </label>
                                <div style="display:flex; align-items:center; gap:var(--space-sm); font-size:var(--font-size-sm);">
                                    <span style="color:var(--color-text-muted);">Après enregistrement:</span>
                                    <select id="optAutoAdvance" style="background:rgba(0,0,0,0.3); color:var(--color-text); border:1px solid var(--color-gold-dim); border-radius:4px; padding:4px 8px; outline:none;">
                                        <option value="next">Passer au suivant</option>
                                        <option value="loop">Rester sur ce verset</option>
                                    </select>
                                </div>
                            </div>

                        </div>
                    </div>
                    
                    <div class="quran-panel__body" id="quranPanelContent" dir="rtl" lang="ar" style="flex:1; overflow-y:auto; padding:var(--space-lg); font-size:2rem; line-height:2.8; text-align:right; background:var(--color-bg-dark); border-radius:0 0 var(--radius-lg) var(--radius-lg);">
                        <div style="color:var(--color-text-muted); font-size:1rem; margin-top:50px; text-align:center;">Sélectionnez une sourate ci-dessus.</div>
                    </div>
                </div>

            </div>
        </div>

        <!-- ============ VUE RELECTEUR ============ -->
        <div id="viewReviewer" style="display:none;">

            <!-- Waveform relecteur -->
            <div class="panel">
                <div class="panel__header">
                    <h2 class="panel__title">Récitation de <span id="reviewerRecitantName">l'apprenant</span></h2>
                    <span style="font-size:var(--font-size-xs);color:var(--color-text-muted);">Cliquez sur une catégorie pour marquer une erreur au temps actuel</span>
                </div>

                <div class="waveform-wrapper">
                    <div class="waveform-container" id="reviewerWaveformContainer">
                        <canvas id="reviewerWaveformCanvas"></canvas>
                        <canvas id="reviewerMarkerCanvas"></canvas>
                        <canvas id="reviewerCursorCanvas"></canvas>
                    </div>
                    <div class="segment-ruler" id="reviewerSegmentRuler"></div>
                </div>

                <!-- Transport relecteur -->
                <div class="transport">
                    <div class="transport__controls">
                        <button class="btn btn--ghost btn--icon" id="btnReviewerPrevSegment" title="Segment précédent">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 3v10M13 8L6 3v10z"/></svg>
                        </button>
                        <button class="btn--play" id="btnReviewerPlayPause" title="Lecture / Pause">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" id="reviewerIconPlay"><path d="M4 2l11 6-11 6z"/></svg>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" id="reviewerIconPause" style="display:none;"><rect x="3" y="2" width="4" height="12"/><rect x="9" y="2" width="4" height="12"/></svg>
                        </button>
                        <button class="btn btn--ghost btn--icon" id="btnReviewerStop" title="Stop">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="1"/></svg>
                        </button>
                        <button class="btn btn--ghost btn--icon" id="btnReviewerNextSegment" title="Segment suivant">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13 3v10M3 8l7-5v10z"/></svg>
                        </button>
                    </div>
                    <span class="transport__time" id="reviewerTimeDisplay">00:00 / 00:00</span>
                    <div class="transport__speed">
                        <span class="speed-label" id="reviewerSpeedLabel">1×</span>
                        <input type="range" class="speed-slider" id="reviewerSpeedSlider"
                               min="0.5" max="2" step="0.05" value="1"
                               title="Vitesse de lecture">
                    </div>
                </div>
            </div>

            <!-- Catégories -->
            <div class="panel">
                <div class="panel__header">
                    <h2 class="panel__title">Marquer une erreur</h2>
                </div>
                <div class="category-bar" id="categoryBar">
                    <button class="category-btn category-btn--madd"    data-category="madd">Madd</button>
                    <button class="category-btn category-btn--emphase" data-category="emphase">Emphase</button>
                    <button class="category-btn category-btn--makhraj" data-category="makhraj">Makhraj</button>
                    <button class="category-btn category-btn--ghunnah" data-category="ghunnah">Ghunnah</button>
                    <button class="category-btn category-btn--waqf"    data-category="waqf">Waqf</button>
                    <button class="category-btn category-btn--fluidite"data-category="fluidite">Fluidité</button>
                </div>
            </div>

            <!-- Commentaire global -->
            <div class="panel">
                <div class="panel__header">
                    <h2 class="panel__title">Commentaire global</h2>
                    <button class="btn btn--ghost btn--icon" id="btnDictateGlobal" title="Dicter (Chrome/Edge)">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                            <rect x="5" y="1" width="4" height="7" rx="2"/>
                            <path d="M3 6.5c0 2 1.8 3.5 4 3.5s4-1.5 4-3.5M7 10v3"/>
                        </svg>
                    </button>
                </div>
                <textarea id="globalComment" rows="4" maxlength="2000" placeholder="Commentaire général sur la récitation..." style="width:100%;resize:vertical;"></textarea>
            </div>

            <!-- Verdict -->
            <div class="panel">
                <div class="panel__header">
                    <h2 class="panel__title">Verdict</h2>
                </div>
                <div class="verdict-group" id="verdictGroup">
                    <div class="verdict-card verdict-card--ok" data-verdict="ok">
                        <div class="verdict-card__icon">
                            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                <circle cx="14" cy="14" r="12" stroke="#40916C" stroke-width="2"/>
                                <path d="M9 14l3 3 7-7" stroke="#40916C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="verdict-card__label" style="color:#40916C;">OK</div>
                    </div>
                    <div class="verdict-card verdict-card--correct" data-verdict="to_correct">
                        <div class="verdict-card__icon">
                            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                <circle cx="14" cy="14" r="12" stroke="#D4A847" stroke-width="2"/>
                                <path d="M9 9l6 6M15 9l-6 6" stroke="#D4A847" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </div>
                        <div class="verdict-card__label" style="color:#D4A847;">À corriger</div>
                    </div>
                    <div class="verdict-card verdict-card--redo" data-verdict="redo">
                        <div class="verdict-card__icon">
                            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                <circle cx="14" cy="14" r="12" stroke="#C0392B" stroke-width="2"/>
                                <path d="M10 11a5 5 0 0 1 8 0M18 11v3l-3 0" stroke="#C0392B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="verdict-card__label" style="color:#C0392B;">Refaire</div>
                    </div>
                </div>
            </div>

            <!-- Actions -->
            <div style="display:flex;gap:var(--space-md);justify-content:center;padding:var(--space-lg);">
                <button class="btn btn--green btn--lg" id="btnSaveCorrection">Sauvegarder</button>
                <button class="btn btn--gold btn--lg" id="btnExportJson">Exporter JSON</button>
            </div>
        </div>

    </main>

    <!-- ─── SIDEBAR ─── -->
    <aside class="sidebar" id="sidebar">

        <!-- Sidebar apprenant : Supprimée à la demande de l'utilisateur -->


        <!-- Sidebar relecteur : points de correction + checklist -->
        <div id="sidebarReviewer" style="display:none;">

            <!-- Infos verset récité -->
            <div class="panel" id="panelVerseInfo" style="display:none;">
                <div class="panel__header">
                    <h2 class="panel__title">Verset récité</h2>
                </div>
                <div class="verse-info-card" id="verseInfoCard">
                    <div class="verse-info-card__surah" id="verseInfoSurah">—</div>
                    <div class="verse-info-card__detail" id="verseInfoRange">—</div>
                </div>
            </div>

            <div class="panel">
                <div class="panel__header">
                    <h2 class="panel__title">Points de correction</h2>
                    <span id="correctionCount" style="font-size:var(--font-size-xs);color:var(--color-text-muted);">0</span>
                </div>
                <div class="correction-list" id="correctionList">
                    <div class="empty-state"><div class="empty-state__text">Aucun point encore. Cliquez sur une catégorie.</div></div>
                </div>
            </div>

            <div class="panel">
                <div class="panel__header">
                    <h2 class="panel__title">Checklist</h2>
                </div>
                <div id="checklist" style="display:flex;flex-direction:column;gap:var(--space-sm);">
                    <label style="display:flex;align-items:center;gap:var(--space-sm);font-size:var(--font-size-sm);cursor:pointer;">
                        <input type="checkbox" name="checklist_madd"> <span style="color:#3498DB;">Madd</span>
                    </label>
                    <label style="display:flex;align-items:center;gap:var(--space-sm);font-size:var(--font-size-sm);cursor:pointer;">
                        <input type="checkbox" name="checklist_emphase"> <span style="color:#9B59B6;">Emphase</span>
                    </label>
                    <label style="display:flex;align-items:center;gap:var(--space-sm);font-size:var(--font-size-sm);cursor:pointer;">
                        <input type="checkbox" name="checklist_makhraj"> <span style="color:#E74C3C;">Makhraj</span>
                    </label>
                    <label style="display:flex;align-items:center;gap:var(--space-sm);font-size:var(--font-size-sm);cursor:pointer;">
                        <input type="checkbox" name="checklist_ghunnah"> <span style="color:#E67E22;">Ghunnah</span>
                    </label>
                    <label style="display:flex;align-items:center;gap:var(--space-sm);font-size:var(--font-size-sm);cursor:pointer;">
                        <input type="checkbox" name="checklist_waqf"> <span style="color:#F1C40F;">Waqf</span>
                    </label>
                    <label style="display:flex;align-items:center;gap:var(--space-sm);font-size:var(--font-size-sm);cursor:pointer;">
                        <input type="checkbox" name="checklist_fluidite"> <span style="color:#1ABC9C;">Fluidité</span>
                    </label>
                </div>
            </div>

            <!-- Légende couleurs -->
            <div class="panel">
                <div class="panel__header">
                    <h2 class="panel__title">Légende</h2>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;">
                    <div style="display:flex;align-items:center;gap:8px;font-size:var(--font-size-xs);">
                        <span style="width:3px;height:16px;background:#3498DB;display:inline-block;border-radius:2px;"></span><span>Madd</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;font-size:var(--font-size-xs);">
                        <span style="width:3px;height:16px;background:#9B59B6;display:inline-block;border-radius:2px;"></span><span>Emphase</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;font-size:var(--font-size-xs);">
                        <span style="width:3px;height:16px;background:#E74C3C;display:inline-block;border-radius:2px;"></span><span>Makhraj</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;font-size:var(--font-size-xs);">
                        <span style="width:3px;height:16px;background:#E67E22;display:inline-block;border-radius:2px;"></span><span>Ghunnah</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;font-size:var(--font-size-xs);">
                        <span style="width:3px;height:16px;background:#F1C40F;display:inline-block;border-radius:2px;"></span><span>Waqf</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;font-size:var(--font-size-xs);">
                        <span style="width:3px;height:16px;background:#1ABC9C;display:inline-block;border-radius:2px;"></span><span>Fluidité</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;font-size:var(--font-size-xs);border-top:1px solid rgba(212,168,71,0.08);padding-top:6px;margin-top:2px;">
                        <span style="width:2px;height:16px;background:#D4A847;display:inline-block;border-radius:2px;opacity:0.6;"></span><span style="color:var(--color-text-muted);">Pin (repère)</span>
                    </div>
                </div>
            </div>
        </div>

    </aside>
</div>

<?php
$useAppJs = true;
require_once __DIR__ . '/includes/views/footer.php';
?>
