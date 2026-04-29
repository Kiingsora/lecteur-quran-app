/**
 * Qira'ah - Main Application Module
 * Coordinates all modules, manages state, login, dashboard, mode switching
 */

import { AudioRecorder }  from '../audio/audio-recorder.js';
import { AudioPlayer }    from '../audio/audio-player.js';
import { Waveform }       from '../audio/waveform.js';
import { SilenceDetector} from '../audio/silence-detector.js';
import { PinManager }     from '../managers/pin-manager.js';
import { SegmentManager } from '../managers/segment-manager.js';
import { Reviewer }       from '../ui/reviewer.js';
import { QuranDisplay }   from '../ui/quran.js';
import { SURAHS, getSurah } from '../data/surahs-data.js';

// ─── Global state ───
const state = {
    user:        null,   // { username, role }
    csrfToken:   null,   // CSRF token from server
    mode:        'dashboard',
    audioBuffer: null,
    audioBlob:   null,
    duration:    0,

    // Récitation en cours
    recitations: [],
    currentRecitationId: null,

    // Sourate récitée (sélectionnée par l'apprenant)
    surahId:  null,  // entier 1-114
    ayahFrom: 1,
    ayahTo:   null,
};

// ─── Logger sécurisé (stack trace uniquement en dev) ───
const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
function logError(context, err) {
    if (isDev) {
        console.error(`[Qiraah] ${context}:`, err);
    } else {
        console.warn(`[Qiraah] Erreur dans : ${context}`);
    }
}

// ─── Module instances ───
let recorder, player, waveform;
let reviewerPlayer, reviewerWaveform;
let silenceDetector, pinManager, segmentManager, reviewer;
let quranDisplay; // QuranDisplay instance

// ─── DOM helpers ───
const $ = id => document.getElementById(id);

// ─── Toast ───
function showToast(msg, type = 'success') {
    const container = $('toastContainer');
    const toast     = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity    = '0';
        toast.style.transition = 'opacity 300ms';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ─── Time formatting ───
function formatTime(s) {
    if (!s || !isFinite(s)) return '00:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function formatDuration(s) {
    if (!s || !isFinite(s)) return '0s';
    if (s < 60) return `${Math.round(s)}s`;
    return `${Math.floor(s/60)}m${Math.round(s%60)}s`;
}

// ─── Sanitize display strings (escapes ', ", <, >, &) ───
function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ─── API client sécurisé (CSRF header automatique) ───
const api = {
    async _fetch(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };
        // Injecter CSRF sur toutes les mutations
        if (state.csrfToken && ['POST','PUT','DELETE','PATCH'].includes(options.method || 'GET')) {
            headers['X-CSRF-Token'] = state.csrfToken;
        }
        const res = await fetch(url, { ...options, headers, credentials: 'same-origin' });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(err.error || `Erreur ${res.status}`);
        }
        return res.json();
    },
    get(url)         { return this._fetch(url); },
    post(url, body)  { return this._fetch(url, { method: 'POST',   body: JSON.stringify(body) }); },
    del(url)         { return this._fetch(url, { method: 'DELETE' }); },
};

// ─── Login ───
async function initLogin() {
    const modal = $('loginModal');

    // Vérifier session PHP existante
    try {
        const session = await api.get('includes/api/auth.php');
        if (session.authenticated && session.user) {
            state.user      = session.user;
            state.csrfToken = session.csrf_token;
            modal.style.display = 'none';
            onUserLoggedIn();
            return;
        }
        // Stocker le token CSRF pour le formulaire
        state.csrfToken = session.csrf_token;
    } catch(e) {
        // Serveur PHP non disponible — mode dégradé local
        _initLoginFallback(modal);
        return;
    }

    _initLoginFallback(modal);
}

