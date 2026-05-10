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
import { QuranDisplay }   from '../ui/quran.js?v=verse-cards-2';
import { SURAHS, getSurah } from '../data/surahs-data.js';

// ─── Global state ───
const state = {
    user:        null,   // { username, role }
    csrfToken:   null,   // CSRF token from server
    mode:        'dashboard',
    audioBuffer: null,
    audioBlob:   null,
    duration:    0,
    audioBlocks: [],

    // Récitation en cours
    recitations: [],
    currentRecitationId: null,
    versePlan: [],
    currentVerseIndex: 0,
    recordMode: 'hold',

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
const verseReferenceAudio = new Audio();

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
        if (res.status === 401) {
            // Session expirée ou non authentifié
            state.user = null;
            $('loginModal').style.display = 'flex';
            throw new Error('Session expirée. Veuillez vous reconnecter.');
        }
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
    $('btnModeReviewer').style.display = role === 'reviewer' ? '' : 'none';

    setMode('dashboard');
}

// ─── Mode switching ───
function setMode(mode) {
    state.mode = mode;
    document.body.dataset.mode = mode;

    // Hide all views and the sidebar container
    ['viewDashboardLearner','viewDashboardReviewer','viewLearner','viewReviewer','viewFeedback'].forEach(id => {
        const el = $(id);
        if (el) el.style.display = 'none';
    });
    if ($('sidebar')) $('sidebar').style.display = 'none';
    ['sidebarLearner','sidebarReviewer'].forEach(id => {
        const el = $(id);
        if (el) el.style.display = 'none';
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
        const vl = $('viewLearner');
        if (vl) vl.style.display = '';
        // Note: sidebarLearner has been removed from index.php, so we don't show the sidebar here
    } else if (mode === 'reviewer') {
        if (state.user?.role !== 'reviewer') {
            const rec = state.recitations.find(r => r.id === state.currentRecitationId);
            if (rec?.status === 'reviewed') {
                renderFeedback(rec);
                setMode('feedback');
            } else {
                showToast("La correction est réservée au professeur", 'error');
                setMode('dashboard');
            }
            return;
        }
        const vr = $('viewReviewer');
        if (vr) vr.style.display = '';
        if ($('sidebar')) $('sidebar').style.display = 'flex';
        const sr = $('sidebarReviewer');
        if (sr) sr.style.display = '';
        // Afficher les infos de verset si une sourate a été sélectionnée
        _updateVerseInfoCard();
        if (state.audioBuffer) initReviewerAudio();
    } else if (mode === 'feedback') {
        const vf = $('viewFeedback');
        if (vf) vf.style.display = '';
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
                <span>${(r.versePlan || []).filter(v => v.buffer).length}/${(r.versePlan || []).length || 0} versets</span>
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
            const rec = state.recitations.find(r => r.id === card.dataset.recitationId);
            loadRecitationIntoState(card.dataset.recitationId);
            if (rec?.status === 'reviewed') {
                renderFeedback(rec);
                setMode('feedback');
            } else {
                setMode('learner');
            }
        });
    });
}

