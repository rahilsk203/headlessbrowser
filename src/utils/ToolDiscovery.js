const fs = require('fs');
const path = require('path');
const logger = require('./Logger');

/**
 * ToolDiscovery Utility
 * Dynamically scans the extractors folder to identify supported sites.
 */
class ToolDiscovery {
    constructor() {
        this.extractorDir = path.join(__dirname, 'extractors');
        this.tools = [];
        this.refresh();
    }

    /**
     * Scan the extractors folder and populate the tools list
     */
    refresh() {
        try {
            if (!fs.existsSync(this.extractorDir)) {
                logger.warn(`Extractor directory not found: ${this.extractorDir}`);
                return;
            }

            const files = fs.readdirSync(this.extractorDir);
            this.tools = files
                .filter(f => f.endsWith('Extractor.js') && f !== 'GenericExtractor.js')
                .map(f => {
                    const site = f.replace('Extractor.js', '').toLowerCase();
                    return {
                        site: site,
                        fileName: f,
                        displayName: f.replace('Extractor.js', '')
                    };
                });

            logger.info(`ToolDiscovery: Identified ${this.tools.length} specific site tools.`);
        } catch (error) {
            logger.error(`Failed to refresh tool list: ${error.message}`);
        }
    }

    /**
     * Get list of supported sites for AI context
     */
    getSupportedSites() {
        return this.tools.map(t => t.site);
    }

    /**
     * Check if a specific site is supported
     */
    isSupported(siteName) {
        return this.tools.some(t => t.site === siteName.toLowerCase());
    }
}

// Singleton instance
let instance = null;

module.exports = {
    getInstance: () => {
        if (!instance) {
            instance = new ToolDiscovery();
        }
        return instance;
    }
};