function _initLoginFallback(modal) {
    // Role selection
    $('roleLearner').addEventListener('click',  () => {
        $('roleLearner').classList.add('selected');
        $('roleReviewer').classList.remove('selected');
    });
    $('roleReviewer').addEventListener('click', () => {
        $('roleReviewer').classList.add('selected');
        $('roleLearner').classList.remove('selected');
    });

    $('btnLogin').addEventListener('click', async () => {
        const username = $('loginUsername').value.trim();
        if (!username || username.length < 2) {
            $('loginUsername').focus();
            showToast("Veuillez entrer un nom (min. 2 caractères)", 'error');
            return;
        }
        // ASCII uniquement — bloque RTL overrides, zero-width, emoji
        if (!/^[a-zA-Z0-9 \-']{2,50}$/.test(username)) {
            showToast("Nom invalide : lettres, chiffres, tirets uniquement", 'error');
            return;
        }

        const role = $('roleLearner').classList.contains('selected') ? 'learner' : 'reviewer';

        // Tentative de login via PHP session
        try {
            const res = await api.post('includes/api/auth.php', { username, role });
            state.user      = res.user;
            state.csrfToken = res.csrf_token;
        } catch(e) {
            // Fallback si PHP non dispo (dev local sans MAMP actif)
            state.user = { username, role };
        }

        modal.style.display = 'none';
        onUserLoggedIn();
    });

    $('loginUsername').addEventListener('keydown', e => {
        if (e.key === 'Enter') $('btnLogin').click();
    });
}

function onUserLoggedIn() {
    const { username, role } = state.user;

    $('userInfo').style.display     = '';
    $('userDisplayName').textContent = `${username} · ${role === 'learner' ? 'Apprenant' : 'Relecteur'}`;
    if ($('userAvatar')) {
        $('userAvatar').textContent = username.charAt(0).toUpperCase();
    }
    $('modeSwitcher').style.display = '';
    
    // Le bouton de déconnexion est maintenant dans le dropdown, on peut le laisser tel quel
    if ($('btnLogout')) $('btnLogout').style.display = '';

    // Show/hide mode buttons depending on role
    $('btnModeLearner').style.display  = role === 'learner' ? '' : 'none';
    $('btnModeReviewer').style.display = '';

    setMode('dashboard');
}

// ─── Mode switching ───
function setMode(mode) {
    state.mode = mode;

    // Hide all views
    ['viewDashboardLearner','viewDashboardReviewer','viewLearner','viewReviewer'].forEach(id => {
        $(id).style.display = 'none';
    });
    ['sidebarLearner','sidebarReviewer'].forEach(id => {
        $(id).style.display = 'none';
    });

    // Update active btn
    ['dashboard','learner','reviewer'].forEach(m => {
        const btn = $(`btnMode${m.charAt(0).toUpperCase()+m.slice(1)}`);
        if (btn) btn.classList.toggle('mode-switcher__btn--active', m === mode);
    });

    if (mode === 'dashboard') {
        if (state.user?.role === 'learner') {
            $('viewDashboardLearner').style.display = '';
            renderLearnerDashboard();
        } else {
            $('viewDashboardReviewer').style.display = '';
            renderReviewerDashboard();
        }
    } else if (mode === 'learner') {
        $('viewLearner').style.display    = '';
        $('sidebarLearner').style.display = '';
    } else if (mode === 'reviewer') {
        $('viewReviewer').style.display    = '';
        $('sidebarReviewer').style.display = '';
        // Afficher les infos de verset si une sourate a été sélectionnée
        _updateVerseInfoCard();
        if (state.audioBuffer) initReviewerAudio();
    }
}

// ─── Dashboard rendering ───
function renderLearnerDashboard() {
    const rec     = state.recitations;
    const total   = rec.length;
    const submitted = rec.filter(r => r.status === 'submitted').length;
    const reviewed  = rec.filter(r => r.status === 'reviewed').length;

    $('statTotal').textContent     = total;
    $('statSubmitted').textContent = submitted;
    $('statReviewed').textContent  = reviewed;

    const grid = $('learnerRecitationGrid');
    if (total === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
            <div class="empty-state__icon">🎙️</div>
            <div class="empty-state__text">Aucune récitation encore. Créez votre première récitation !</div>
        </div>`;
        return;
    }

    grid.innerHTML = rec.map(r => `
        <div class="recitation-card" data-recitation-id="${esc(r.id)}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-sm);">
                <div class="recitation-card__title">${esc(r.title)}</div>
                <span class="status-badge status-badge--${esc(r.status)}">${statusLabel(r.status)}</span>
            </div>
            <div class="recitation-card__meta">
                <span>🕐 ${formatDuration(r.duration)}</span>
                <span>📍 ${r.pins || 0} pins</span>
                <span>${new Date(r.createdAt).toLocaleDateString('fr-FR')}</span>
            </div>
            ${r.reviewer ? `
            <div class="reviewer-info">
                <div class="reviewer-avatar">${esc(r.reviewer[0].toUpperCase())}</div>
                <span style="font-size:var(--font-size-xs);color:var(--color-text-muted);">Relecteur : <strong style="color:var(--color-gold);">${esc(r.reviewer)}</strong></span>
            </div>` : `
            <div class="reviewer-info" style="opacity:0.4;">
                <span style="font-size:var(--font-size-xs);color:var(--color-text-muted);">Aucun relecteur assigné</span>
            </div>`}
        </div>
    `).join('');

    // Attach click via addEventListener — pas d'onclick inline (XSS fix)
    grid.querySelectorAll('.recitation-card[data-recitation-id]').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            state.currentRecitationId = card.dataset.recitationId;
            setMode('learner');
        });
    });
}

function renderReviewerDashboard() {
    // For reviewer: show all submitted/reviewed recitations
    const toReview = state.recitations.filter(r => r.status === 'submitted');
    const done     = state.recitations.filter(r => r.status === 'reviewed');
    const learners = [...new Set(state.recitations.map(r => r.learnerName).filter(Boolean))];

    $('statPending').textContent  = toReview.length;
    $('statDone').textContent     = done.length;
    $('statLearners').textContent = learners.length;

    const grid = $('reviewerRecitationGrid');
    if (state.recitations.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
            <div class="empty-state__icon">📋</div>
            <div class="empty-state__text">Aucune récitation soumise pour le moment.</div>
        </div>`;
        return;
    }

    grid.innerHTML = state.recitations.map(r => `
        <div class="recitation-card" data-recitation-id="${esc(r.id)}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-sm);">
                <div class="recitation-card__title">${esc(r.title)}</div>
                <span class="status-badge status-badge--${esc(r.status)}">${statusLabel(r.status)}</span>
            </div>
            <div class="recitation-card__meta">
                <span>👤 ${esc(r.learnerName || 'Apprenant')}</span>
                <span>🕐 ${formatDuration(r.duration)}</span>
                <span>📍 ${r.pins || 0} pins</span>
            </div>
        </div>
    `).join('');

    // Attach click via addEventListener (XSS fix — pas d'onclick inline)
    grid.querySelectorAll('.recitation-card[data-recitation-id]').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            state.currentRecitationId = card.dataset.recitationId;
            setMode('reviewer');
        });
    });
}