function renderReviewerDashboard() {
    // For reviewer: show all submitted/reviewed recitations
    const toReview = state.recitations.filter(r => r.status === 'submitted');
    const done     = state.recitations.filter(r => r.status === 'reviewed');
    const learners = [...new Set(state.recitations.map(r => r.learnerName).filter(Boolean))];
    const reviewable = state.recitations.filter(r => r.status !== 'draft');

    $('statPending').textContent  = toReview.length;
    $('statDone').textContent     = done.length;
    $('statLearners').textContent = learners.length;

    const grid = $('reviewerRecitationGrid');
    if (reviewable.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
            <div class="empty-state__icon">📋</div>
            <div class="empty-state__text">Aucune récitation soumise pour le moment.</div>
        </div>`;
        return;
    }

    grid.innerHTML = reviewable.map(r => `
        <div class="recitation-card" data-recitation-id="${esc(r.id)}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-sm);">
                <div class="recitation-card__title">${esc(r.title)}</div>
                <span class="status-badge status-badge--${esc(r.status)}">${statusLabel(r.status)}</span>
            </div>
            <div class="recitation-card__meta">
                <span>👤 ${esc(r.learnerName || 'Apprenant')}</span>
                <span>🕐 ${formatDuration(r.duration)}</span>
                <span>${(r.versePlan || []).filter(v => v.buffer).length}/${(r.versePlan || []).length || 0} versets</span>
            </div>
        </div>
    `).join('');

    // Attach click via addEventListener (XSS fix — pas d'onclick inline)
    grid.querySelectorAll('.recitation-card[data-recitation-id]').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            loadRecitationIntoState(card.dataset.recitationId);
            setMode('reviewer');
        });
    });
}

// Toujours retourner une string connue — jamais de données utilisateur brutes
function statusLabel(status) {
    const labels = { draft: 'Brouillon', submitted: 'En attente', reviewed: 'Corrigée' };
    return labels[status] ?? 'Inconnu';
}

function verdictLabel(verdict) {
    const labels = { ok: 'Validé', to_correct: 'À corriger', redo: 'À refaire' };
    return labels[verdict] ?? 'En attente';
}

function getCurrentVerse() {
    return state.versePlan[state.currentVerseIndex] || null;
}

function prepareVersePlanFromSelection({ preserve = true } = {}) {
    const surah = getSurah(state.surahId);
    if (!surah) {
        state.versePlan = [];
        state.audioBlocks = [];
        state.currentVerseIndex = 0;
        renderVerseCards();
        updateVerseProgress();
        return;
    }

    const from = Math.max(1, Math.min(state.ayahFrom || 1, surah.ayahs));
    const to = Math.max(from, Math.min(state.ayahTo || surah.ayahs, surah.ayahs));
    const previous = preserve
        ? new Map(state.versePlan.map(verse => [`${verse.surah}:${verse.ayah}`, verse]))
        : new Map();

    state.versePlan = [];
    for (let ayah = from; ayah <= to; ayah++) {
        const key = `${state.surahId}:${ayah}`;
        const old = previous.get(key);
        state.versePlan.push(old || {
            id: key,
            surah: state.surahId,
            ayah,
            number: null,
            text: '',
            translation: '',
            phonetics: '',
            blob: null,
            buffer: null,
            url: null,
            duration: 0,
        });
    }

    state.audioBlocks = state.versePlan.filter(verse => verse.buffer);
    state.currentVerseIndex = Math.min(state.currentVerseIndex, Math.max(0, state.versePlan.length - 1));
    renderVerseCards();
    updateVerseProgress();
}

function updateSelectionStateFromInputs() {
    const sid = parseInt($('surahSelect')?.value, 10);
    if (!Number.isInteger(sid) || sid < 1 || sid > 114) {
        state.surahId = null;
        state.ayahFrom = 1;
        state.ayahTo = null;
        return false;
    }

    const surah = getSurah(sid);
    const from = Math.max(1, Math.min(parseInt($('ayahFrom')?.value, 10) || 1, surah?.ayahs || 286));
    const rawTo = parseInt($('ayahTo')?.value, 10);
    const to = Number.isInteger(rawTo) && rawTo > 0
        ? Math.max(from, Math.min(rawTo, surah?.ayahs || rawTo))
        : null;

    state.surahId = sid;
    state.ayahFrom = from;
    state.ayahTo = to;

    if (surah) {
        if ($('ayahFrom')) $('ayahFrom').max = surah.ayahs;
        if ($('ayahTo')) $('ayahTo').max = surah.ayahs;
    }

    return true;
}

function hydrateVersePlanFromAyahs(ayahs) {
    const byKey = new Map((ayahs || []).map(ayah => [`${ayah.surah}:${ayah.numberInSurah}`, ayah]));
    state.versePlan.forEach(verse => {
        const data = byKey.get(`${verse.surah}:${verse.ayah}`);
        if (!data) return;
        verse.number = data.number || verse.number;
        verse.text = data.text || verse.text;
        verse.translation = data.translation || verse.translation;
        verse.phonetics = data.phonetics || verse.phonetics;
    });
}

function renderArabicWords(container, text, showTajweed = true) {
    const source = String(text || '');
    const pattern = /\[([a-zA-Z]+)(?::\d+)?\[([^\]]+)\]/g;
    let cursor = 0;
    let match;
    let wordIndex = 0;

    const appendWords = value => {
        value.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
                container.appendChild(document.createTextNode(part));
                return;
            }
            const word = document.createElement('span');
            word.className = 'quran-word';
            word.dataset.word = String(wordIndex++);
            word.textContent = part;
            container.appendChild(word);
        });
    };

    while ((match = pattern.exec(source)) !== null) {
        appendWords(source.slice(cursor, match.index));
        if (showTajweed) {
            const mark = document.createElement('tajweed');
            mark.className = `tj-${match[1]}`;
            mark.textContent = match[2];
            container.appendChild(mark);
        } else {
            appendWords(match[2]);
        }
        cursor = pattern.lastIndex;
    }

    appendWords(source.slice(cursor));
}

function playVerseReference(verse, button) {
    if (!verse?.number) {
        showToast('Audio du verset en cours de chargement', 'error');
        return;
    }
    const url = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${verse.number}.mp3`;
    const resetButton = () => {
        if (button) button.textContent = 'Écouter';
    };

    if (verseReferenceAudio.src === url && !verseReferenceAudio.paused) {
        verseReferenceAudio.pause();
        resetButton();
        return;
    }

    verseReferenceAudio.src = url;
    verseReferenceAudio.play().catch(err => logError('verse audio', err));
    if (button) button.textContent = 'Pause';
    verseReferenceAudio.onended = resetButton;
}

function copyVerseText(verse) {
    const text = String(verse?.text || '').replace(/\[([a-zA-Z]+)(?::\d+)?\[([^\]]+)\]/g, '$2').trim();
    if (!text) {
        showToast('Texte du verset en cours de chargement', 'error');
        return;
    }
    navigator.clipboard.writeText(text)
        .then(() => showToast('Verset copié'))
        .catch(err => logError('copy verse', err));
}

function selectVerseIndex(index) {
    if (!state.versePlan.length) return;
    state.currentVerseIndex = Math.max(0, Math.min(index, state.versePlan.length - 1));
    renderVerseCards();
    updateVerseProgress();

    const verse = getCurrentVerse();
    if (verse && quranDisplay) {
        quranDisplay.highlightVerse(verse.surah, verse.ayah);
    }

    const activeCard = $('blocksContainer')?.querySelector('.verse-record-card--active');
    if (activeCard) activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

async function clearVerseRecording(verseId) {
    const verse = state.versePlan.find(item => item.id === verseId);
    if (!verse) return;
    if (verse.url) URL.revokeObjectURL(verse.url);
    verse.blob = null;
    verse.buffer = null;
    verse.url = null;
    verse.duration = 0;
    await rebuildAudioFromBlocks();
    renderVerseCards();
    updateVerseProgress();
}

function renderVerseCards() {
    const container = $('blocksContainer');
    const emptyState = $('blocksEmptyState');
    if (!container) return;

    container.querySelectorAll('.verse-record-card').forEach(card => card.remove());

    if (!state.versePlan.length) {
        if (emptyState) emptyState.style.display = '';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    state.versePlan.forEach((verse, index) => {
        const card = document.createElement('article');
        card.className = `verse-record-card${index === state.currentVerseIndex ? ' verse-record-card--active' : ''}${verse.buffer ? ' verse-record-card--done' : ''}`;
        card.dataset.verseId = verse.id;

        const header = document.createElement('div');
        header.className = 'verse-record-card__header';

        const label = document.createElement('button');
        label.type = 'button';
        label.className = 'verse-record-card__label';
        label.textContent = `Verset ${verse.ayah}`;
        label.addEventListener('click', () => selectVerseIndex(index));

        const status = document.createElement('span');
        status.className = 'verse-record-card__status';
        status.textContent = verse.buffer ? 'Enregistré' : 'À faire';

        header.appendChild(label);
        header.appendChild(status);
        card.appendChild(header);

        const arabic = document.createElement('div');
        arabic.className = 'verse-record-card__arabic';
        arabic.dir = 'rtl';
        arabic.lang = 'ar';
        if (verse.text) {
            renderArabicWords(arabic, verse.text, $('optTajweed') ? $('optTajweed').checked : true);
        } else {
            arabic.textContent = 'Chargement du verset...';
        }
        card.appendChild(arabic);

        if ($('optTranslation')?.checked && verse.translation) {
            const translation = document.createElement('div');
            translation.className = 'verse-record-card__translation';
            translation.textContent = verse.translation;
            card.appendChild(translation);
        }

        const recording = document.createElement('div');
        recording.className = 'verse-record-card__recording';
        if (verse.url) {
            const audio = document.createElement('audio');
            audio.src = verse.url;
            audio.controls = true;
            audio.preload = 'metadata';
            recording.appendChild(audio);
        } else {
            recording.textContent = index === state.currentVerseIndex
                ? 'Prêt à enregistrer ce verset.'
                : 'Choisissez cette carte pour enregistrer.';
        }
        card.appendChild(recording);

        const actions = document.createElement('div');
        actions.className = 'verse-record-card__actions';

        const listenBtn = document.createElement('button');
        listenBtn.type = 'button';
        listenBtn.className = 'btn btn--ghost';
        listenBtn.textContent = 'Écouter';
        listenBtn.addEventListener('click', () => playVerseReference(verse, listenBtn));
        actions.appendChild(listenBtn);

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn btn--ghost';
        copyBtn.textContent = 'Copier';
        copyBtn.addEventListener('click', () => copyVerseText(verse));
        actions.appendChild(copyBtn);

        const tafsirBtn = document.createElement('button');
        tafsirBtn.type = 'button';
        tafsirBtn.className = 'btn btn--ghost';
        tafsirBtn.textContent = 'Tafsir';
        tafsirBtn.addEventListener('click', () => quranDisplay?._showTafsir(verse.surah, verse.ayah));
        actions.appendChild(tafsirBtn);

        const selectBtn = document.createElement('button');
        selectBtn.type = 'button';
        selectBtn.className = 'btn btn--ghost';
        selectBtn.textContent = index === state.currentVerseIndex ? 'Actif' : 'Choisir';
        selectBtn.addEventListener('click', () => selectVerseIndex(index));
        actions.appendChild(selectBtn);

        if (verse.buffer) {
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'btn btn--ghost';
            clearBtn.textContent = 'Refaire';
            clearBtn.addEventListener('click', () => clearVerseRecording(verse.id));
            actions.appendChild(clearBtn);
        }
        card.appendChild(actions);

        container.appendChild(card);
    });
}

function updateVerseProgress() {
    const total = state.versePlan.length;
    const recorded = state.versePlan.filter(verse => verse.buffer).length;
    const current = getCurrentVerse();
    const percent = total ? Math.round(recorded / total * 100) : 0;

    if ($('verseProgressText')) {
        $('verseProgressText').textContent = total ? `${recorded}/${total} versets enregistrés` : 'Sélectionnez une sourate';
    }
    if ($('verseProgressBar')) $('verseProgressBar').style.width = `${percent}%`;
    if ($('currentVerseLabel')) $('currentVerseLabel').textContent = current ? `Verset ${current.ayah}` : 'Aucun verset actif';
    if ($('currentVerseMeta')) {
        $('currentVerseMeta').textContent = current
            ? (current.buffer ? 'Déjà enregistré. Vous pouvez le refaire si besoin.' : 'Récitez le verset entier dans un seul enregistrement.')
            : 'Choisissez une sourate et une plage de versets.';
    }
    if ($('pttStatus') && !(recorder?.isRecording?.())) {
        $('pttStatus').textContent = current
            ? (state.recordMode === 'hold'
                ? `Maintenez le bouton ou Espace pour enregistrer le verset ${current.ayah}.`
                : `Appuyez pour enregistrer le verset ${current.ayah}.`)
            : 'Choisissez un verset, puis maintenez le bouton pour enregistrer.';
        $('pttStatus').style.color = 'var(--color-gold)';
    }
    if ($('panelSubmit')) $('panelSubmit').style.display = total && recorded === total ? 'block' : 'none';
    if ($('btnSubmitReview')) $('btnSubmitReview').disabled = !total || recorded !== total;
}

// ─── Audio loading (avec validation taille + timeout) ───
const MAX_AUDIO_SIZE = 200 * 1024 * 1024; // 200 MB
const DECODE_TIMEOUT = 60_000;            // 60s
const ALLOWED_AUDIO_TYPES = ['audio/webm','audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/x-m4a'];
const MIN_RECORDING_MS = 600;
const MIN_RECORDING_BYTES = 512;

function validateAudioFile(file) {
    if (!file || file.size < MIN_RECORDING_BYTES) {
        throw new Error('Enregistrement trop court. Gardez au moins une seconde de voix.');
    }
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

function createMergedAudioBuffer(blocks) {
    if (!blocks.length) return null;

    const sampleRate = blocks[0].buffer.sampleRate;
    const channelCount = Math.max(...blocks.map(block => block.buffer.numberOfChannels));
    const totalLength = blocks.reduce((sum, block) => sum + block.buffer.length, 0);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    try {
        const merged = ctx.createBuffer(channelCount, Math.max(1, totalLength), sampleRate);
        let offset = 0;

        blocks.forEach(block => {
            for (let channel = 0; channel < channelCount; channel++) {
                const sourceChannel = Math.min(channel, block.buffer.numberOfChannels - 1);
                merged.getChannelData(channel).set(block.buffer.getChannelData(sourceChannel), offset);
            }
            offset += block.buffer.length;
        });

        return merged;
    } finally {
        ctx.close();
    }
}

async function rebuildAudioFromBlocks() {
    const recordedBlocks = state.versePlan.length
        ? state.versePlan.filter(verse => verse.buffer)
        : state.audioBlocks.filter(block => block.buffer);

    state.audioBlocks = recordedBlocks;

    if (!recordedBlocks.length) {
        state.audioBuffer = null;
        state.audioBlob = null;
        state.duration = 0;
        if (player?.audioContext) player.audioContext.close();
        player = null;
        pinManager = new PinManager();
        segmentManager = new SegmentManager();
        _saveCurrentRecitation();
        return;
    }

    const merged = createMergedAudioBuffer(recordedBlocks);
    state.audioBuffer = merged;
    state.audioBlob = null;
    state.duration = merged.duration;

    if (!player) player = new AudioPlayer();
    await player.load(merged);

    pinManager = new PinManager();
    let elapsed = 0;
    recordedBlocks.forEach((block, index) => {
        elapsed += block.buffer.duration;
        if (index < recordedBlocks.length - 1) {
            pinManager.addPin(elapsed, `Verset ${block.ayah || index + 1}`, true);
        }
    });

    segmentManager = new SegmentManager();
    segmentManager.calculate(pinManager.getPins(), state.duration);
    _saveCurrentRecitation();
}

function loadRecitationIntoState(id) {
    const rec = state.recitations.find(r => r.id === id);
    if (!rec || !rec.audioBuffer) return false;

    state.currentRecitationId = id;
    state.audioBuffer = rec.audioBuffer;
    state.audioBlob = rec.audioBlob || null;
    state.duration = rec.duration || rec.audioBuffer.duration || 0;
    state.audioBlocks = Array.isArray(rec.audioBlocks) ? rec.audioBlocks : [];
    state.versePlan = Array.isArray(rec.versePlan) ? rec.versePlan : [];
    state.currentVerseIndex = Math.min(rec.currentVerseIndex || 0, Math.max(0, state.versePlan.length - 1));
    state.surahId = rec.surahId || state.surahId;
    state.ayahFrom = rec.ayahFrom || state.ayahFrom;
    state.ayahTo = rec.ayahTo ?? state.ayahTo;

    pinManager = new PinManager();
    (rec.pinsData || []).forEach(pin => pinManager.addPin(pin.time, pin.label || null, Boolean(pin.isAuto)));

    segmentManager = new SegmentManager();
    segmentManager.calculate(pinManager.getPins(), state.duration);
    renderVerseCards();
    updateVerseProgress();
    return true;
}

function resetCurrentRecording() {
    state.audioBuffer = null;
    state.audioBlob = null;
    state.duration = 0;
    state.audioBlocks = [];
    state.versePlan.forEach(verse => {
        if (verse.url) URL.revokeObjectURL(verse.url);
    });
    state.versePlan = [];
    state.currentVerseIndex = 0;
    player = null;
    waveform = null;
    pinManager = new PinManager();
    segmentManager = new SegmentManager();

    const container = $('blocksContainer');
    const emptyState = $('blocksEmptyState');
    if (container) {
        container.querySelectorAll('.audio-block, .verse-record-card').forEach(block => block.remove());
    }
    if (emptyState) emptyState.style.display = '';
    if ($('panelSubmit')) $('panelSubmit').style.display = 'none';
    if (state.surahId) prepareVersePlanFromSelection({ preserve: false });
    else updateVerseProgress();
}

async function onAudioReady(audioBuffer, blob) {
    state.audioBuffer = audioBuffer;
    state.audioBlob   = blob;
    state.duration    = audioBuffer.duration;
    state.audioBlocks = [];

    if ($('panelWaveform')) $('panelWaveform').style.display = '';
    if ($('panelSubmit')) $('panelSubmit').style.display = '';

    // Player
    player = new AudioPlayer();
    await player.load(audioBuffer);

    const hasWaveform = $('waveformCanvas') && $('cursorCanvas') && $('waveformContainer');
    if (hasWaveform) {
        waveform = new Waveform(
            $('waveformCanvas'),
            $('cursorCanvas'),
            $('waveformContainer'),
            $('markerCanvas')
        );
        waveform.setAudioBuffer(audioBuffer);
    } else {
        waveform = null;
    }

    // Silence detection
    silenceDetector = new SilenceDetector();
    const thresholdInput = $('silenceThreshold');
    const threshold = thresholdInput ? parseFloat(thresholdInput.value) : 0.01;
    const silences  = silenceDetector.detect(audioBuffer, { threshold });

    // Pins & segments
    pinManager     = new PinManager();
    segmentManager = new SegmentManager();
    silences.forEach(t => pinManager.addPin(t, null, true));

    _refreshWaveformAndUI();
    if ($('timeDisplay')) $('timeDisplay').textContent = `00:00 / ${formatTime(state.duration)}`;

    // Save recitation to in-memory store
    _saveCurrentRecitation();
    showToast('Audio chargé — pins détectés automatiquement');
}

function _refreshWaveformAndUI() {
    if (!pinManager || !segmentManager) return;
    const segs = segmentManager.calculate(pinManager.getPins(), state.duration);
    if (waveform) {
        waveform.setPins(pinManager.getPins());
        waveform.setSegments(segs);
        waveform.draw();
        waveform.drawMarkers();
    }
    renderPinList();
    renderSegmentList();
    renderSegmentRuler($('segmentRuler'), segs, player);
}

// ─── Pin list ───
function renderPinList() {
    const list = $('pinList');
    if (!list || !pinManager) return;
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
    if (!list || !segmentManager) return;
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
    const display = $(displayId);
    if (display) display.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
}

// ─── In-memory recitation store ───
function _saveCurrentRecitation() {
    if (!state.user) return;
    if (!state.currentRecitationId && !state.audioBuffer) return;
    const pins = pinManager ? pinManager.getPins() : [];
    const pinsData = pins.map(pin => ({
        time: pin.time,
        label: pin.label || null,
        isAuto: Boolean(pin.isAuto),
    }));
    const existing = state.recitations.find(r => r.id === state.currentRecitationId);
    if (existing) {
        existing.pins        = pins.length;
        existing.duration    = state.duration;
        existing.audioBuffer = state.audioBuffer;
        existing.audioBlob   = state.audioBlob;
        existing.audioBlocks = [...state.audioBlocks];
        existing.versePlan   = [...state.versePlan];
        existing.currentVerseIndex = state.currentVerseIndex;
        existing.surahId     = state.surahId;
        existing.ayahFrom    = state.ayahFrom;
        existing.ayahTo      = state.ayahTo;
        existing.pinsData    = pinsData;
    } else {
        const id = crypto.randomUUID();
        const surah = getSurah(state.surahId);
        const title = surah
            ? `${surah.fr} ${state.ayahFrom}${state.ayahTo && state.ayahTo !== state.ayahFrom ? `-${state.ayahTo}` : ''}`
            : `Récitation ${state.recitations.length + 1}`;
        state.currentRecitationId = id;
        state.recitations.push({
            id,
            title,
            status:      'draft',
            duration:    state.duration,
            pins:        pins.length,
            learnerName: state.user?.username,
            reviewer:    null,
            createdAt:   new Date().toISOString(),
            audioBuffer: state.audioBuffer,
            audioBlob:   state.audioBlob,
            audioBlocks: [...state.audioBlocks],
            versePlan:   [...state.versePlan],
            currentVerseIndex: state.currentVerseIndex,
            surahId:     state.surahId,
            ayahFrom:    state.ayahFrom,
            ayahTo:      state.ayahTo,
            pinsData,
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

function renderFeedback(rec) {
    if (!rec) return;
    const correction = rec.correction || null;
    if ($('feedbackSubtitle')) $('feedbackSubtitle').textContent = rec.title || 'Correction reçue';
    if ($('feedbackVerdict')) {
        $('feedbackVerdict').textContent = verdictLabel(correction?.verdict);
        $('feedbackVerdict').className = `feedback-verdict feedback-verdict--${correction?.verdict || 'pending'}`;
    }
    if ($('feedbackComment')) {
        $('feedbackComment').textContent = correction?.globalComment?.trim()
            || 'Le professeur n’a pas laissé de commentaire global.';
    }

    const pointsEl = $('feedbackPoints');
    if (!pointsEl) return;
    const points = correction?.points || [];
    if (!points.length) {
        pointsEl.innerHTML = '<div class="empty-state"><div class="empty-state__text">Aucun point signalé.</div></div>';
        return;
    }
    pointsEl.innerHTML = points.map(p => `
        <div class="correction-item correction-item--${esc(p.category)}">
            <div class="correction-item__header">
                <span class="correction-item__time">${formatTime(p.time)}</span>
                <span class="correction-item__category correction-item__category--${esc(p.category)}">${esc(p.category)}</span>
            </div>
            <div class="correction-item__comment">${esc(p.comment || 'Point signalé par le professeur.')}</div>
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
        if (wf) wf.drawCursor(t / dur);
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
        if (iconPlay) iconPlay.style.display = '';
        if (iconPause) iconPause.style.display = 'none';
    } else {
        playerInstance.play();
        if (iconPlay) iconPlay.style.display = 'none';
        if (iconPause) iconPause.style.display = '';
        startPlaybackLoop(playerInstance, displayId, wf, rulerEl);
    }
}

function stopPlayer(playerInstance, iconPlay, iconPause, displayId, wf) {
    if (!playerInstance) return;
    playerInstance.stop();
    if (iconPlay) iconPlay.style.display = '';
    if (iconPause) iconPause.style.display = 'none';
    updateTimeDisplay(0, state.duration, displayId);
    if (wf) wf.drawCursor(0);
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
        resetCurrentRecording();
        setMode('learner');
    });

    // ── Recording ──
    recorder = new AudioRecorder($('vuMeterFill'));

    // ── Recording (Push To Talk / Legacy) ──
    const btnPtt = $('btnPttRecord');
    let isPttRecording = false;

    const startPttRecord = async () => {
        if (isPttRecording) return;
        if (!getCurrentVerse()) {
            showToast('Sélectionnez un verset avant d’enregistrer', 'error');
            return;
        }
        try {
            await recorder.start();
            isPttRecording = true;
            if (btnPtt) btnPtt.style.background = 'var(--color-danger)';
            if (btnPtt) btnPtt.classList.add('recording');
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

    const recordActiveVerse = async (blob, durationMs = null) => {
        const verse = getCurrentVerse();
        if (!verse) {
            showToast('Sélectionnez d’abord un verset', 'error');
            return;
        }

        if (durationMs !== null && durationMs < MIN_RECORDING_MS) {
            throw new Error('Enregistrement trop court. Gardez au moins une seconde de voix.');
        }

        const buffer = await loadAudioBuffer(blob);
        if (verse.url) URL.revokeObjectURL(verse.url);
        verse.blob = blob;
        verse.buffer = buffer;
        verse.url = URL.createObjectURL(blob);
        verse.duration = buffer.duration;

        await rebuildAudioFromBlocks();
        renderVerseCards();
        updateVerseProgress();

        if ($('optAutoAdvance')?.value === 'next') {
            const nextIndex = state.versePlan.findIndex((item, index) => index > state.currentVerseIndex && !item.buffer);
            if (nextIndex !== -1) selectVerseIndex(nextIndex);
        }
    };

    const stopPttRecord = async () => {
        if (!isPttRecording) return;
        if (recorder.isRecording()) {
            const { blob, durationMs } = await recorder.stop();
            isPttRecording = false;
            if (btnPtt) btnPtt.style.background = '';
            if (btnPtt) btnPtt.classList.remove('recording');
            const pttStatus = $('pttStatus');
            if (pttStatus) {
                pttStatus.textContent = "Traitement du verset...";
                pttStatus.style.color = "var(--color-gold)";
            }
            try {
                await recordActiveVerse(blob, durationMs);
                const verse = getCurrentVerse();
                if (pttStatus) pttStatus.textContent = verse ? `Verset ${verse.ayah} actif.` : "Verset enregistré.";
            } catch (e) {
                const shortRecording = /trop court|vide/i.test(e?.message || '');
                const message = shortRecording
                    ? e.message
                    : "Impossible de décoder cet enregistrement. Réessayez avec un enregistrement un peu plus long.";
                showToast(message, 'error');
                if (pttStatus) pttStatus.textContent = shortRecording ? "Enregistrement trop court." : "Erreur sur cet enregistrement.";
                if (!shortRecording) logError('ptt decode', e);
            }
        }
    };

    const setRecordMode = mode => {
        state.recordMode = mode;
        $('recordModeHold')?.classList.toggle('record-mode-switcher__btn--active', mode === 'hold');
        $('recordModeToggle')?.classList.toggle('record-mode-switcher__btn--active', mode === 'toggle');
        if ($('pttStatus')) {
            $('pttStatus').textContent = mode === 'hold'
                ? 'Maintenez le bouton ou Espace pour enregistrer le verset actif.'
                : 'Appuyez une fois pour démarrer, puis une fois pour arrêter.';
        }
    };

    $('recordModeHold')?.addEventListener('click', () => setRecordMode('hold'));
    $('recordModeToggle')?.addEventListener('click', () => setRecordMode('toggle'));

    if (btnPtt) {
        btnPtt.addEventListener('pointerdown', e => {
            if (state.recordMode !== 'hold') return;
            e.preventDefault();
            btnPtt.setPointerCapture?.(e.pointerId);
            startPttRecord();
        });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(eventName => {
            btnPtt.addEventListener(eventName, e => {
                if (state.recordMode !== 'hold') return;
                e.preventDefault();
                stopPttRecord();
            });
        });
        btnPtt.addEventListener('click', e => {
            if (state.recordMode !== 'toggle') return;
            e.preventDefault();
            if (isPttRecording) stopPttRecord();
            else startPttRecord();
        });
    }

    let verseScrollTimer = null;
    $('blocksContainer')?.addEventListener('scroll', () => {
        clearTimeout(verseScrollTimer);
        verseScrollTimer = setTimeout(() => {
            const container = $('blocksContainer');
            if (!container) return;
            const cards = [...container.querySelectorAll('.verse-record-card')];
            if (!cards.length) return;
            const center = container.getBoundingClientRect().left + container.getBoundingClientRect().width / 2;
            let closestIndex = state.currentVerseIndex;
            let closestDistance = Infinity;
            cards.forEach((card, index) => {
                const rect = card.getBoundingClientRect();
                const distance = Math.abs(rect.left + rect.width / 2 - center);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestIndex = index;
                }
            });
            if (closestIndex !== state.currentVerseIndex) {
                state.currentVerseIndex = closestIndex;
                cards.forEach((card, index) => {
                    card.classList.toggle('verse-record-card--active', index === closestIndex);
                    const selectBtn = card.querySelector('.verse-record-card__actions .btn');
                    if (selectBtn) selectBtn.textContent = index === closestIndex ? 'Actif' : 'Choisir';
                });
                updateVerseProgress();
                const verse = getCurrentVerse();
                if (verse && quranDisplay) quranDisplay.highlightVerse(verse.surah, verse.ayah);
            }
        }, 120);
    });

    const isKeyboardEditingTarget = target => {
        const tag = target?.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
    };

    // Espace pour enregistrer (Push-to-Talk)
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !isKeyboardEditingTarget(e.target)) {
            e.preventDefault(); // Empêche le scroll
            startPttRecord();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && !isKeyboardEditingTarget(e.target)) {
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
    
    // ── Quran display init ──
    quranDisplay = new QuranDisplay($('quranPanelContent'), $('quranPageLabel'));

    // ── Charger le Coran automatiquement au changement de sélection ──

    const autoLoadQuran = async () => {
        if (!updateSelectionStateFromInputs()) {
            prepareVersePlanFromSelection({ preserve: false });
            return;
        }

        prepareVersePlanFromSelection({ preserve: true });
        await rebuildAudioFromBlocks();
        renderVerseCards();
        updateVerseProgress();

        await quranDisplay.loadSurah(state.surahId, state.ayahFrom, state.ayahTo);
        const loadedAyahs = typeof quranDisplay.getAyahs === 'function'
            ? quranDisplay.getAyahs()
            : (quranDisplay._ayahs || []);
        hydrateVersePlanFromAyahs(loadedAyahs);
        renderVerseCards();
        updateVerseProgress();
    };

    if ($('surahSelect')) {
        $('surahSelect').addEventListener('change', async () => {
            const sid = parseInt($('surahSelect').value, 10);
            if (sid >= 1 && sid <= 114) {
                // Reset verses to start of surah
                $('ayahFrom').value = '1';
                $('ayahTo').value   = '';
            }
            await autoLoadQuran();
        });
    }
    if ($('ayahFrom')) $('ayahFrom').addEventListener('change', autoLoadQuran);
    if ($('ayahTo')) $('ayahTo').addEventListener('change', autoLoadQuran);

    if (updateSelectionStateFromInputs()) {
        prepareVersePlanFromSelection({ preserve: true });
        updateVerseProgress();
    }



    // ── Options d'affichage ──
    const changeSurahBy = async delta => {
        const select = $('surahSelect');
        if (!select) return;
        const current = parseInt(select.value, 10) || state.surahId || 1;
        const next = Math.max(1, Math.min(114, current + delta));
        if (next === current) return;

        select.value = String(next);
        if ($('ayahFrom')) $('ayahFrom').value = '1';
        if ($('ayahTo')) $('ayahTo').value = '';
        await autoLoadQuran();
    };

    window.addEventListener('keydown', async e => {
        if (state.mode !== 'learner' || isKeyboardEditingTarget(e.target) || e.altKey || e.ctrlKey || e.metaKey) {
            return;
        }

        if (e.code === 'ArrowLeft') {
            e.preventDefault();
            selectVerseIndex(state.currentVerseIndex - 1);
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            selectVerseIndex(state.currentVerseIndex + 1);
        } else if (e.code === 'ArrowUp') {
            e.preventDefault();
            await changeSurahBy(-1);
        } else if (e.code === 'ArrowDown') {
            e.preventDefault();
            await changeSurahBy(1);
        }
    });

    const reRenderQuran = () => {
        if (quranDisplay && quranDisplay._ayahs.length > 0) {
            quranDisplay._render();
        }
        renderVerseCards();
    };
    if ($('optTajweed')) $('optTajweed').addEventListener('change', reRenderQuran);
    if ($('optTranslation')) $('optTranslation').addEventListener('change', reRenderQuran);
    if ($('optPhonetics')) $('optPhonetics').addEventListener('change', reRenderQuran);

    // ── Font Size ──
    let currentFontSize = 2.95; // rem
    const applyQuranFontSize = () => {
        document.documentElement.style.setProperty('--learner-card-arabic-size', `${currentFontSize}rem`);
        if ($('quranPanelContent')) $('quranPanelContent').style.fontSize = `${Math.max(1, currentFontSize - 0.8)}rem`;
    };
    applyQuranFontSize();

    if ($('btnFontInc')) {
        $('btnFontInc').addEventListener('click', () => {
            currentFontSize = Math.min(4.2, currentFontSize + 0.2);
            applyQuranFontSize();
        });
    }
    if ($('btnFontDec')) {
        $('btnFontDec').addEventListener('click', () => {
            currentFontSize = Math.max(1.7, currentFontSize - 0.2);
            applyQuranFontSize();
        });
    }

    // ── Navigation page Coran ──
    if ($('btnQuranPrevPage')) {
        $('btnQuranPrevPage').addEventListener('click', async () => {
            await quranDisplay.prevPage();
        });
    }
    if ($('btnQuranNextPage')) {
        $('btnQuranNextPage').addEventListener('click', async () => {
            await quranDisplay.nextPage();
        });
    }
    if ($('btnCloseQuran')) {
        $('btnCloseQuran').addEventListener('click', () => {
            $('panelQuran').style.display = 'none';
        });
    }

    // ── Submit for review ──
    $('btnSubmitReview').addEventListener('click', () => {
        const total = state.versePlan.length;
        const recorded = state.versePlan.filter(verse => verse.buffer).length;
        if (!total || recorded !== total || !state.audioBuffer) {
            showToast('Tous les versets doivent être enregistrés avant envoi', 'error');
            return;
        }
        _saveCurrentRecitation();
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
        if (rec) {
            rec.status = 'reviewed';
            rec.reviewer = state.user?.username || 'Professeur';
            rec.correction = reviewer.getData();
        }
        showToast('Correction sauvegardée');
        setMode('dashboard');
    });

    // ── Keyboard shortcuts ──
    document.addEventListener('keydown', e => {
        if (state.mode === 'learner' || isKeyboardEditingTarget(e.target)) return;
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
