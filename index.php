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
        <div id="viewDashboardLearner" style="display:none;">
            <div class="page-header" style="margin-bottom:var(--space-xl);">
                <div>
                    <h2 class="page-title" id="dashLearnerTitle">Mes récitations</h2>
                    <p class="page-subtitle">Suivez vos enregistrements et leurs corrections</p>
                </div>
                <button class="btn btn--primary" id="btnNewRecitation">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style="display:inline;vertical-align:middle;margin-right:4px;">
                        <path d="M7 1v12M1 7h12"/>
                    </svg>
                    Nouvelle récitation
                </button>
            </div>

            <!-- Stats -->
            <div class="stats-row" style="margin-bottom:var(--space-xl);">
                <div class="stat-card">
                    <div class="stat-card__value" id="statTotal">0</div>
                    <div class="stat-card__label">Récitations</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card__value" id="statSubmitted">0</div>
                    <div class="stat-card__label">En attente</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card__value" id="statReviewed">0</div>
                    <div class="stat-card__label">Corrigées</div>
                </div>
            </div>

            <!-- Grille de récitations -->
            <div class="dashboard-grid" id="learnerRecitationGrid">
                <div class="empty-state" style="grid-column:1/-1;">
                    <div class="empty-state__icon">🎙️</div>
                    <div class="empty-state__text">Aucune récitation encore. Créez votre première récitation !</div>
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

            <!-- Enregistrement -->
            <div class="panel" id="panelRecord">
                <div class="panel__header">
                    <h2 class="panel__title">Enregistrement</h2>
                    <span id="recTitleBadge" style="font-size:var(--font-size-xs);color:var(--color-text-muted);"></span>
                </div>
                <div class="record-section">
                    <button class="btn--record" id="btnRecord" title="Enregistrer / Arrêter">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" id="iconRecordStart">
                            <circle cx="10" cy="10" r="6"/>
                        </svg>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" id="iconRecordStop" style="display:none;">
                            <rect x="5" y="5" width="10" height="10" rx="2"/>
                        </svg>
                    </button>
                    <div class="vu-meter" id="vuMeter">
                        <div class="vu-meter__fill" id="vuMeterFill"></div>
                    </div>
                    <span class="record-status" id="recordStatus">Prêt à enregistrer</span>

                    <div style="margin-left:auto;display:flex;gap:var(--space-md);align-items:center;">
                        <div class="divider-ornament" style="margin:0;width:40px;"></div>
                        <label class="file-drop" id="fileDrop">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="display:inline;vertical-align:middle;margin-right:6px;color:var(--color-gold)">
                                <path d="M8 2v8M5 7l3 3 3-3M2 12v2h12v-2"/>
                            </svg>
                            Importer un audio
                            <input type="file" id="fileInput" accept=".webm,.mp3,.wav">
                        </label>
                    </div>
                </div>
            </div>

            <!-- Waveform -->
            <div class="panel" id="panelWaveform" style="display:none;">
                <div class="panel__header">
                    <h2 class="panel__title">Forme d'onde</h2>
                    <div style="display:flex;align-items:center;gap:var(--space-lg);">
                        <div class="slider-group" style="width:180px;">
                            <label for="silenceThreshold">Sensibilité silences</label>
                            <input type="range" id="silenceThreshold" min="0.005" max="0.05" step="0.005" value="0.01">
                        </div>
                        <button class="btn btn--ghost" id="btnDetectSilences" style="font-size:var(--font-size-xs);">
                            ↺ Redétecter
                        </button>
                    </div>
                </div>

                <!-- Canvas waveform -->
                <div class="waveform-wrapper">
                    <div class="waveform-container" id="waveformContainer">
                        <canvas id="waveformCanvas"></canvas>
                        <canvas id="markerCanvas"></canvas>
                        <canvas id="cursorCanvas"></canvas>
                    </div>
                    <!-- Règle des segments -->
                    <div class="segment-ruler" id="segmentRuler"></div>
                </div>

                <!-- Transport -->
                <div class="transport">
                    <div class="transport__controls">
                        <button class="btn btn--ghost btn--icon" id="btnPrevSegment" title="Segment précédent">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 3v10M13 8L6 3v10z"/></svg>
                        </button>
                        <button class="btn--play" id="btnPlayPause" title="Lecture / Pause">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" id="iconPlay"><path d="M4 2l11 6-11 6z"/></svg>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" id="iconPause" style="display:none;"><rect x="3" y="2" width="4" height="12"/><rect x="9" y="2" width="4" height="12"/></svg>
                        </button>
                        <button class="btn btn--ghost btn--icon" id="btnStop" title="Stop">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="1"/></svg>
                        </button>
                        <button class="btn btn--ghost btn--icon" id="btnNextSegment" title="Segment suivant">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13 3v10M3 8l7-5v10z"/></svg>
                        </button>
                    </div>
                    <span class="transport__time" id="timeDisplay">00:00 / 00:00</span>
                    <div class="transport__speed">
                        <span class="speed-label" id="speedLabel">1×</span>
                        <input type="range" class="speed-slider" id="speedSlider"
                               min="0.5" max="2" step="0.05" value="1"
                               title="Vitesse de lecture">
                    </div>
                </div>
            </div>

            <!-- Sélection sourate récitée -->
            <div class="panel" id="panelSurahSelector">
                <div class="panel__header">
                    <h2 class="panel__title">Sourate récitée</h2>
                    <span style="font-size:var(--font-size-xs);color:var(--color-text-muted);">
                        Aide le relecteur à situer la récitation
                    </span>
                </div>
                <div class="surah-selector">
                    <div class="surah-selector__group">
                        <label class="surah-selector__label" for="surahSelect">Sourate</label>
                        <select id="surahSelect" class="form-input">
                            <option value="">— Sélectionner —</option>
                            <!-- peuplé par JS depuis surahs-data.js -->
                        </select>
                    </div>
                    <div class="surah-selector__group">
                        <label class="surah-selector__label" for="ayahFrom">Du verset</label>
                        <input type="number" id="ayahFrom" class="form-input"
                               min="1" max="286" value="1" placeholder="1">
                    </div>
                    <div class="surah-selector__group">
                        <label class="surah-selector__label" for="ayahTo">Au verset</label>
                        <input type="number" id="ayahTo" class="form-input"
                               min="1" max="286" value="" placeholder="Fin">
                    </div>
                    <button class="btn btn--gold" id="btnLoadQuran">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style="display:inline;vertical-align:middle;margin-right:4px;">
                            <path d="M7 1C3.7 1 1 3.7 1 7s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6zm0 2.5c.4 0 .7.3.7.7S7.4 6.9 7 6.9s-.7-.3-.7-.7.3-.7.7-.7zm1 6.5H6v-4h2v4z"/>
                        </svg>
                        Afficher le Coran
                    </button>
                </div>
            </div>

            <!-- Lecteur Coran (panneau repliable) -->
            <div class="panel" id="panelQuran" style="display:none;">
                <div class="panel__header">
                    <h2 class="panel__title">Coran</h2>
                    <div style="display:flex;align-items:center;gap:var(--space-sm);">
                        <button class="btn btn--ghost btn--icon" id="btnQuranPrevPage" title="Page précédente">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
                        </button>
                        <span id="quranPageLabel" style="font-size:var(--font-size-sm);color:var(--color-text-muted);white-space:nowrap;">Page —</span>
                        <button class="btn btn--ghost btn--icon" id="btnQuranNextPage" title="Page suivante">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M5 2l5 5-5 5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
                        </button>
                        <button class="btn btn--ghost" id="btnCloseQuran"
                                style="font-size:var(--font-size-xs);padding:4px 8px;">
                            ✕ Fermer
                        </button>
                    </div>
                </div>
                <div class="quran-panel__body" id="quranPanelContent" dir="rtl" lang="ar">
                    <!-- Peuplé par QuranDisplay -->
                </div>
            </div>

            <!-- Soumettre -->
            <div id="panelSubmit" style="display:none;text-align:center;padding:var(--space-lg);">
                <button class="btn btn--gold btn--lg" id="btnSubmitReview">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" style="display:inline;vertical-align:middle;margin-right:6px;"><path d="M2 16l16-7L2 2v5.5l11 1.5-11 1.5z"/></svg>
                    Envoyer pour correction
                </button>
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

        <!-- Sidebar apprenant : pins + segments -->
        <div id="sidebarLearner" style="display:none;">
            <div class="panel">
                <div class="panel__header">
                    <h2 class="panel__title">Repères (Pins)</h2>
                    <button class="btn btn--ghost" id="btnAddPin" style="font-size:var(--font-size-xs);padding:4px 8px;">
                        + Ajouter
                    </button>
                </div>
                <ul class="pin-list" id="pinList">
                    <li class="empty-state"><div class="empty-state__text">Aucun pin.</div></li>
                </ul>
            </div>

            <div class="panel">
                <div class="panel__header">
                    <h2 class="panel__title">Segments</h2>
                </div>
                <ul class="segment-list" id="segmentList">
                    <li class="empty-state"><div class="empty-state__text">Aucun segment.</div></li>
                </ul>
            </div>
        </div>

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
