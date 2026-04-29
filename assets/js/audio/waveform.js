/**
 * Qira'ah - Waveform Renderer
 *
 * Architecture : 3 canvas superposés
 *  1. waveformCanvas  — fond + waveform + segments (redraw on pin/correction change)
 *  2. markerCanvas    — pins + points de correction colorés (redraw on data change)
 *  3. cursorCanvas    — curseur de lecture seul (60fps pendant lecture)
 */

// Couleurs par catégorie (identiques aux variables CSS)
export const CATEGORY_COLORS = {
    madd:     '#3498DB',
    emphase:  '#9B59B6',
    makhraj:  '#E74C3C',
    ghunnah:  '#E67E22',
    waqf:     '#F1C40F',
    fluidite: '#1ABC9C',
};

export class Waveform {
    constructor(waveformCanvas, cursorCanvas, container, markerCanvas = null) {
        this.waveformCanvas = waveformCanvas;
        this.cursorCanvas   = cursorCanvas;
        this.markerCanvas   = markerCanvas;
        this.container      = container;

        this.wCtx = waveformCanvas.getContext('2d');
        this.cCtx = cursorCanvas.getContext('2d');
        this.mCtx = markerCanvas ? markerCanvas.getContext('2d') : null;

        this.audioBuffer        = null;
        this.peaks              = null;   // { min[], max[] }
        this.pins               = [];
        this.segments           = [];
        this.correctionPoints   = [];     // [{ time, category, comment }]

        this._resizeObserver = new ResizeObserver(() => this._resize());
        this._resizeObserver.observe(container);
        this._resize();
    }

    // ─── Data setters ───

    setAudioBuffer(audioBuffer) {
        this.audioBuffer = audioBuffer;
        this._computePeaks();
    }

    setPins(pins) {
        this.pins = [...pins];
    }

    setSegments(segments) {
        this.segments = [...segments];
    }

    setCorrectionPoints(points) {
        this.correctionPoints = [...points];
    }

    // ─── Peak computation ───

    _computePeaks() {
        if (!this.audioBuffer) return;
        const channelData   = this.audioBuffer.getChannelData(0);
        const numSamples    = channelData.length;
        const dpr           = window.devicePixelRatio || 1;
        const width         = Math.floor(this.container.getBoundingClientRect().width * dpr);
        if (width === 0) return;

        const samplesPerPx  = Math.floor(numSamples / width);
        const mins = new Float32Array(width);
        const maxs = new Float32Array(width);

        for (let i = 0; i < width; i++) {
            const start = i * samplesPerPx;
            const end   = Math.min(start + samplesPerPx, numSamples);
            let min = 1, max = -1;
            for (let j = start; j < end; j++) {
                const v = channelData[j];
                if (v < min) min = v;
                if (v > max) max = v;
            }
            mins[i] = min;
            maxs[i] = max;
        }
        this.peaks = { min: mins, max: maxs };
    }

    // ─── Resize ───

    _resize() {
        const dpr  = window.devicePixelRatio || 1;
        const rect = this.container.getBoundingClientRect();
        const w    = rect.width;
        const h    = rect.height;

        const canvases = [this.waveformCanvas, this.cursorCanvas];
        if (this.markerCanvas) canvases.push(this.markerCanvas);

        canvases.forEach(canvas => {
            canvas.width        = Math.floor(w * dpr);
            canvas.height       = Math.floor(h * dpr);
            canvas.style.width  = w + 'px';
            canvas.style.height = h + 'px';
            canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
        });

        if (this.audioBuffer) {
            this._computePeaks();
            this.draw();
            this.drawMarkers();
        }
    }

    // ─── Dimensions helper ───

    _dims() {
        const rect = this.container.getBoundingClientRect();
        return { w: rect.width, h: rect.height };
    }

    // ─── Layer 1 : waveform + segments background ───

    draw() {
        const ctx = this.wCtx;
        const { w, h } = this._dims();
        const centerY   = h / 2;

        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, w, h);

        // Grid lines (horizontal, subtles)
        ctx.strokeStyle = 'rgba(212, 168, 71, 0.04)';
        ctx.lineWidth   = 1;
        [0.25, 0.5, 0.75].forEach(ratio => {
            ctx.beginPath();
            ctx.moveTo(0, h * ratio);
            ctx.lineTo(w, h * ratio);
            ctx.stroke();
        });

