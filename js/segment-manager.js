/**
 * Qira'ah - Segment Manager
 * Calculates segments from sorted pins + duration
 */

export class SegmentManager {
    constructor() {
        this.segments = [];
    }

    /**
     * Calculate segments from pins and audio duration
     * @param {Array} pins - Sorted array of pin objects with .time
     * @param {number} duration - Total audio duration in seconds
     * @returns {Array} Array of { index, start, end }
     */
    calculate(pins, duration) {
        const boundaries = [0, ...pins.map(p => p.time), duration];
        this.segments = [];

        for (let i = 0; i < boundaries.length - 1; i++) {
            this.segments.push({
                index: i,
                start: boundaries[i],
                end: boundaries[i + 1],
            });
        }

        return this.segments;
    }

    /**
     * Get the current list of segments
     */
    getSegments() {
        return this.segments;
    }

    /**
     * Find which segment contains the given time
     */
    getSegmentAtTime(time) {
        for (const seg of this.segments) {
            if (time >= seg.start && time < seg.end) {
                return seg;
            }
        }
        // Return last segment if at the very end
        return this.segments.length > 0 ? this.segments[this.segments.length - 1] : null;
    }

    /**
     * Get the previous segment relative to current time
     */
    getPrevSegment(currentTime) {
        const current = this.getSegmentAtTime(currentTime);
        if (!current) return null;

        // If we're more than 1s into the current segment, go to its start
        if (currentTime - current.start > 1) {
            return current;
        }

        // Otherwise go to previous segment
        const prevIndex = current.index - 1;
        return prevIndex >= 0 ? this.segments[prevIndex] : current;
    }

    /**
     * Get the next segment relative to current time
     */
    getNextSegment(currentTime) {
        const current = this.getSegmentAtTime(currentTime);
        if (!current) return null;

        const nextIndex = current.index + 1;
        return nextIndex < this.segments.length ? this.segments[nextIndex] : null;
    }
}
