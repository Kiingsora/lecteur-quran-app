/**
 * Qira'ah - Affichage du Coran
 * Sécurité :
 *   - Tout le texte arabe via textContent (jamais innerHTML avec données API)
 *   - URL construite avec entiers validés côté serveur
 *   - Pas d'exposition globale window.*
 */

export class QuranDisplay {
    /**
     * @param {HTMLElement} containerEl - Élément cible pour le rendu des versets
     * @param {HTMLElement} pageNumEl   - Span affichant le numéro de page courant
     */
    constructor(containerEl, pageNumEl) {
        this._container  = containerEl;
        this._pageNumEl  = pageNumEl;
        this._page       = null;     // page mushaf courante
        this._ayahs      = [];       // versets chargés
        this._activeKey  = null;     // "surahId:ayahNum" du verset actif
        this._activeWord = -1;       // index du mot actif dans le verset
    }

    // ─────────────────────────────────────────────
    // API publique
    // ─────────────────────────────────────────────

    /** Charge une page du mushaf (1-604) */
    async loadPage(pageNum) {
        const n = parseInt(pageNum, 10);
        if (!Number.isInteger(n) || n < 1 || n > 604) return;
        this._showSpinner();
        try {
            const data = await this._apiFetch(`includes/api/quran.php?page=${n}`);
            this._page  = n;
            this._ayahs = data.ayahs || [];
            this._activeKey  = null;
            this._activeWord = -1;
            this._render();
            if (this._pageNumEl) this._pageNumEl.textContent = `Page ${n}`;
        } catch (e) {
            this._showError('Impossible de charger la page — vérifiez votre connexion.');
        }
    }

    /** Charge une sourate, éventuellement filtrée par versets */
    async loadSurah(surahId, ayahStart = 1, ayahEnd = null) {
        const sid = parseInt(surahId, 10);
        if (!Number.isInteger(sid) || sid < 1 || sid > 114) return;
        this._showSpinner();
        try {
            const data = await this._apiFetch(`includes/api/quran.php?surah=${sid}`);
            let ayahs = data.ayahs || [];
            const from = Math.max(1, parseInt(ayahStart, 10) || 1);
            const to   = ayahEnd ? parseInt(ayahEnd, 10) : null;
            ayahs = ayahs.filter(a => a.numberInSurah >= from);
            if (to && Number.isInteger(to)) ayahs = ayahs.filter(a => a.numberInSurah <= to);
            this._ayahs      = ayahs;
            this._activeKey  = null;
            this._activeWord = -1;
            // Page de la première ayah chargée
            if (ayahs.length && this._pageNumEl) {
                this._pageNumEl.textContent = `Page ${ayahs[0].page}`;
                this._page = ayahs[0].page;
            }
            this._render();
        } catch (e) {
            this._showError('Impossible de charger la sourate — vérifiez votre connexion.');
        }
    }

    /** Naviguer à la page précédente */
    async prevPage() {
        if (this._page && this._page > 1) await this.loadPage(this._page - 1);
    }

    /** Naviguer à la page suivante */
    async nextPage() {
        if (this._page && this._page < 604) await this.loadPage(this._page + 1);
    }

