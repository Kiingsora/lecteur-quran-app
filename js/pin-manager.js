/**
 * Qira'ah - Pin Manager
 * CRUD for timeline pins with unique IDs, always sorted by time
 */

export class PinManager {
    constructor() {
        this.pins = [];
    }

    /**
     * Add a pin at a given time
     * @param {number} time - Position in seconds
     * @param {string|null} label - Optional label
     * @param {boolean} isAuto - Whether auto-detected
     * @returns {Object} The created pin
     */
    addPin(time, label = null, isAuto = false) {
        const pin = {
            id: crypto.randomUUID(),
            time,
            label,
            isAuto,
        };
        this.pins.push(pin);
        this._sort();
        return pin;
    }

    /**
     * Remove a pin by ID
     */
    removePin(id) {
        this.pins = this.pins.filter(p => p.id !== id);
    }

    /**
     * Move a pin to a new time position
     */
    movePin(id, newTime) {
        const pin = this.pins.find(p => p.id === id);
        if (pin) {
            pin.time = newTime;
            this._sort();
        }
    }

    /**
     * Get all pins (sorted by time)
     */
    getPins() {
        return this.pins;
    }

    /**
     * Find pin nearest to a given time, within maxDistance
     */
    findNearest(time, maxDistance = 0.5) {
        let nearest = null;
        let minDist = Infinity;
        for (const pin of this.pins) {
            const dist = Math.abs(pin.time - time);
            if (dist < minDist && dist <= maxDistance) {
                minDist = dist;
                nearest = pin;
            }
        }
        return nearest;
    }

    /**
     * Clear all pins
     */
    clear() {
        this.pins = [];
    }

    _sort() {
        this.pins.sort((a, b) => a.time - b.time);
    }
}
