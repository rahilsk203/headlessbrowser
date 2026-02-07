const fs = require('fs');
const path = require('path');
const logger = require('./Logger');

/**
 * Intelligent caching system for AI agent
 * Caches search results and page content to improve speed
 * Persists to disk to survive CLI restarts
 */
class CacheManager {
    constructor(ttl = 3600000) { // Default 1 hour TTL
        this.cache = new Map();
        this.ttl = ttl;
        this.hits = 0;
        this.misses = 0;
        this.cacheFile = path.join(__dirname, '../../data/cache.json');
        this.load();
    }

    /**
     * Load cache from disk
     */
    load() {
        try {
            if (fs.existsSync(this.cacheFile)) {
                const data = fs.readFileSync(this.cacheFile, 'utf8');
                const json = JSON.parse(data);

                // Convert object back to Map
                Object.entries(json).forEach(([key, value]) => {
                    this.cache.set(key, value);
                });

                logger.debug(`Loaded ${this.cache.size} items from cache file`);
            }
        } catch (error) {
            logger.error(`Failed to load cache: ${error.message}`);
        }
    }

    /**
     * Save cache to disk
     */
    save() {
        try {
            const data = {};
            this.cache.forEach((value, key) => {
                data[key] = value;
            });

            // Ensure directory exists
            const dir = path.dirname(this.cacheFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2));
            logger.debug('Cache saved to disk');
        } catch (error) {
            logger.error(`Failed to save cache: ${error.message}`);
        }
    }

    /**
     * Generate cache key from URL or query
     */
    generateKey(input) {
        if (typeof input === 'string') {
            return input.toLowerCase().trim();
        }
        return JSON.stringify(input);
    }

    /**
     * Get cached data
     */
    get(key) {
        const cacheKey = this.generateKey(key);
        const item = this.cache.get(cacheKey);

        if (!item) {
            this.misses++;
            logger.debug(`Cache MISS: ${cacheKey}`);
            return null;
        }

        // Check if expired
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(cacheKey);
            this.misses++;
            logger.debug(`Cache EXPIRED: ${cacheKey}`);
            this.save(); // Update disk
            return null;
        }

        this.hits++;
        logger.info(`Cache HIT: ${cacheKey} (${this.getHitRate()}% hit rate)`);
        return item.data;
    }

    /**
     * Set cached data
     */
    set(key, data) {
        const cacheKey = this.generateKey(key);
        this.cache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });
        logger.debug(`Cache SET: ${cacheKey}`);
        this.save(); // Persist immediately
    }

    /**
     * Check if key exists in cache
     */
    has(key) {
        const cacheKey = this.generateKey(key);
        const item = this.cache.get(cacheKey);

        if (!item) return false;

        // Check if expired
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(cacheKey);
            this.save();
            return false;
        }

        return true;
    }

    /**
     * Clear all cache
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
        logger.info(`Cache cleared: ${size} items removed`);
        this.save();
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: this.getHitRate()
        };
    }

    /**
     * Calculate cache hit rate
     */
    getHitRate() {
        const total = this.hits + this.misses;
        if (total === 0) return 0;
        return Math.round((this.hits / total) * 100);
    }

    /**
     * Remove expired entries
     */
    cleanup() {
        const now = Date.now();
        let removed = 0;

        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > this.ttl) {
                this.cache.delete(key);
                removed++;
            }
        }

        if (removed > 0) {
            logger.info(`Cache cleanup: ${removed} expired items removed`);
            this.save();
        }
    }
}

// Singleton instance
let instance = null;

module.exports = {
    getInstance: (ttl) => {
        if (!instance) {
            instance = new CacheManager(ttl);
        }
        return instance;
    },
    CacheManager
};