    /**
     * Surligner un verset.
     * @param {number} surahId
     * @param {number} ayahNum  - numberInSurah
     */
    highlightVerse(surahId, ayahNum) {
        const key = `${surahId}:${ayahNum}`;
        if (this._activeKey === key) return;

        // Retirer l'ancien
        this._container.querySelectorAll('.quran-verse--active').forEach(el =>
            el.classList.remove('quran-verse--active')
        );
        this._activeKey  = key;
        this._activeWord = -1;

        const verseEl = this._container.querySelector(`[data-verse="${key}"]`);
        if (verseEl) {
            verseEl.classList.add('quran-verse--active');
            verseEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /**
     * Surligner un mot approximatif dans le verset actif.
     * @param {number} wordIndex
     */
    highlightWord(wordIndex) {
        if (this._activeWord === wordIndex) return;

        if (this._activeKey) {
            const verseEl = this._container.querySelector(`[data-verse="${this._activeKey}"]`);
            if (verseEl) {
                verseEl.querySelectorAll('.quran-word--active').forEach(el =>
                    el.classList.remove('quran-word--active')
                );
                const wordEl = verseEl.querySelector(`[data-word="${wordIndex}"]`);
                if (wordEl) wordEl.classList.add('quran-word--active');
            }
        }
        this._activeWord = wordIndex;
    }

    /** Nombre de mots dans le verset actif (pour le calcul approximatif) */
    getActiveVerseWordCount() {
        if (!this._activeKey) return 0;
        const verseEl = this._container.querySelector(`[data-verse="${this._activeKey}"]`);
        if (!verseEl) return 0;
        return verseEl.querySelectorAll('.quran-word').length;
    }

    /** Page mushaf courante */
    getCurrentPage() {
        return this._page;
    }

    // ─────────────────────────────────────────────
    // Rendu DOM (aucun innerHTML avec données API)
    // ─────────────────────────────────────────────

    _render() {
        this._clear();

        if (!this._ayahs.length) {
            this._showError('Aucun verset trouvé.');
            return;
        }

        // Grouper par sourate
        const bySurah = new Map();
        for (const ayah of this._ayahs) {
            if (!bySurah.has(ayah.surah)) bySurah.set(ayah.surah, []);
            bySurah.get(ayah.surah).push(ayah);
        }

        for (const [, ayahs] of bySurah) {
            // En-tête sourate
            const header = document.createElement('div');
            header.className = 'quran-surah-header';

            const nameAr = document.createElement('span');
            nameAr.className = 'quran-surah-name';
            nameAr.textContent = ayahs[0].surahName || '';
            header.appendChild(nameAr);

            if (ayahs[0].surahNameFr) {
                const nameFr = document.createElement('span');
                nameFr.className = 'quran-surah-name-fr';
                nameFr.textContent = ayahs[0].surahNameFr;
                header.appendChild(nameFr);
            }
            this._container.appendChild(header);

            // Versets
            for (const ayah of ayahs) {
                const verseEl = document.createElement('div');
                verseEl.className = 'quran-verse';
                verseEl.dataset.verse = `${ayah.surah}:${ayah.numberInSurah}`;

                // Numéro de verset (à gauche dans le flow RTL)
                const numEl = document.createElement('span');
                numEl.className = 'quran-verse-num';
                // Caractères arabiques ﴿ ﴾ pour l'encadrement
                numEl.textContent = `\u{FD3E}${ayah.numberInSurah}\u{FD3F}`;
                verseEl.appendChild(numEl);

                // Mots du verset — split sur espace
                const words = ayah.text.split(' ');
                words.forEach((word, idx) => {
                    if (idx > 0) {
                        verseEl.appendChild(document.createTextNode(' '));
                    }
                    const wordEl = document.createElement('span');
                    wordEl.className = 'quran-word';
                    wordEl.dataset.word = String(idx);
                    wordEl.textContent = word;
                    verseEl.appendChild(wordEl);
                });

                this._container.appendChild(verseEl);
            }
        }
    }

    _clear() {
        while (this._container.firstChild) {
            this._container.removeChild(this._container.firstChild);
        }
    }

    _showSpinner() {
        this._clear();
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        this._container.appendChild(spinner);
    }

    _showError(msg) {
        this._clear();
        const el = document.createElement('div');
        el.className = 'empty-state';
        const txt = document.createElement('div');
        txt.className = 'empty-state__text';
        txt.textContent = msg; // textContent → pas d'injection possible
        el.appendChild(txt);
        this._container.appendChild(el);
    }

    // ─────────────────────────────────────────────
    // Fetch (passe par le proxy PHP sécurisé)
    // ─────────────────────────────────────────────

    async _apiFetch(url) {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(err.error || `Erreur ${res.status}`);
        }
        return res.json();
    }
}
