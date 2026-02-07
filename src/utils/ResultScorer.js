const logger = require('./Logger');

/**
 * Result quality scoring system
 * Scores search results based on relevance, authority, and content quality
 */
class ResultScorer {
    constructor() {
        // High-authority domains
        this.authorityDomains = [
            'github.com',
            'stackoverflow.com',
            'developer.mozilla.org',
            'npmjs.com',
            'pypi.org',
            'docs.python.org',
            'nodejs.org',
            'reactjs.org',
            'vuejs.org',
            'angular.io',
            'microsoft.com',
            'google.com',
            'apple.com'
        ];

        // Low-quality domains to penalize
        this.lowQualityDomains = [
            'scmp.com', // News site, not tech
            'pinterest.com',
            'facebook.com',
            'twitter.com',
            'instagram.com'
        ];
    }

    /**
     * Score a single result
     */
    scoreResult(result, query) {
        let score = 0;
        const queryLower = query.toLowerCase();
        const titleLower = (result.title || '').toLowerCase();
        const textLower = (result.text || result.parentText || '').toLowerCase();
        const url = result.url || '';

        // 1. Title relevance (max 50 points)
        if (titleLower.includes(queryLower)) {
            score += 50;
        } else {
            // Partial match
            const queryWords = queryLower.split(/\s+/);
            const matchedWords = queryWords.filter(word => titleLower.includes(word));
            score += (matchedWords.length / queryWords.length) * 30;
        }

        // 2. Domain authority (max 30 points)
        const isAuthority = this.authorityDomains.some(domain => url.includes(domain));
        if (isAuthority) {
            score += 30;
        }

        // 3. Penalize low-quality domains (-20 points)
        const isLowQuality = this.lowQualityDomains.some(domain => url.includes(domain));
        if (isLowQuality) {
            score -= 20;
        }

        // 4. Content length (max 20 points)
        const wordCount = result.wordCount || 0;
        if (wordCount > 1000) {
            score += 20;
        } else if (wordCount > 500) {
            score += 15;
        } else if (wordCount > 200) {
            score += 10;
        } else if (wordCount > 50) {
            score += 5;
        }

        // 5. Text snippet relevance (max 15 points)
        if (textLower.includes(queryLower)) {
            score += 15;
        } else {
            const queryWords = queryLower.split(/\s+/);
            const matchedWords = queryWords.filter(word => textLower.includes(word));
            score += (matchedWords.length / queryWords.length) * 10;
        }

        // 6. Freshness bonus (max 10 points)
        if (result.timestamp) {
            const age = Date.now() - new Date(result.timestamp).getTime();
            const daysOld = age / (1000 * 60 * 60 * 24);

            if (daysOld < 30) {
                score += 10;
            } else if (daysOld < 90) {
                score += 7;
            } else if (daysOld < 180) {
                score += 5;
            }
        }

        // Ensure score is non-negative
        score = Math.max(0, score);

        logger.debug(`Scored result: ${score} points - ${titleLower.substring(0, 50)}...`);

        return {
            ...result,
            score: Math.round(score)
        };
    }

    /**
     * Score multiple results
     */
    scoreResults(results, query) {
        if (!results || results.length === 0) {
            return [];
        }

        const scoredResults = results.map(result => this.scoreResult(result, query));

        // Sort by score (highest first)
        scoredResults.sort((a, b) => b.score - a.score);

        const avgScore = scoredResults.reduce((sum, r) => sum + r.score, 0) / scoredResults.length;
        logger.info(`Scored ${scoredResults.length} results. Average score: ${Math.round(avgScore)}`);

        return scoredResults;
    }

    /**
     * Check if results are high quality
     */
    areResultsHighQuality(scoredResults) {
        if (!scoredResults || scoredResults.length === 0) {
            return false;
        }

        const avgScore = scoredResults.reduce((sum, r) => sum + r.score, 0) / scoredResults.length;
        const topScore = scoredResults[0].score;

        // High quality if average > 70 or top result > 90
        return avgScore > 70 || topScore > 90;
    }

    /**
     * Get quality assessment
     */
    assessQuality(scoredResults) {
        if (!scoredResults || scoredResults.length === 0) {
            return { quality: 'none', avgScore: 0, recommendation: 'retry' };
        }

        const avgScore = scoredResults.reduce((sum, r) => sum + r.score, 0) / scoredResults.length;

        if (avgScore > 80) {
            return { quality: 'excellent', avgScore, recommendation: 'use' };
        } else if (avgScore > 60) {
            return { quality: 'good', avgScore, recommendation: 'use' };
        } else if (avgScore > 40) {
            return { quality: 'fair', avgScore, recommendation: 'deep_dive' };
        } else {
            return { quality: 'poor', avgScore, recommendation: 'retry' };
        }
    }
}

// Singleton instance
let instance = null;

module.exports = {
    getInstance: () => {
        if (!instance) {
            instance = new ResultScorer();
        }
        return instance;
    },
    ResultScorer
};
