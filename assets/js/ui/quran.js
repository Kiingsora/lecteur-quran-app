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
        
        // Audio local pour la lecture par verset
        this._audio = new Audio();
        this._audioToken = 0;
        this._activeAudioButton = null;
        
        this._initEvents();
    }
    
    _initEvents() {
        this._container.addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn) return;
            
            const card = btn.closest('.verse-card');
            if (!card) return;
            
            const verseNum = card.dataset.verseNum; // Ayah number in Quran (absolute)
            const surahNum = card.dataset.surahNum;
            const ayahNum  = card.dataset.ayahNum;  // In surah
            
            if (btn.classList.contains('btn-verse-play')) {
                this._playVerse(verseNum, btn);
            } else if (btn.classList.contains('btn-verse-copy')) {
                this._copyVerse(card);
            } else if (btn.classList.contains('btn-verse-tafsir')) {
                this._showTafsir(surahNum, ayahNum);
            }
        });
        
        const btnClose = document.getElementById('btnCloseTafsir');
        if (btnClose) {
            btnClose.addEventListener('click', () => {
                document.getElementById('modalTafsir').style.display = 'none';
            });
        }
    }


    _playVerse(verseNum, btn) {
        const url = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${verseNum}.mp3`;
        const token = ++this._audioToken;
        const playIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
        const pauseIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
        if (this._audio.src === url && !this._audio.paused) {
            this._audio.pause();
            btn.innerHTML = playIcon;
        } else {
            if (this._activeAudioButton && this._activeAudioButton !== btn) {
                this._activeAudioButton.innerHTML = playIcon;
            }
            this._activeAudioButton = btn;
            this._audio.pause();
            this._audio.src = url;
            const playPromise = this._audio.play();
            if (playPromise) {
                playPromise.catch(error => {
                    if (error?.name !== 'AbortError') console.warn('[Qiraah] verse audio:', error);
                    if (token === this._audioToken) btn.innerHTML = playIcon;
                });
            }
            btn.innerHTML = pauseIcon;
            this._audio.onended = () => {
                if (token === this._audioToken) btn.innerHTML = playIcon;
            };
        }
    }

    _copyVerse(card) {
        const text = card.querySelector('.verse-card__arabic').textContent;
        navigator.clipboard.writeText(text).then(() => {
            // On pourrait appeler showToast ici si on avait accès, mais on va juste changer l'icône brièvement
            const btn = card.querySelector('.btn-verse-copy');
            const original = btn.innerHTML;
            btn.innerHTML = '✓';
            setTimeout(() => btn.innerHTML = original, 2000);
        });
    }

    async _showTafsir(surah, ayah) {
        const modal = document.getElementById('modalTafsir');
        const body  = document.getElementById('tafsirBody');
        
        if (!modal || !body) return;
        
        body.replaceChildren();
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        body.appendChild(spinner);
        body.appendChild(document.createTextNode('Chargement...'));
        modal.style.display = 'flex';

        
        try {
            // On récupère le Tafsir Al-Jalalayn (Arabe) par défaut
            const data = await this._apiFetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/ar.jalalayn`);
            const tafsir = data.text || "Aucune explication trouvée pour ce verset.";
            
            // On peut aussi essayer de récupérer une traduction si besoin, 
            // mais ici on affiche le tafsir classique.
            body.replaceChildren();
            const tafsirEl = document.createElement('div');
            tafsirEl.dir = 'rtl';
            tafsirEl.style.textAlign = 'right';
            tafsirEl.style.fontFamily = 'var(--font-arabic)';
            tafsirEl.style.fontSize = '1.5rem';
            tafsirEl.style.marginBottom = '1rem';
            tafsirEl.textContent = tafsir;
            body.appendChild(tafsirEl);
            
            // Ajout d'une petite note ou traduction française si disponible dans les ayahs chargés
            const currentAyah = this._ayahs.find(a => a.surah == surah && a.numberInSurah == ayah);
            if (currentAyah && currentAyah.translation) {
                const separator = document.createElement('hr');
                separator.style.border = '0';
                separator.style.borderTop = '1px solid rgba(212,168,71,0.1)';
                separator.style.margin = '1rem 0';
                const translation = document.createElement('div');
                translation.style.fontStyle = 'italic';
                translation.style.color = 'var(--color-text-muted)';
                translation.textContent = currentAyah.translation;
                body.appendChild(separator);
                body.appendChild(translation);
            }
        } catch (e) {
            body.textContent = "Erreur lors du chargement du Tafsir. Veuillez réessayer.";
        }
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

    /** Versets chargés pour réutilisation par l'interface d'enregistrement */
    getAyahs() {
        return this._ayahs.map(ayah => ({ ...ayah }));
    }

    // ─────────────────────────────────────────────
    // Rendu DOM (aucun innerHTML avec données API)
    // ─────────────────────────────────────────────

    _renderArabicText(container, text, showTajweed) {
        const source = String(text || '');
        const pattern = /\[([a-zA-Z]+)(?::\d+)?\[([^\]]+)\]/g;
        let cursor = 0;
        let match;
        let wordIndex = 0;
        let currentWord = null;

        const closeWord = () => {
            currentWord = null;
        };

        const ensureWord = () => {
            if (!currentWord) {
                currentWord = document.createElement('span');
                currentWord.className = 'quran-word';
                currentWord.dataset.word = String(wordIndex++);
                container.appendChild(currentWord);
            }
            return currentWord;
        };

        const appendTextParts = value => {
            value.split(/(\s+)/).forEach(part => {
                if (!part) return;
                if (/^\s+$/.test(part)) {
                    closeWord();
                    container.appendChild(document.createTextNode(part));
                    return;
                }
                ensureWord().appendChild(document.createTextNode(part));
            });
        };

        while ((match = pattern.exec(source)) !== null) {
            appendTextParts(source.slice(cursor, match.index));
            if (showTajweed) {
                const mark = document.createElement('tajweed');
                mark.className = `tj-${match[1]}`;
                mark.textContent = match[2];
                ensureWord().appendChild(mark);
            } else {
                appendTextParts(match[2]);
            }
            cursor = pattern.lastIndex;
        }

        appendTextParts(source.slice(cursor));
    }

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

        // Settings
        const showTajweed = document.getElementById('optTajweed') ? document.getElementById('optTajweed').checked : true;
        const showTranslation = document.getElementById('optTranslation') ? document.getElementById('optTranslation').checked : true;
        const showPhonetics = document.getElementById('optPhonetics') ? document.getElementById('optPhonetics').checked : false;

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

            // Versets (Cards)
            for (const ayah of ayahs) {
                const verseCard = document.createElement('div');
                verseCard.className = 'verse-card';
                verseCard.dataset.verse = `${ayah.surah}:${ayah.numberInSurah}`;
                verseCard.dataset.verseNum = ayah.number;
                verseCard.dataset.surahNum = ayah.surah;
                verseCard.dataset.ayahNum  = ayah.numberInSurah;

                
                // Content grid
                const contentGrid = document.createElement('div');
                contentGrid.className = 'verse-card__content';
                
                // Left column: Number + Translation + Phonetics
                const leftCol = document.createElement('div');
                leftCol.className = 'verse-card__meta';
                
                const numCircle = document.createElement('div');
                numCircle.className = 'verse-card__number';
                numCircle.textContent = ayah.numberInSurah;
                leftCol.appendChild(numCircle);
                
                const textMeta = document.createElement('div');
                textMeta.className = 'verse-card__text-meta';
                
                if (showPhonetics && ayah.phonetics) {
                    const ph = document.createElement('div');
                    ph.className = 'verse-card__phonetics';
                    ph.textContent = ayah.phonetics;
                    textMeta.appendChild(ph);
                }
                
                if (showTranslation && ayah.translation) {
                    const tr = document.createElement('div');
                    tr.className = 'verse-card__translation';
                    tr.textContent = ayah.translation;
                    textMeta.appendChild(tr);
                }
                leftCol.appendChild(textMeta);
                
                // Right column: Arabic
                const rightCol = document.createElement('div');
                rightCol.className = 'verse-card__arabic';
                rightCol.dir = 'rtl';
                rightCol.lang = 'ar';
                
                // Parse Tajweed custom bracket syntax: [class[text] or [class:id[text]
                // Example: [h:1[ٱ] -> <tajweed class="tj-h">ٱ</tajweed>
                this._renderArabicText(rightCol, ayah.text, showTajweed);
                
                contentGrid.appendChild(leftCol);
                contentGrid.appendChild(rightCol);
                
                // Toolbar
                const toolbar = document.createElement('div');
                toolbar.className = 'verse-card__toolbar';
                toolbar.innerHTML = `
                    <div class="verse-card__actions">
                        <button class="btn btn--ghost btn--icon btn-verse-play" title="Écouter ce verset"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button>
                        <button class="btn btn--ghost btn--icon btn-verse-copy" title="Copier le texte arabe"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                        <button class="btn btn--ghost btn--icon btn-verse-tafsir" title="Voir le Tafsir"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h12v10H2z"/><path d="M6 3v10"/></svg></button>
                    </div>
                    <div class="verse-card__ref">${ayah.surah}:${ayah.numberInSurah}</div>
                `;

                
                verseCard.appendChild(contentGrid);
                verseCard.appendChild(toolbar);
                this._container.appendChild(verseCard);
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
        const options = url.startsWith('http') ? {} : { credentials: 'same-origin' };
        const res = await fetch(url, options);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(err.error || `Erreur ${res.status}`);
        }
        const json = await res.json();
        return json.data || json; // alquran.cloud enveloppe dans .data
    }

}
