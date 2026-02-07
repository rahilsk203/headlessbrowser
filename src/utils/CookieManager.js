const fs = require('fs');
const path = require('path');
const logger = require('./Logger');

/**
 * Manages rotation of cookie files from the data directory
 */
class CookieManager {
    constructor() {
        this.cookieDir = path.join(process.cwd(), 'data');
        this.stateFile = path.join(process.cwd(), 'data', '.cookie_state.json');
        this.cookiePattern = /^cokie.*\.json$/;
    }

    /**
     * Get all available cookie files
     */
    getCookieFiles() {
        try {
            if (!fs.existsSync(this.cookieDir)) return [];
            return fs.readdirSync(this.cookieDir)
                .filter(file => this.cookiePattern.test(file))
                .map(file => path.join(this.cookieDir, file));
        } catch (error) {
            logger.error(`Error reading cookie directory: ${error.message}`);
            return [];
        }
    }

    /**
     * Get the next cookie file path in rotation
     */
    getNextCookiePath() {
        const files = this.getCookieFiles();
        if (files.length === 0) return null;
        if (files.length === 1) return files[0];

        let index = 0;
        try {
            if (fs.existsSync(this.stateFile)) {
                const state = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
                index = (state.lastIndex + 1) % files.length;
            }
        } catch (e) {
            index = 0;
        }

        // Save new state
        try {
            fs.writeFileSync(this.stateFile, JSON.stringify({ lastIndex: index }));
        } catch (e) {
            logger.warn(`Could not save cookie rotation state: ${e.message}`);
        }

        const selected = files[index];
        logger.info(`🔄 Cookie Rotation: Selected [${index + 1}/${files.length}] -> ${path.basename(selected)}`);
        return selected;
    }
}

let instance = null;

module.exports = {
    getInstance: () => {
        if (!instance) {
            instance = new CookieManager();
        }
        return instance;
    }
};