// Toujours retourner une string connue — jamais de données utilisateur brutes
function statusLabel(status) {
    const labels = { draft: 'Brouillon', submitted: 'En attente', reviewed: 'Corrigée' };
    return labels[status] ?? 'Inconnu';
}

// ─── Audio loading (avec validation taille + timeout) ───
const MAX_AUDIO_SIZE = 200 * 1024 * 1024; // 200 MB
const DECODE_TIMEOUT = 60_000;            // 60s
const ALLOWED_AUDIO_TYPES = ['audio/webm','audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/x-m4a'];

function validateAudioFile(file) {
    if (file.size > MAX_AUDIO_SIZE) {
        throw new Error(`Fichier trop volumineux (max ${MAX_AUDIO_SIZE/1024/1024} Mo)`);
    }
    // MIME check permissif pour accepter les types générés par MediaRecorder
    if (file.type) {
        const typeStr = file.type.toLowerCase();
        if (!typeStr.startsWith('audio/') && !typeStr.startsWith('video/webm')) {
            throw new Error(`Type non supporté : ${file.type}`);
        }
    }
}

async function loadAudioBuffer(blob) {
    if (blob instanceof File || blob instanceof Blob) {
        validateAudioFile(blob);
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    try {
        const ab = await blob.arrayBuffer();
        const decodePromise = ctx.decodeAudioData(ab);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Décodage trop long (timeout 60s)')), DECODE_TIMEOUT)
        );
        return await Promise.race([decodePromise, timeoutPromise]);
    } finally {
        ctx.close();
    }
}

async function onAudioReady(audioBuffer, blob) {
    state.audioBuffer = audioBuffer;
    state.audioBlob   = blob;
    state.duration    = audioBuffer.duration;

    $('panelWaveform').style.display = '';
    $('panelSubmit').style.display   = '';

    // Player
    player = new AudioPlayer();
    await player.load(audioBuffer);

    // Waveform (3 canvas)
    waveform = new Waveform(
        $('waveformCanvas'),
        $('cursorCanvas'),
        $('waveformContainer'),
        $('markerCanvas')
    );
    waveform.setAudioBuffer(audioBuffer);

    // Silence detection
    silenceDetector = new SilenceDetector();
    const threshold = parseFloat($('silenceThreshold').value);
    const silences  = silenceDetector.detect(audioBuffer, { threshold });

    // Pins & segments
    pinManager     = new PinManager();
    segmentManager = new SegmentManager();
    silences.forEach(t => pinManager.addPin(t, null, true));

    _refreshWaveformAndUI();
    $('timeDisplay').textContent = `00:00 / ${formatTime(state.duration)}`;

    // Save recitation to in-memory store
    _saveCurrentRecitation();
    showToast('Audio chargé — pins détectés automatiquement');
}

function _refreshWaveformAndUI() {
    const segs = segmentManager.calculate(pinManager.getPins(), state.duration);
    waveform.setPins(pinManager.getPins());
    waveform.setSegments(segs);
    waveform.draw();
    waveform.drawMarkers();
    renderPinList();
    renderSegmentList();
    renderSegmentRuler($('segmentRuler'), segs, player);
}

// ─── Pin list ───
function renderPinList() {
    const list = $('pinList');
    const pins = pinManager.getPins();
    if (pins.length === 0) {
        list.innerHTML = '<li class="empty-state"><div class="empty-state__text">Aucun pin.</div></li>';
        return;
    }
    list.innerHTML = pins.map((p, i) => `
        <li class="pin-item" data-pin-id="${esc(p.id)}" data-time="${p.time}">
            <span class="pin-item__number">${i+1}</span>
            <span class="pin-item__time">${formatTime(p.time)}</span>
            ${p.isAuto
                ? '<span class="pin-item__badge pin-item__badge--auto">auto</span>'
                : '<span class="pin-item__badge">manuel</span>'}
            <button class="pin-item__delete" data-pin-id="${esc(p.id)}" title="Supprimer">✕</button>
        </li>
    `).join('');
}

// ─── Segment list ───
function renderSegmentList() {
    const list = $('segmentList');
    const segs = segmentManager.getSegments();
    if (segs.length === 0) {
        list.innerHTML = '<li class="empty-state"><div class="empty-state__text">Aucun segment.</div></li>';
        return;
    }
    list.innerHTML = segs.map((s, i) => `
        <li class="segment-item ${i % 2 === 0 ? 'segment-item--even' : 'segment-item--odd'}"
            data-start="${s.start}" data-end="${s.end}">
            <span class="segment-item__label">S${i+1}</span>
            <span class="segment-item__time">${formatTime(s.start)} → ${formatTime(s.end)}</span>
            <span class="segment-item__duration">${(s.end - s.start).toFixed(1)}s</span>
        </li>
    `).join('');
}

