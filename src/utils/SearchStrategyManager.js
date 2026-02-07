const ToolDiscovery = require('./ToolDiscovery');
const logger = require('./Logger');

/**
 * Smart search strategy manager
 * Determines the best search approach based on query patterns
 */
class SearchStrategyManager {
    constructor() {
        this.toolDiscovery = ToolDiscovery.getInstance();
        this.strategies = {}; // No more hardcoded strategies
    }

    /**
     * Clean query by removing common filler words and site indicators 
     * (Useful for AI to call when it decides on a domain)
     */
    cleanQuery(query, sitePatterns = []) {
        // Universal fillers to strip
        const universalFillers = [
            /\b(search for|find|get|show|check|look up|info on|details of|latest|recent|new|most)\b/gi,
            /\b(me|the|a|an|of|is|was|be|my|your|on|at|from|using|tell me about|what is|where can I find)\b/gi
        ];

        let cleaned = query;

        // Remove site-specific patterns
        sitePatterns.forEach(pattern => {
            cleaned = cleaned.replace(pattern, '');
        });

        // Remove universal fillers
        universalFillers.forEach(pattern => {
            cleaned = cleaned.replace(pattern, '');
        });

        // Final cleanup
        return cleaned.replace(/\s+/g, ' ').trim();
    }

    /**
     * Get search URL (Default to Bing)
     * The AI will now override this if it wants a specific site.
     */
    getSearchUrl(query) {
        // Default to Bing (Enforce English Global)
        return `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en&cc=US&PC=U531`;
    }
}
// Singleton instance
let instance = null;

module.exports = {
    getInstance: () => {
        if (!instance) {
            instance = new SearchStrategyManager();
        }
        return instance;
    },
    SearchStrategyManager
};
