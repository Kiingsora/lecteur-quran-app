/**
 * Qira'ah - Audio Player Module
 * Uses AudioBufferSourceNode for sample-accurate playback
 */

export class AudioPlayer {
    constructor() {
        this.audioContext = null;
        this.audioBuffer = null;
        this.sourceNode = null;
        this.gainNode = null;
        this.isPlaying = false;
        this._startedAt = 0;    // context time when playback started
        this._offset = 0;       // offset into the audio buffer
        this._playbackRate = 1;
    }

    async load(audioBuffer) {
        if (this.audioContext) {
            this.audioContext.close();
        }
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioBuffer = audioBuffer;
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
        this.isPlaying = false;
        this._offset = 0;
    }

    play(startTime) {
        if (!this.audioBuffer || !this.audioContext) return;

        // Stop any currently playing source
        this._stopSource();

        if (startTime !== undefined) {
            this._offset = startTime;
        }

        // Clamp offset
        if (this._offset >= this.audioBuffer.duration) {
            this._offset = 0;
        }

        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = this.audioBuffer;
        this.sourceNode.playbackRate.value = this._playbackRate;
        this.sourceNode.connect(this.gainNode);

        this.sourceNode.onended = () => {
            if (this.isPlaying) {
                this.isPlaying = false;
                this._offset = 0;
            }
        };

        this.sourceNode.start(0, this._offset);
        this._startedAt = this.audioContext.currentTime;
        this.isPlaying = true;
    }

    pause() {
        if (!this.isPlaying) return;
        this._offset = this.getCurrentTime();
        this._stopSource();
        this.isPlaying = false;
    }

    stop() {
        this._stopSource();
        this.isPlaying = false;
        this._offset = 0;
    }

    seekTo(time) {
        const wasPlaying = this.isPlaying;
        if (wasPlaying) {
            this._stopSource();
        }
        this._offset = Math.max(0, Math.min(time, this.audioBuffer ? this.audioBuffer.duration : 0));
        if (wasPlaying) {
            this.play();
        }
    }

    getCurrentTime() {
        if (!this.isPlaying || !this.audioContext) {
            return this._offset;
        }
        const elapsed = (this.audioContext.currentTime - this._startedAt) * this._playbackRate;
        const time = this._offset + elapsed;
        return Math.min(time, this.audioBuffer ? this.audioBuffer.duration : 0);
    }

    getDuration() {
        return this.audioBuffer ? this.audioBuffer.duration : 0;
    }

    setPlaybackRate(rate) {
        this._playbackRate = rate;
        if (this.sourceNode && this.isPlaying) {
            // Need to restart with new rate
            const currentTime = this.getCurrentTime();
            this._stopSource();
            this._offset = currentTime;
            this.play();
        }
    }

    _stopSource() {
        if (this.sourceNode) {
            try {
                this.sourceNode.onended = null;
                this.sourceNode.stop();
            } catch (e) {
                // Already stopped
            }
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
    }
}