// ─── Segment ruler (bar below waveform) ───
function renderSegmentRuler(rulerEl, segments, playerInstance) {
    if (!rulerEl || segments.length === 0 || !state.duration) { rulerEl.innerHTML = ''; return; }
    rulerEl.innerHTML = segments.map((s, i) => {
        const widthPct = ((s.end - s.start) / state.duration * 100).toFixed(2);
        return `<div class="segment-ruler__item" data-start="${s.start}" style="width:${widthPct}%;" title="Segment ${i+1} — ${formatTime(s.start)} → ${formatTime(s.end)}">S${i+1}</div>`;
    }).join('');

    rulerEl.querySelectorAll('.segment-ruler__item').forEach(el => {
        el.addEventListener('click', () => {
            const start = parseFloat(el.dataset.start);
            if (playerInstance) playerInstance.seekTo(start);
            updateTimeDisplay(start, state.duration, playerInstance === player ? 'timeDisplay' : 'reviewerTimeDisplay');
            waveform && waveform.drawCursor(start / state.duration);
            reviewerWaveform && reviewerWaveform.drawCursor(start / state.duration);
        });
    });
}

function updateActiveRulerItem(rulerEl, currentTime) {
    if (!rulerEl || !state.duration) return;
    rulerEl.querySelectorAll('.segment-ruler__item').forEach(el => {
        const start = parseFloat(el.dataset.start);
        // Approximate: the item whose start is nearest and <= currentTime
        const next  = el.nextElementSibling;
        const end   = next ? parseFloat(next.dataset.start) : state.duration;
        el.classList.toggle('segment-ruler__item--active', currentTime >= start && currentTime < end);
    });
}

function updateTimeDisplay(currentTime, duration, displayId) {
    $(displayId).textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
}

// ─── In-memory recitation store ───
function _saveCurrentRecitation() {
    if (!state.user) return;
    const existing = state.recitations.find(r => r.id === state.currentRecitationId);
    if (existing) {
        existing.pins     = pinManager.getPins().length;
        existing.duration = state.duration;
    } else {
        const id = crypto.randomUUID();
        state.currentRecitationId = id;
        state.recitations.push({
            id,
            title:       `Récitation ${state.recitations.length + 1}`,
            status:      'draft',
            duration:    state.duration,
            pins:        pinManager.getPins().length,
            learnerName: state.user?.username,
            reviewer:    null,
            createdAt:   new Date().toISOString(),
        });
    }
}

// ─── Reviewer audio init ───
async function initReviewerAudio() {
    if (!state.audioBuffer) {
        showToast("Veuillez d'abord charger un enregistrement", 'error');
        setMode('learner');
        return;
    }

    reviewer = new Reviewer();
    reviewer.setDuration(state.duration);

    reviewerPlayer = new AudioPlayer();
    await reviewerPlayer.load(state.audioBuffer);

    reviewerWaveform = new Waveform(
        $('reviewerWaveformCanvas'),
        $('reviewerCursorCanvas'),
        $('reviewerWaveformContainer'),
        $('reviewerMarkerCanvas')
    );
    reviewerWaveform.setAudioBuffer(state.audioBuffer);
    reviewerWaveform.setPins(pinManager ? pinManager.getPins() : []);
    reviewerWaveform.setSegments(segmentManager ? segmentManager.getSegments() : []);
    reviewerWaveform.setCorrectionPoints([]);
    reviewerWaveform.draw();
    reviewerWaveform.drawMarkers();

    $('reviewerTimeDisplay').textContent = `00:00 / ${formatTime(state.duration)}`;
    renderSegmentRuler($('reviewerSegmentRuler'), segmentManager ? segmentManager.getSegments() : [], reviewerPlayer);

    // Wire reviewer change handler
    reviewer.onChanged(data => {
        reviewerWaveform.setCorrectionPoints(data.points);
        reviewerWaveform.drawMarkers();
        renderCorrectionList(data.points);
        $('correctionCount').textContent = data.points.length;
    });
}

// ─── Correction list ───
function renderCorrectionList(points) {
    const list = $('correctionList');
    if (!points || points.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-state__text">Aucun point encore.</div></div>';
        return;
    }
    list.innerHTML = points.map(p => `
        <div class="correction-item correction-item--${esc(p.category)}" data-time="${p.time}" data-id="${esc(p.id)}">
            <div class="correction-item__header">
                <span class="correction-item__time">${formatTime(p.time)}</span>
                <span class="correction-item__category correction-item__category--${esc(p.category)}">${esc(p.category)}</span>
                <div class="correction-item__actions">
                    <button class="btn btn--ghost btn--icon" style="width:20px;height:20px;font-size:10px;" data-delete-id="${esc(p.id)}" title="Supprimer">✕</button>
                </div>
            </div>
            ${p.comment
                ? `<div class="correction-item__comment">${esc(p.comment)}</div>`
                : `<textarea class="correction-comment-input" data-comment-id="${esc(p.id)}" placeholder="Ajouter un commentaire..." rows="1"></textarea>`}
        </div>
    `).join('');
}

// ─── Verse info card (sidebar relecteur) ───
function _updateVerseInfoCard() {
    const card = $('panelVerseInfo');
    if (!card) return;
    if (!state.surahId) {
        card.style.display = 'none';
        return;
    }
    const s = getSurah(state.surahId);
    if (!s) { card.style.display = 'none'; return; }
    card.style.display = '';
    $('verseInfoSurah').textContent = `${s.ar} — ${s.fr}`;
    const from = state.ayahFrom || 1;
    const to   = state.ayahTo   || s.ayahs;
    $('verseInfoRange').textContent = from === to
        ? `Verset ${from}`
        : `Versets ${from} → ${to}`;
}

