/**
 * Qira'ah - Audio Recorder Module
 * Handles microphone recording with VU meter
 */

export class AudioRecorder {
    constructor(vuMeterFillEl) {
        this.vuMeterFillEl = vuMeterFillEl;
        this.mediaRecorder = null;
        this.stream = null;
        this.chunks = [];
        this.recording = false;
        this.analyser = null;
        this.audioContext = null;
        this._animFrameId = null;
    }

    isRecording() {
        return this.recording;
    }

    async start() {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.chunks = [];

        // Detect supported mimeType
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : '';

        this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : {});

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.chunks.push(e.data);
        };

        this.mediaRecorder.start(250); // collect chunks every 250ms
        this.recording = true;

        // Setup VU meter
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);

        this._updateVuMeter();
    }

    stop() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                resolve({ blob: new Blob([]) });
                return;
            }

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.chunks, {
                    type: this.mediaRecorder.mimeType || 'audio/webm'
                });
                this.recording = false;
                this._cleanup();
                resolve({ blob });
            };

            this.mediaRecorder.stop();
        });
    }

    _updateVuMeter() {
        if (!this.recording || !this.analyser) return;

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteTimeDomainData(dataArray);

        // Compute RMS
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const val = (dataArray[i] - 128) / 128;
            sum += val * val;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const level = Math.min(1, rms * 4); // amplify for visibility

        if (this.vuMeterFillEl) {
            this.vuMeterFillEl.style.height = `${level * 100}%`;
        }

        this._animFrameId = requestAnimationFrame(() => this._updateVuMeter());
    }

    _cleanup() {
        if (this._animFrameId) {
            cancelAnimationFrame(this._animFrameId);
            this._animFrameId = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        if (this.vuMeterFillEl) {
            this.vuMeterFillEl.style.height = '0%';
        }
    }
}
