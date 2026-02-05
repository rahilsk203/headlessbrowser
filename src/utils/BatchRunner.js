const { Cluster } = require('puppeteer-cluster');
const StealthBrowser = require('../core/StealthBrowser');
const Extractor = require('./Extractor');
const logger = require('./Logger');
const fs = require('fs');

class BatchRunner {
    static async run(items, options = {}) {
        const {
            concurrency = 1, // Default to sequential for better stealth
            device = 'desktop',
            extract = false,
            deep = false, // Deep Scan follows search results
            useSystem = false,
            isHeadless = true
        } = options;

        logger.info(`Starting Batch Process: ${items.length} items, Concurrency: ${concurrency}, Deep: ${deep}`);

        let launchOptions = {
            headless: isHeadless ? 'new' : false,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        };

        if (useSystem) {
            const StealthBrowser = require('../core/StealthBrowser');
            const sb = new StealthBrowser();
            const execPath = sb.findSystemBrowser();
            if (execPath) {
                logger.info(`Using System Browser for Batch: ${execPath}`);
                launchOptions.executablePath = execPath;
            }
        }

        const cluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_CONTEXT,
            maxConcurrency: concurrency,
            monitor: false,
            puppeteerOptions: launchOptions
        });

        const results = [];

        const devices = require('../../config/devices');
        const profile = devices[device] || devices['desktop'];
        const FingerprintManager = require('./FingerprintManager');

        await cluster.task(async ({ page, data: item }) => {
            const browser = new StealthBrowser();

            // Add a random "human" delay (2-5 seconds)
            const delay = Math.floor(Math.random() * 3000) + 2000;
            await new Promise(r => setTimeout(r, delay));

            // Apply device emulation and stealth to the cluster-provided page
            logger.info(`Task started: ${item.label} (Device: ${device})`);
            await page.setUserAgent(profile.userAgent);
            await page.setViewport(profile.viewport);
            await FingerprintManager.applyStealth(page, profile.hardware);

            await browser.navigate(page, item.url);

            let extractData = null;
            if (extract) {
                extractData = await Extractor.smartExtract(page);

                // Deep Scan: Follow links if enabled
                if (deep && extractData.results && extractData.results.length > 0) {
                    logger.info(`Deep Scanning ${extractData.results.length} links for "${item.label}"...`);
                    const deepPages = [];

                    for (const result of extractData.results) {
                        let deepPage = null;
                        try {
                            logger.info(`Following: ${result.url}`);

                            // Create a NEW page for each deep navigation
                            deepPage = await page.browser().newPage();
                            await deepPage.setUserAgent(profile.userAgent);
                            await deepPage.setViewport(profile.viewport);
                            await FingerprintManager.applyStealth(deepPage, profile.hardware);

                            // Navigate
                            await deepPage.goto(result.url, {
                                waitUntil: 'domcontentloaded',
                                timeout: 15000
                            });

                            // Extract and IMMEDIATELY save data in nested try-catch
                            try {
                                const pageData = await Extractor.extractPageContent(deepPage);
                                if (pageData && pageData.wordCount > 50) {
                                    deepPages.push(pageData);
                                    logger.info(`✓ Saved ${pageData.wordCount} words from: ${pageData.title.substring(0, 50)}`);
                                }
                            } catch (extractErr) {
                                logger.error(`Extraction error: ${extractErr.message}`);
                            }

                            // Delay
                            await new Promise(r => setTimeout(r, 3000));
                        } catch (err) {
                            logger.error(`Failed to deep scan ${result.url}: ${err.message}`);
                        } finally {
                            // Always close, ignore errors
                            if (deepPage) {
                                try { await deepPage.close(); } catch (e) { /* ignore */ }
                            }
                        }
                    }

                    extractData.deepResults = deepPages;
                    logger.info(`✓ Deep scan complete: ${deepPages.length}/${extractData.results.length} pages extracted`);
                }
            }

            results.push({
                label: item.label,
                url: item.url,
                data: extractData,
                timestamp: new Date().toISOString()
            });

            logger.info(`Task completed: ${item.label}`);
        });

        for (const item of items) {
            cluster.queue(item);
        }

        await cluster.idle();
        await cluster.close();

        logger.info('Batch processing finished.');
        return results;
    }
}

module.exports = BatchRunner;
