const DEFAULT_WORD_MS = 820;
const MIN_VERSE_MS = 2600;
const FINAL_PAUSE_WEIGHT = 0.45;

const LONG_VOWELS = /[اوىي]/g;
const ARABIC_LETTERS = /[\u0621-\u064A\u0671-\u06D3]/g;
const DIACRITICS = /[\u064B-\u065F\u0670]/g;
const TATWEEL = /\u0640/g;

const TAJWEED_RULES = {
    m: 0.75,
    madd: 0.75,
    qlq: 0.25,
    ghunnah: 0.55,
    g: 0.55,
    ikhfa: 0.45,
    iqlab: 0.45,
    idgham: 0.45,
};

function splitTajweedMarkup(text) {
    const source = String(text || '');
    const pattern = /\[([a-zA-Z]+)(?::\d+)?\[([^\]]+)\]/g;
    const parts = [];
    let cursor = 0;
    let match;

    while ((match = pattern.exec(source)) !== null) {
        if (match.index > cursor) {
            parts.push({ text: source.slice(cursor, match.index), rule: null });
        }
        parts.push({ text: match[2], rule: match[1].toLowerCase() });
        cursor = pattern.lastIndex;
    }

    if (cursor < source.length) {
        parts.push({ text: source.slice(cursor), rule: null });
    }

    return parts;
}

export function extractRecitationWords(text) {
    const words = [];
    let current = null;

    const pushToken = (token, rule) => {
        if (!token) return;
        const pieces = token.split(/(\s+)/);
        pieces.forEach(piece => {
            if (!piece) return;
            if (/^\s+$/.test(piece)) {
                current = null;
                return;
            }
            if (!current) {
                current = { raw: '', rules: new Set() };
                words.push(current);
            }
            current.raw += piece;
            if (rule) current.rules.add(rule);
        });
    };

    splitTajweedMarkup(text).forEach(part => pushToken(part.text, part.rule));

    return words
        .map(word => ({
            raw: word.raw,
            normalized: normalizeArabicWord(word.raw),
            rules: [...word.rules],
        }))
        .filter(word => word.normalized.length > 0);
}

export function normalizeArabicWord(text) {
    return String(text || '')
        .replace(TATWEEL, '')
        .replace(DIACRITICS, '')
        .replace(/[^\u0621-\u064A\u0671-\u06D3]/g, '')
        .replace(/[إأٱآ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي');
}

function computeWordWeight(word, index, total) {
    const raw = word.raw || '';
    const normalized = word.normalized || '';
    const letters = normalized.match(ARABIC_LETTERS)?.length || normalized.length || 1;
    const longVowels = normalized.match(LONG_VOWELS)?.length || 0;
    const hasShadda = raw.includes('ّ');
    const hasTanwin = /[\u064B-\u064D]/.test(raw);
    const ruleWeight = word.rules.reduce((sum, rule) => sum + (TAJWEED_RULES[rule] || 0.2), 0);

    let weight = 0.72 + letters * 0.16 + longVowels * 0.2 + ruleWeight;
    if (hasShadda) weight += 0.28;
    if (hasTanwin) weight += 0.12;
    if (index === total - 1) weight += FINAL_PAUSE_WEIGHT;
    return Math.max(0.72, weight);
}

export function buildRecitationTiming(text, options = {}) {
    const words = extractRecitationWords(text);
    if (!words.length) {
        return { words: [], totalMs: 0 };
    }

    const weights = words.map((word, index) => computeWordWeight(word, index, words.length));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const requestedDurationMs = Number(options.durationMs);
    const totalMs = Number.isFinite(requestedDurationMs) && requestedDurationMs > 0
        ? Math.max(MIN_VERSE_MS, requestedDurationMs)
        : Math.max(MIN_VERSE_MS, totalWeight * DEFAULT_WORD_MS);

    let cursor = 0;
    const timedWords = words.map((word, index) => {
        const durationMs = totalMs * (weights[index] / totalWeight);
        const item = {
            ...word,
            weight: weights[index],
            startMs: cursor,
            endMs: cursor + durationMs,
            durationMs,
        };
        cursor += durationMs;
        return item;
    });

    return { words: timedWords, totalMs };
}

export function getWordIndexAtTime(timing, elapsedMs) {
    const words = timing?.words || [];
    if (!words.length) return -1;
    const safeElapsed = Math.max(0, Number(elapsedMs) || 0);
    const index = words.findIndex(word => safeElapsed >= word.startMs && safeElapsed < word.endMs);
    return index === -1 ? words.length - 1 : index;
}