        // Segment backgrounds — alternance vert très foncé / légèrement moins foncé
        if (this.segments.length > 0 && this.audioBuffer) {
            const dur = this.audioBuffer.duration;
            this.segments.forEach((seg, i) => {
                const x1 = (seg.start / dur) * w;
                const x2 = (seg.end   / dur) * w;
                ctx.fillStyle = i % 2 === 0
                    ? 'rgba(27, 67, 50, 0.18)'   // vert foncé
                    : 'rgba(45, 106, 79, 0.12)';  // vert légèrement plus clair
                ctx.fillRect(x1, 0, x2 - x1, h);

                // Ligne verticale de délimitation des segments
                if (i > 0) {
                    const xBorder = (seg.start / dur) * w;
                    ctx.strokeStyle = 'rgba(212, 168, 71, 0.15)';
                    ctx.lineWidth   = 1;
                    ctx.setLineDash([3, 4]);
                    ctx.beginPath();
                    ctx.moveTo(xBorder, 0);
                    ctx.lineTo(xBorder, h);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            });
        }

        // Waveform bars
        if (this.peaks) {
            const numBars   = this.peaks.min.length;
            const scaleX    = w / numBars;

            // Dégradé vertical : or au centre, or/vert sur les côtés
            const gradient  = ctx.createLinearGradient(0, 0, 0, h);
            gradient.addColorStop(0,    'rgba(212, 168, 71, 0.6)');
            gradient.addColorStop(0.4,  'rgba(212, 168, 71, 0.9)');
            gradient.addColorStop(0.5,  '#D4A847');
            gradient.addColorStop(0.6,  'rgba(212, 168, 71, 0.9)');
            gradient.addColorStop(1,    'rgba(212, 168, 71, 0.6)');
            ctx.fillStyle = gradient;

            for (let i = 0; i < numBars; i++) {
                const x       = i * scaleX;
                const yMax    = centerY + this.peaks.max[i] * centerY;
                const yMin    = centerY + this.peaks.min[i] * centerY;
                const barH    = Math.max(1, yMin - yMax);
                ctx.fillRect(x, yMax, Math.max(1, scaleX - 0.5), barH);
            }
        }

        // Ligne centrale
        ctx.strokeStyle = 'rgba(212, 168, 71, 0.2)';
        ctx.lineWidth   = 0.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(w, centerY);
        ctx.stroke();
    }

    // ─── Layer 2 : pins + correction points ───

    drawMarkers() {
        const canvas = this.markerCanvas || this.waveformCanvas;
        const ctx    = this.markerCanvas ? this.mCtx : this.wCtx;
        const { w, h } = this._dims();
        const duration = this.audioBuffer ? this.audioBuffer.duration : 1;

        if (this.markerCanvas) {
            ctx.clearRect(0, 0, w, h);
        }

        // ── Pins (traits dorés pointillés) ──
        this.pins.forEach(pin => {
            const x = (pin.time / duration) * w;

            ctx.save();
            ctx.strokeStyle = '#D4A847';
            ctx.lineWidth   = 1.5;
            ctx.setLineDash([5, 4]);
            ctx.shadowColor = 'rgba(212, 168, 71, 0.4)';
            ctx.shadowBlur  = 4;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
            ctx.restore();

            // Triangle handle en haut
            ctx.fillStyle = '#D4A847';
            ctx.beginPath();
            ctx.moveTo(x - 5, 0);
            ctx.lineTo(x + 5, 0);
            ctx.lineTo(x, 9);
            ctx.closePath();
            ctx.fill();
        });

        // ── Points de correction (traits colorés + losange) ──
        this.correctionPoints.forEach(point => {
            const x     = (point.time / duration) * w;
            const color = CATEGORY_COLORS[point.category] || '#FFFFFF';

            ctx.save();

            // Trait vertical plein et coloré
            ctx.strokeStyle = color;
            ctx.lineWidth   = 2;
            ctx.setLineDash([]);
            ctx.shadowColor = color;
            ctx.shadowBlur  = 8;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();

            // Zone de glow derrière le trait
            ctx.strokeStyle = color;
            ctx.lineWidth   = 6;
            ctx.globalAlpha = 0.1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
            ctx.globalAlpha = 1;

            ctx.restore();

            // Losange (diamant) au milieu, coloré
            const midY = h / 2;
            ctx.save();
            ctx.fillStyle   = color;
            ctx.shadowColor = color;
            ctx.shadowBlur  = 6;
            ctx.beginPath();
            ctx.moveTo(x,     midY - 7);
            ctx.lineTo(x + 5, midY);
            ctx.lineTo(x,     midY + 7);
            ctx.lineTo(x - 5, midY);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Initiale de la catégorie (première lettre, en noir sur le losange)
            ctx.fillStyle   = '#000';
            ctx.font        = 'bold 7px sans-serif';
            ctx.textAlign   = 'center';
            ctx.textBaseline= 'middle';
            ctx.fillText(point.category[0].toUpperCase(), x, midY);

            // Petite étiquette en haut avec la catégorie
            ctx.fillStyle   = color;
            ctx.font        = 'bold 9px sans-serif';
            ctx.textBaseline= 'top';
            ctx.fillText(point.category.charAt(0).toUpperCase() + point.category.slice(1), x + 7, 4);
        });
    }

    // ─── Layer 3 : curseur seul ───

    drawCursor(ratio) {
        const ctx  = this.cCtx;
        const { w, h } = this._dims();

        ctx.clearRect(0, 0, w, h);
        if (ratio < 0 || ratio > 1) return;

        const x = ratio * w;

        // Glow
        ctx.shadowColor = '#E8C96A';
        ctx.shadowBlur  = 10;
        ctx.strokeStyle = '#E8C96A';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        ctx.shadowBlur  = 0;

        // Dot
        ctx.fillStyle   = '#E8C96A';
        ctx.beginPath();
        ctx.arc(x, 5, 3.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // ─── Segment ruler data (pour l'UI externe) ───

    getSegmentRulerData() {
        if (!this.audioBuffer || this.segments.length === 0) return [];
        const dur = this.audioBuffer.duration;
        return this.segments.map(seg => ({
            index:    seg.index,
            start:    seg.start,
            end:      seg.end,
            widthPct: ((seg.end - seg.start) / dur * 100).toFixed(2) + '%',
            label:    `S${seg.index + 1}`,
            duration: (seg.end - seg.start).toFixed(1) + 's',
        }));
    }
}
