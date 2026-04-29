/**
 * Qira'ah - Silence Detector
 * Offline analysis of AudioBuffer to find silence positions
 */

export class SilenceDetector {
    /**
     * Detect silences in an AudioBuffer
     * @param {AudioBuffer} audioBuffer
     * @param {Object} options
     * @param {number} options.threshold - RMS threshold (default 0.01)
     * @param {number} options.minDuration - Minimum silence duration in seconds (default 2.0)
     * @param {number} options.windowSize - Analysis window size in samples (default 2048)
     * @returns {number[]} Array of pin positions (seconds) at midpoints of silences
     */
    detect(audioBuffer, options = {}) {
        const threshold = options.threshold ?? 0.01;
        const minDuration = options.minDuration ?? 2.0;
        const windowSize = options.windowSize ?? 2048;

        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const numSamples = channelData.length;
        const duration = audioBuffer.duration;

        const minSilenceSamples = minDuration * sampleRate;
        const pins = [];

        let silenceStart = -1;
        let silenceLength = 0;

        for (let i = 0; i < numSamples; i += windowSize) {
            const end = Math.min(i + windowSize, numSamples);

            // Compute RMS for this window
            let sum = 0;
            for (let j = i; j < end; j++) {
                sum += channelData[j] * channelData[j];
            }
            const rms = Math.sqrt(sum / (end - i));

            if (rms < threshold) {
                if (silenceStart === -1) {
                    silenceStart = i;
                }
                silenceLength = (i + windowSize) - silenceStart;
            } else {
                if (silenceStart !== -1 && silenceLength >= minSilenceSamples) {
                    // Place pin at midpoint of silence
                    const midSample = silenceStart + silenceLength / 2;
                    const midTime = midSample / sampleRate;
                    pins.push(midTime);
                }
                silenceStart = -1;
                silenceLength = 0;
            }
        }

        // Check trailing silence
        if (silenceStart !== -1 && silenceLength >= minSilenceSamples) {
            const midSample = silenceStart + silenceLength / 2;
            const midTime = midSample / sampleRate;
            pins.push(midTime);
        }

        // Post-process: remove pins within 0.5s of start/end, merge pins within 0.5s
        const margin = 0.5;
        let filtered = pins.filter(t => t > margin && t < duration - margin);

        // Merge close pins
        const merged = [];
        for (const t of filtered) {
            if (merged.length > 0 && t - merged[merged.length - 1] < margin) {
                // Average the two
                merged[merged.length - 1] = (merged[merged.length - 1] + t) / 2;
            } else {
                merged.push(t);
            }
        }

        return merged;
    }
}