// ─── Calcul du verset approximatif selon le temps de lecture ───
function _computeVerseAtTime(currentTime) {
    if (!state.surahId || !segmentManager || !state.duration) return null;
    const segs   = segmentManager.getSegments();
    if (!segs.length) return null;

    // Trouver le segment courant
    let activeSeg = null;
    let segIndex  = 0;
    for (let i = 0; i < segs.length; i++) {
        if (currentTime >= segs[i].start && currentTime < segs[i].end) {
            activeSeg = segs[i];
            segIndex  = i;
            break;
        }
    }
    if (!activeSeg) return null;

    // Mapper le segment à un verset (distribution linéaire)
    const s      = getSurah(state.surahId);
    const from   = state.ayahFrom || 1;
    const to     = state.ayahTo   ? state.ayahTo : (s ? s.ayahs : from);
    const verses = to - from + 1;
    const ayahIdx = Math.floor(segIndex * verses / segs.length);
    const ayahNum = from + Math.min(ayahIdx, verses - 1);

    // Mot approximatif dans le segment
    const segDuration = activeSeg.end - activeSeg.start;
    const timeInSeg   = Math.max(0, currentTime - activeSeg.start);
    const wordRatio   = segDuration > 0 ? timeInSeg / segDuration : 0;

    return { surahId: state.surahId, ayahNum, wordRatio };
}

