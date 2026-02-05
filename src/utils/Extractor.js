const fs = require('fs');
const path = require('path');
const logger = require('./Logger');

/**
 * Extractor Utility
 * Handles schema-based scraping, smart content detection, and data export.
 */
class Extractor {
    /**
     * Extracts data using a JSON schema
     * Schema format: { "field": "selector", "list": { "_container": ".item", "name": ".name" } }
     */
    static async extractBySchema(page, schema) {
        logger.info('Extracting data by schema...');
        return await page.evaluate((s) => {
            const results = {};

            for (const key in s) {
                const val = s[key];

                if (typeof val === 'string') {
                    // Simple selector
                    results[key] = document.querySelector(val)?.innerText?.trim() || null;
                } else if (typeof val === 'object' && val._container) {
                    // List extraction
                    const containers = Array.from(document.querySelectorAll(val._container));
                    results[key] = containers.map(container => {
                        const item = {};
                        for (const itemKey in val) {
                            if (itemKey === '_container') continue;
                            item[itemKey] = container.querySelector(val[itemKey])?.innerText?.trim() || null;
                        }
                        return item;
                    });
                }
            }
            return results;
        }, schema);
    }

    /**
     * Deep Smart Heuristics to find any meaningful text content and lists
     */
    static async smartExtract(page) {
        logger.info('Running aggressive smart extraction...');
        await page.evaluate(() => {
            window.scrollTo(0, 800);
            return new Promise(r => setTimeout(r, 2000));
        });

        const content = await page.evaluate(() => {
            const results = {
                title: document.title,
                results: [],
                allText: document.body.innerText.substring(0, 500),
                isBlocked: document.body.innerText.includes('solve the challenge') || document.body.innerText.includes('check your browser')
            };

            if (results.isBlocked) return results;

            // 1. Target anything that looks like a search result link
            // Expanded selectors for Bing, Google, DuckDuckGo etc.
            const links = Array.from(document.querySelectorAll('h1 a, h2 a, h3 a, h4 a, .b_algo a, .g a, a[role="heading"], .result__a'));
            results.results = links
                .map(a => ({
                    title: a.innerText.trim(),
                    url: a.href,
                    parentText: a.parentElement?.innerText?.slice(0, 300).replace(/\n/g, ' ') || ''
                }))
                // Filter out non-sense links and internal search links
                .filter(r => {
                    const url = r.url.toLowerCase();
                    const isInternal = (url.includes('bing.com') && !url.includes('/ck/')) ||
                        (url.includes('google.com') && !url.includes('/url?')) ||
                        url.includes('microsoft.com') ||
                        url.includes('apple.com');
                    return r.title.length > 10 && r.url.startsWith('http') && !isInternal;
                })
                .slice(0, 5); // Limit to top 5 for deep crawl

            // 2. Headings as backup
            results.headings = Array.from(document.querySelectorAll('h1, h2, h3'))
                .map(h => h.innerText.trim())
                .filter(t => t.length > 5);

            return results;
        });

        if (content.isBlocked) {
            logger.warn('Bot detection/Captcha detected! Results will be empty.');
        }

        return content;
    }

    /**
     * Extracts full content from a target page (not a search engine)
     */
    static async extractPageContent(page) {
        logger.info(`Extracting full content from: ${page.url()}`);

        // Wait for content and trigger scroll (common for all)
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight / 2);
            return new Promise(r => setTimeout(r, 2000));
        });

        const url = page.url();

        // Dispatch to appropriate extractor
        if (url.includes('youtube.com')) {
            const YouTubeExtractor = require('./extractors/YouTubeExtractor');
            return await YouTubeExtractor.extract(page);
        }

        if (url.includes('instagram.com')) {
            const InstagramExtractor = require('./extractors/InstagramExtractor');
            return await InstagramExtractor.extract(page);
        }

        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            const FacebookExtractor = require('./extractors/FacebookExtractor');
            return await FacebookExtractor.extract(page);
        }

        if (url.includes('github.com')) {
            const GitHubExtractor = require('./extractors/GitHubExtractor');
            return await GitHubExtractor.extract(page);
        }

        if (url.includes('gsmarena.com')) {
            const GSMArenaExtractor = require('./extractors/GSMArenaExtractor');
            return await GSMArenaExtractor.extract(page);
        }

        if (url.includes('accuweather.com')) {
            const AccuWeatherExtractor = require('./extractors/AccuWeatherExtractor');
            return await AccuWeatherExtractor.extract(page);
        }

        const GenericExtractor = require('./extractors/GenericExtractor');
        return await GenericExtractor.extract(page);
    }

    /**
     * Export data to file (JSON or CSV)
     */
    static saveToFile(data, fileName) {
        const ext = path.extname(fileName).toLowerCase();
        let content = '';

        if (ext === '.json') {
            content = JSON.stringify(data, null, 2);
        } else if (ext === '.csv') {
            if (!Array.isArray(data) || data.length === 0) {
                logger.error('CSV export requires an array of objects.');
                return;
            }
            const headers = Object.keys(data[0]);
            content = [
                headers.join(','),
                ...data.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))
            ].join('\n');
        }

        const dir = path.dirname(fileName);
        if (dir !== '.' && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(fileName, content);
        logger.info(`Data exported to: ${fileName}`);
    }
}

module.exports = Extractor;
