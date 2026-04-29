/**
 * Qira'ah - Reviewer Module
 * Manages correction points (timestamped, categorized)
 */

export class Reviewer {
    constructor() {
        this._points   = [];  // [{ id, time, category, comment }]
        this._verdict  = null;
        this._comment  = '';
        this._checklist = {
            madd: false, emphase: false, makhraj: false,
            ghunnah: false, waqf: false, fluidite: false
        };
        this._onChange = null;
    }

    /** Register a callback fired on any data change */
    onChanged(cb) { this._onChange = cb; }

    /** Set audio duration for bounds validation */
    setDuration(duration) { this._duration = Math.max(0, Number(duration)); }

    _emit() { if (this._onChange) this._onChange(this.getData()); }

    // ─── Correction points ───

    addPoint(time, category, comment = '') {
        const validCategories = ['madd', 'emphase', 'makhraj', 'ghunnah', 'waqf', 'fluidite'];
        if (!validCategories.includes(category)) return null;

        const t = Number(time);
        if (!isFinite(t) || t < 0) return null;
        // Validate against audio duration if known
        if (this._duration > 0 && t > this._duration) return null;

        const point = {
            id:       crypto.randomUUID(),
            time:     t,
            category,
            comment:  comment.slice(0, 500),
        };
        this._points.push(point);
        this._points.sort((a, b) => a.time - b.time);
        this._emit();
        return point;
    }

    updateComment(id, comment) {
        const point = this._points.find(p => p.id === id);
        if (point) {
            point.comment = String(comment).slice(0, 500);
            this._emit();
        }
    }

    removePoint(id) {
        this._points = this._points.filter(p => p.id !== id);
        this._emit();
    }

    getPoints() { return this._points; }

    // ─── Verdict ───

    setVerdict(verdict) {
        const valid = ['ok', 'to_correct', 'redo'];
        if (valid.includes(verdict)) {
            this._verdict = verdict;
            this._emit();
        }
    }

    getVerdict() { return this._verdict; }

    // ─── Global comment ───

    setGlobalComment(text) {
        this._comment = String(text).slice(0, 2000);
        this._emit();
    }

    // ─── Checklist ───

    setChecklist(name, value) {
        if (name in this._checklist) {
            this._checklist[name] = Boolean(value);
            this._emit();
        }
    }

    // ─── Export ───

    getData() {
        return {
            verdict:        this._verdict,
            globalComment:  this._comment,
            checklist:      { ...this._checklist },
            points:         this._points.map(p => ({ ...p })),
        };
    }

    exportJSON(meta = {}) {
        const data = {
            title:          meta.title || 'Récitation',
            date:           new Date().toISOString(),
            verdict:        this._verdict,
            checklist:      { ...this._checklist },
            globalComment:  this._comment,
            correctionPoints: this._points.map(p => ({
                time:          p.time,
                timeFormatted: formatTime(p.time),
                category:      p.category,
                comment:       p.comment,
            })),
            pins: (meta.pins || []).map(p => ({
                time:          p.time,
                timeFormatted: formatTime(p.time),
                isAuto:        p.isAuto,
            })),
        };
        return JSON.stringify(data, null, 2);
    }
}

function formatTime(seconds) {
    if (!seconds || !isFinite(seconds)) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
}