// ─── Playback loop ───
function startPlaybackLoop(playerInstance, displayId, wf, rulerEl) {
    const isReviewer = displayId === 'reviewerTimeDisplay';
    const tick = () => {
        if (!playerInstance.isPlaying) return;
        const t   = playerInstance.getCurrentTime();
        const dur = state.duration;
        updateTimeDisplay(t, dur, displayId);
        wf.drawCursor(t / dur);
        updateActiveRulerItem(rulerEl, t);

        // Surlignage verset / mot dans le panneau Coran
        if (quranDisplay && $('panelQuran').style.display !== 'none') {
            const vInfo = _computeVerseAtTime(t);
            if (vInfo) {
                quranDisplay.highlightVerse(vInfo.surahId, vInfo.ayahNum);
                const wordCount = quranDisplay.getActiveVerseWordCount();
                if (wordCount > 0) {
                    const wordIdx = Math.floor(vInfo.wordRatio * wordCount);
                    quranDisplay.highlightWord(wordIdx);
                }
            }
        }

        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

// ─── Play/pause helpers ───
function togglePlay(playerInstance, iconPlay, iconPause, displayId, wf, rulerEl) {
    if (!playerInstance) return;
    if (playerInstance.isPlaying) {
        playerInstance.pause();
        iconPlay.style.display  = '';
        iconPause.style.display = 'none';
    } else {
        playerInstance.play();
        iconPlay.style.display  = 'none';
        iconPause.style.display = '';
        startPlaybackLoop(playerInstance, displayId, wf, rulerEl);
    }
}

function stopPlayer(playerInstance, iconPlay, iconPause, displayId, wf) {
    if (!playerInstance) return;
    playerInstance.stop();
    iconPlay.style.display  = '';
    iconPause.style.display = 'none';
    updateTimeDisplay(0, state.duration, displayId);
    wf.drawCursor(0);
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', async () => {
    await initLogin();

    // ── Mode buttons ──
    $('btnModeDashboard').addEventListener('click', () => setMode('dashboard'));
    $('btnModeLearner').addEventListener('click',   () => setMode('learner'));
    $('btnModeReviewer').addEventListener('click',  () => setMode('reviewer'));

    // ── Logout (invalide session PHP côté serveur) ──
    $('btnLogout').addEventListener('click', async () => {
        try { await api.del('includes/api/auth.php'); } catch(_) { /* ignore */ }
        state.user = null;
        state.csrfToken = null;
        location.reload();
    });

    // ── New recitation ──
    $('btnNewRecitation').addEventListener('click', () => {
        state.currentRecitationId = null;
        setMode('learner');
    });

    // ── Recording ──
    recorder = new AudioRecorder($('vuMeterFill'));

    // ── Recording (Push To Talk / Legacy) ──
    const btnPtt = $('btnPttRecord');
    let isPttRecording = false;

    const startPttRecord = async () => {
        if (isPttRecording) return;
        try {
            await recorder.start();
            isPttRecording = true;
            if (btnPtt) btnPtt.style.background = 'var(--color-danger)';
            const pttStatus = $('pttStatus');
            if (pttStatus) {
                pttStatus.textContent = "● Enregistrement en cours...";
                pttStatus.style.color = "var(--color-danger)";
            }
        } catch(e) {
            showToast('Accès au microphone refusé', 'error');
            logError('audio', e);
        }
    };

    const stopPttRecord = async () => {
        if (!isPttRecording) return;
        if (recorder.isRecording()) {
            const { blob } = await recorder.stop();
            isPttRecording = false;
            if (btnPtt) btnPtt.style.background = '';
            const pttStatus = $('pttStatus');
            if (pttStatus) {
                pttStatus.textContent = "Relâché. Bloc enregistré.";
                pttStatus.style.color = "var(--color-gold)";
            }
            console.log("Recorded block:", blob);
        }
    };

    if (btnPtt) {
        btnPtt.addEventListener('mousedown', startPttRecord);
        btnPtt.addEventListener('mouseup', stopPttRecord);
        btnPtt.addEventListener('mouseleave', stopPttRecord);
    }

    // Espace pour enregistrer (Push-to-Talk)
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault(); // Empêche le scroll
            startPttRecord();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            stopPttRecord();
        }
    });

    if ($('btnRecord')) {
        $('btnRecord').addEventListener('click', async () => {
            if (recorder.isRecording()) {
                const { blob } = await recorder.stop();
                $('btnRecord').classList.remove('recording');
                $('iconRecordStart').style.display = '';
                $('iconRecordStop').style.display  = 'none';
                $('recordStatus').textContent      = 'Traitement...';
                $('recordStatus').classList.remove('record-status--active');

                try {
                    const buf = await loadAudioBuffer(blob);
                    await onAudioReady(buf, blob);
                    $('recordStatus').textContent = 'Enregistrement terminé';
                } catch(e) {
                    showToast('Erreur lors du décodage audio', 'error');
                    $('recordStatus').textContent = 'Erreur';
                    logError('audio', e);
                }
            } else {
                try {
                    await recorder.start();
                    $('btnRecord').classList.add('recording');
                    $('iconRecordStart').style.display = 'none';
                    $('iconRecordStop').style.display  = '';
                    $('recordStatus').textContent      = '● Enregistrement en cours...';
                    $('recordStatus').classList.add('record-status--active');
                } catch(e) {
                    showToast('Accès au microphone refusé', 'error');
                    logError('audio', e);
                }
            }
        });
    }

    // ── File import ──
    if ($('fileInput')) {
        $('fileInput').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            $('recordStatus').textContent = 'Chargement...';
            try {
                const buf = await loadAudioBuffer(file);
                await onAudioReady(buf, file);
                $('recordStatus').textContent = file.name;
            } catch(e) {
                showToast('Format audio non supporté', 'error');
                $('recordStatus').textContent = 'Erreur';
                logError('audio', e);
            }
        });
    }

    if ($('fileDrop')) {
        $('fileDrop').addEventListener('dragover', e => { e.preventDefault(); $('fileDrop').classList.add('file-drop--active'); });
        $('fileDrop').addEventListener('dragleave', ()  => $('fileDrop').classList.remove('file-drop--active'));
        $('fileDrop').addEventListener('drop', async e => {
            e.preventDefault();
            $('fileDrop').classList.remove('file-drop--active');
            const file = e.dataTransfer.files[0];
            if (!file) return;
            try {
                const buf = await loadAudioBuffer(file);
                await onAudioReady(buf, file);
                $('recordStatus').textContent = file.name;
            } catch(err) { showToast('Format audio non supporté', 'error'); logError('drop', err); }
        });
    }

    // ── Learner transport ──
    if ($('btnPlayPause')) {
        $('btnPlayPause').addEventListener('click', () =>
            togglePlay(player, $('iconPlay'), $('iconPause'), 'timeDisplay', waveform, $('segmentRuler'))
        );
    }
    if ($('btnStop')) {
        $('btnStop').addEventListener('click', () =>
            stopPlayer(player, $('iconPlay'), $('iconPause'), 'timeDisplay', waveform)
        );
    }
    if ($('btnPrevSegment')) {
        $('btnPrevSegment').addEventListener('click', () => {
            if (!player || !segmentManager) return;
            const seg = segmentManager.getPrevSegment(player.getCurrentTime());
            if (seg) { player.seekTo(seg.start); waveform.drawCursor(seg.start / state.duration); }
        });
    }
    if ($('btnNextSegment')) {
        $('btnNextSegment').addEventListener('click', () => {
            if (!player || !segmentManager) return;
            const seg = segmentManager.getNextSegment(player.getCurrentTime());
            if (seg) { player.seekTo(seg.start); waveform.drawCursor(seg.start / state.duration); }
        });
    }

    // ── Waveform click → seek ──
    if ($('waveformContainer')) {
        $('waveformContainer').addEventListener('click', e => {
            if (!player || !state.duration) return;
            const rect  = $('waveformContainer').getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            const t     = ratio * state.duration;
            player.seekTo(t);
            updateTimeDisplay(t, state.duration, 'timeDisplay');
            waveform.drawCursor(ratio);
        });

        // ── Double-click on waveform → add pin ──
        $('waveformContainer').addEventListener('dblclick', e => {
            if (!pinManager || !state.duration) return;
            const rect  = $('waveformContainer').getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            const t     = ratio * state.duration;
            pinManager.addPin(t, null, false);
            _refreshWaveformAndUI();
            showToast(`Pin ajouté à ${formatTime(t)}`);
        });
    }

    // ── Pin list interactions ──
    if ($('pinList')) {
        $('pinList').addEventListener('click', e => {
            const del = e.target.closest('[data-pin-id].pin-item__delete, button[data-pin-id]');
            if (del && del.classList.contains('pin-item__delete')) {
                pinManager.removePin(del.dataset.pinId);
                _refreshWaveformAndUI();
                return;
            }
            const item = e.target.closest('.pin-item');
            if (item && player) {
                const t = parseFloat(item.dataset.time);
                player.seekTo(t);
                updateTimeDisplay(t, state.duration, 'timeDisplay');
                waveform.drawCursor(t / state.duration);
            }
        });
    }

    // ── Segment list click ──
    if ($('segmentList')) {
        $('segmentList').addEventListener('click', e => {
            const item = e.target.closest('.segment-item');
            if (item && player) {
                const start = parseFloat(item.dataset.start);
                player.seekTo(start);
                updateTimeDisplay(start, state.duration, 'timeDisplay');
                waveform.drawCursor(start / state.duration);
            }
        });
    }

    // ── Add pin button ──
    if ($('btnAddPin')) {
        $('btnAddPin').addEventListener('click', () => {
            if (!pinManager || !player) return;
            const t = player.getCurrentTime();
            pinManager.addPin(t, null, false);
            _refreshWaveformAndUI();
            showToast(`Pin ajouté à ${formatTime(t)}`);
        });
    }

    // ── Silence re-detection ──
    const redetect = () => {
        if (!state.audioBuffer || !silenceDetector) return;
        const threshold = parseFloat($('silenceThreshold').value);
        const silences  = silenceDetector.detect(state.audioBuffer, { threshold });
        // Keep manual pins, replace auto pins
        const manualPins = pinManager.getPins().filter(p => !p.isAuto);
        pinManager.clear();
        manualPins.forEach(p => pinManager.addPin(p.time, p.label, false));
        silences.forEach(t => pinManager.addPin(t, null, true));
        _refreshWaveformAndUI();
    };
    if ($('silenceThreshold')) {
        $('silenceThreshold').addEventListener('input', redetect);
    }
    if ($('btnDetectSilences')) {
        $('btnDetectSilences').addEventListener('click', redetect);
    }

    // ── Speed sliders ──
    function _applySpeed(slider, labelId, playerInstance) {
        const v   = parseFloat(slider.value);
        const min = parseFloat(slider.min) || 0.5;
        const max = parseFloat(slider.max) || 2;
        if (!isFinite(v)) return;

        // Label : "0.75×" ou "1×"
        const label = (v === Math.round(v))
            ? `${Math.round(v)}×`
            : `${v.toFixed(2).replace(/\.?0+$/, '')}×`;
        $(labelId).textContent = label;

        // Mise à jour du gradient de remplissage (barre colorée sous le thumb)
        const pct = ((v - min) / (max - min) * 100).toFixed(1);
        slider.style.background =
            `linear-gradient(to right, var(--color-gold-dim) 0%, var(--color-gold-dim) ${pct}%, rgba(212,168,71,0.15) ${pct}%)`;

        if (playerInstance) playerInstance.setPlaybackRate(v);
    }

    // Init les gradients au démarrage (valeur = 1)
    if ($('speedSlider')) {
        _applySpeed($('speedSlider'), 'speedLabel', null);
        $('speedSlider').addEventListener('input', () =>
            _applySpeed($('speedSlider'), 'speedLabel', player)
        );
    }
    if ($('reviewerSpeedSlider')) {
        _applySpeed($('reviewerSpeedSlider'), 'reviewerSpeedLabel', null);
        $('reviewerSpeedSlider').addEventListener('input', () =>
            _applySpeed($('reviewerSpeedSlider'), 'reviewerSpeedLabel', reviewerPlayer)
        );
    }

    // ── Initialiser le dropdown des sourates ──
    (function _initSurahSelect() {
        const sel = $('surahSelect');
        SURAHS.forEach(s => {
            const opt = document.createElement('option');
            opt.value = String(s.id);
            // textContent — jamais innerHTML (données statiques mais bonne pratique)
            opt.textContent = `${s.id}. ${s.ar} — ${s.fr}`;
            sel.appendChild(opt);
        });
    })();

    // ── Surah selector : mettre à jour l'ayah max et l'état ──
    $('surahSelect').addEventListener('change', () => {
        const sid = parseInt($('surahSelect').value, 10);
        if (!Number.isInteger(sid) || sid < 1 || sid > 114) {
            state.surahId = null;
            $('ayahFrom').max = 286;
            $('ayahTo').max   = 286;
            return;
        }
        const s = getSurah(sid);
        if (!s) return;
        state.surahId = sid;
        $('ayahFrom').max = s.ayahs;
        $('ayahTo').max   = s.ayahs;
        $('ayahFrom').value = '1';
        $('ayahTo').value   = '';
        state.ayahFrom = 1;
        state.ayahTo   = null;
    });

    $('ayahFrom').addEventListener('change', () => {
        state.ayahFrom = parseInt($('ayahFrom').value, 10) || 1;
    });
    $('ayahTo').addEventListener('change', () => {
        const v = parseInt($('ayahTo').value, 10);
        state.ayahTo = (v && v > 0) ? v : null;
    });

    // ── Quran display init ──
    quranDisplay = new QuranDisplay($('quranPanelContent'), $('quranPageLabel'));

    // ── Charger et afficher le Coran ──
    $('btnLoadQuran').addEventListener('click', async () => {
        if (!state.surahId) {
            showToast('Sélectionnez d\'abord une sourate', 'error');
            return;
        }
        $('panelQuran').style.display = '';
        await quranDisplay.loadSurah(state.surahId, state.ayahFrom, state.ayahTo);
        // Scroll vers le panneau
        $('panelQuran').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // ── Navigation page Coran ──
    $('btnQuranPrevPage').addEventListener('click', async () => {
        await quranDisplay.prevPage();
    });
    $('btnQuranNextPage').addEventListener('click', async () => {
        await quranDisplay.nextPage();
    });
    if ($('btnCloseQuran')) {
        $('btnCloseQuran').addEventListener('click', () => {
            $('panelQuran').style.display = 'none';
        });
    }

    // ── Submit for review ──
    $('btnSubmitReview').addEventListener('click', () => {
        if (!state.audioBuffer) return;
        const rec = state.recitations.find(r => r.id === state.currentRecitationId);
        if (rec) rec.status = 'submitted';
        showToast('Récitation soumise pour correction');
        setMode('dashboard');
    });

    // ── Reviewer transport ──
    $('btnReviewerPlayPause').addEventListener('click', () =>
        togglePlay(reviewerPlayer, $('reviewerIconPlay'), $('reviewerIconPause'), 'reviewerTimeDisplay', reviewerWaveform, $('reviewerSegmentRuler'))
    );
    $('btnReviewerStop').addEventListener('click', () =>
        stopPlayer(reviewerPlayer, $('reviewerIconPlay'), $('reviewerIconPause'), 'reviewerTimeDisplay', reviewerWaveform)
    );
    $('btnReviewerPrevSegment').addEventListener('click', () => {
        if (!reviewerPlayer || !segmentManager) return;
        const seg = segmentManager.getPrevSegment(reviewerPlayer.getCurrentTime());
        if (seg) { reviewerPlayer.seekTo(seg.start); reviewerWaveform.drawCursor(seg.start / state.duration); }
    });
    $('btnReviewerNextSegment').addEventListener('click', () => {
        if (!reviewerPlayer || !segmentManager) return;
        const seg = segmentManager.getNextSegment(reviewerPlayer.getCurrentTime());
        if (seg) { reviewerPlayer.seekTo(seg.start); reviewerWaveform.drawCursor(seg.start / state.duration); }
    });

    // ── Reviewer waveform click ──
    $('reviewerWaveformContainer').addEventListener('click', e => {
        if (!reviewerPlayer || !state.duration) return;
        const rect  = $('reviewerWaveformContainer').getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        const t     = ratio * state.duration;
        reviewerPlayer.seekTo(t);
        updateTimeDisplay(t, state.duration, 'reviewerTimeDisplay');
        reviewerWaveform.drawCursor(ratio);
    });

    // ── Category buttons ──
    $('categoryBar').addEventListener('click', e => {
        const btn = e.target.closest('.category-btn');
        if (!btn || !reviewer || !reviewerPlayer) return;
        const cat = btn.dataset.category;
        const t   = reviewerPlayer.getCurrentTime();
        reviewer.addPoint(t, cat);
        showToast(`Erreur ${cat} marquée à ${formatTime(t)}`);
    });

    // ── Correction list interactions ──
    $('correctionList').addEventListener('click', e => {
        // Delete button
        const delBtn = e.target.closest('[data-delete-id]');
        if (delBtn && reviewer) {
            reviewer.removePoint(delBtn.dataset.deleteId);
            return;
        }
        // Click on item → seek
        const item = e.target.closest('.correction-item');
        if (item && reviewerPlayer) {
            const t = parseFloat(item.dataset.time);
            reviewerPlayer.seekTo(t);
            updateTimeDisplay(t, state.duration, 'reviewerTimeDisplay');
            reviewerWaveform.drawCursor(t / state.duration);
        }
    });

    // Comment input on correction items
    $('correctionList').addEventListener('input', e => {
        const ta = e.target.closest('textarea[data-comment-id]');
        if (ta && reviewer) {
            reviewer.updateComment(ta.dataset.commentId, ta.value);
        }
    });

    // ── Checklist ──
    $('checklist').addEventListener('change', e => {
        const cb = e.target;
        if (cb.type === 'checkbox' && reviewer) {
            const key = cb.name.replace('checklist_', '');
            reviewer.setChecklist(key, cb.checked);
        }
    });

    // ── Global comment ──
    $('globalComment').addEventListener('input', e => {
        if (reviewer) reviewer.setGlobalComment(e.target.value);
    });

    // ── Verdict cards ──
    $('verdictGroup').addEventListener('click', e => {
        const card = e.target.closest('.verdict-card');
        if (!card) return;
        $('verdictGroup').querySelectorAll('.verdict-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        if (reviewer) reviewer.setVerdict(card.dataset.verdict);
    });

    // ── Export JSON ──
    $('btnExportJson').addEventListener('click', () => {
        if (!reviewer) { showToast('Aucune correction à exporter', 'error'); return; }
        const json = reviewer.exportJSON({
            title: 'Récitation',
            pins:  pinManager ? pinManager.getPins() : [],
        });
        const blob = new Blob([json], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `correction-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Correction exportée en JSON');
    });

    // ── Save correction ──
    $('btnSaveCorrection').addEventListener('click', () => {
        if (!reviewer) { showToast('Aucune correction à sauvegarder', 'error'); return; }
        const rec = state.recitations.find(r => r.id === state.currentRecitationId);
        if (rec) rec.status = 'reviewed';
        showToast('Correction sauvegardée');
    });

    // ── Keyboard shortcuts ──
    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const p  = state.mode === 'reviewer' ? reviewerPlayer : player;
        const wf = state.mode === 'reviewer' ? reviewerWaveform : waveform;
        if (!p || !wf) return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                if (state.mode === 'reviewer') $('btnReviewerPlayPause').click();
                else $('btnPlayPause').click();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (state.mode === 'reviewer') $('btnReviewerPrevSegment').click();
                else $('btnPrevSegment').click();
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (state.mode === 'reviewer') $('btnReviewerNextSegment').click();
                else $('btnNextSegment').click();
                break;
        }
    });
});

// Pas d'exposition globale window.app — tous les handlers via addEventListener
