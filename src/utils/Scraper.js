const StealthBrowser = require('../core/StealthBrowser');
const Extractor = require('./Extractor');
const logger = require('./Logger');

class Scraper {
    /**
     * Scrape a direct URL with optional interactions
     */
    static async scrapeUrl(url, options = {}) {
        const {
            device = 'desktop',
            extract = true,
            click = null,
            type = null,
            wait = 0,
            screenshot = null,
            useSystem = false,
            isHeadless = true
        } = options;

        logger.info(`Starting URL Scraper for: ${url}`);
        logger.info(`Device: ${device}, Extract: ${extract}, Interactions: ${click || type ? 'Yes' : 'No'}`);

        const browser = new StealthBrowser();

        try {
            // Initialize browser using StealthBrowser API
            await browser.init(isHeadless, useSystem);
            const page = await browser.createPage(device);

            // Navigate to URL
            logger.info(`Navigating to: ${url}`);
            await browser.navigate(page, url);
            logger.info('✓ Page loaded successfully');

            // 0. Popup Killer (Generic Heuristic)
            // Try to find and click common "Close" buttons for modals/overlays
            try {
                const closeSelectors = [
                    'button[aria-label="Close"]',
                    'button[aria-label="close"]',
                    '.ant-modal-close',
                    '.close-button',
                    'div[role="dialog"] button',
                    'svg.close'
                ];

                for (const selector of closeSelectors) {
                    const closeBtn = await page.$(selector);
                    if (closeBtn) {
                        const isVisible = await closeBtn.boundingBox();
                        if (isVisible) {
                            logger.info(`Popup killer triggering: ${selector}`);
                            await closeBtn.click();
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                }
            } catch (e) {
                // Ignore errors here, just best effort
            }

            // 1. File Upload
            if (options.upload) {
                // Format: "selector:path"
                // Handle paths with colons (windows) e.g. "input[type=file]:C:\path\to\file.jpg"
                const uploadStr = options.upload;
                const splitIndex = uploadStr.indexOf(':');

                if (splitIndex !== -1) {
                    const selector = uploadStr.substring(0, splitIndex);
                    const filePath = uploadStr.substring(splitIndex + 1);

                    if (selector && filePath) {
                        logger.info(`Uploading file to: ${selector}`);
                        const input = await page.waitForSelector(selector, { timeout: 10000 });
                        await input.uploadFile(filePath);
                        logger.info(`✓ File uploaded: ${filePath}`);
                        // Small wait for upload processing
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
            }

            // 2. Type Interaction
            if (type) {
                // Format: "selector:text"
                const [selector, text] = type.split(':');
                if (selector && text) {
                    logger.info(`Typing into: ${selector}`);
                    await page.waitForSelector(selector, { timeout: 10000 });
                    await page.type(selector, text, { delay: 100 });
                    logger.info('✓ Type interaction complete');
                }
            }

            // 3. Click Interaction (e.g. Submit/Send)
            if (click) {
                logger.info(`Clicking element: ${click}`);
                try {
                    await page.waitForSelector(click, { timeout: 5000 });
                    await page.click(click);
                    logger.info('✓ Click interaction complete');
                } catch (e) {
                    logger.warn(`Click failed (selector ${click} not found), trying fallback...`);
                }
                await new Promise(r => setTimeout(r, 2000));
            }

            // 4. Key Press (e.g. Enter to submit)
            if (options.key) {
                logger.info(`Pressing key: ${options.key}`);
                await page.keyboard.press(options.key);
                logger.info(`✓ Key pressed: ${options.key}`);
                await new Promise(r => setTimeout(r, 2000));
            }

            // Custom wait time
            if (wait > 0) {
                logger.info(`Waiting ${wait}ms...`);
                await new Promise(r => setTimeout(r, wait));
            }

            // Take screenshot if requested
            if (screenshot) {
                logger.info(`Saving screenshot to: ${screenshot}`);
                await page.screenshot({ path: screenshot, fullPage: true });
                logger.info('✓ Screenshot saved');
            }

            // Extract content
            let result = {
                url: page.url(),
                title: await page.title(),
                timestamp: new Date().toISOString()
            };

            if (extract) {
                logger.info('Extracting page content...');
                const extractedData = await Extractor.extractPageContent(page);
                result = { ...result, ...extractedData };
                logger.info(`✓ Extracted ${extractedData.wordCount} words`);
            }

            await browser.close();
            return result;

        } catch (error) {
            logger.error(`Scraping failed: ${error.message}`);
            await browser.close();
            throw error;
        }
    }

    /**
     * Scrape multiple URLs in sequence
     */
    static async scrapeMultipleUrls(urls, options = {}) {
        const results = [];

        for (const url of urls) {
            try {
                logger.info(`\n--- Scraping ${url} ---`);
                const result = await this.scrapeUrl(url, options);
                results.push(result);

                // Delay between requests
                await new Promise(r => setTimeout(r, 3000));
            } catch (err) {
                logger.error(`Failed to scrape ${url}: ${err.message}`);
                results.push({
                    url,
                    error: err.message,
                    timestamp: new Date().toISOString()
                });
            }
        }

        return results;
    }
}

module.exports = Scraper;
