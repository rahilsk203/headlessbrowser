const StealthBrowser = require('./src/core/StealthBrowser');
const logger = require('./src/utils/Logger');
const Humanoid = require('./src/utils/Humanoid');

async function runComprehensiveTest() {
    const browser = new StealthBrowser();

    try {
        // 1. Initialize Browser
        await browser.init(false); // Run in headed mode for visual proof if possible, else headless
        const page = await browser.createPage();

        // 2. Test YouTube Navigation & Interaction
        logger.info('--- Phase 1: YouTube Test ---');
        await browser.navigate(page, 'https://www.youtube.com');

        // Human-like scroll
        await browser.performAction(page, { type: 'scroll' });
        await Humanoid.sleep(2000);

        // Search for something on YouTube
        const ytSearchSelector = 'input[name="search_query"]';
        await page.waitForSelector(ytSearchSelector, { visible: true });
        await browser.performAction(page, { type: 'type', selector: ytSearchSelector, value: 'Space Exploration 4K' });
        await page.keyboard.press('Enter');

        await Humanoid.sleep(5000);
        await page.screenshot({ path: 'youtube_test.png' });
        logger.info('YouTube test screenshot saved to youtube_test.png');

        // 3. Test Bing Search & Data Extraction
        logger.info('--- Phase 2: Search & Extraction Test ---');
        await browser.navigate(page, 'https://www.bing.com/news');
        await browser.performAction(page, { type: 'scroll' });

        const titles = await page.$$eval('a.title', els => els.slice(0, 5).map(el => el.innerText));
        logger.info(`Extracted Bing News Titles: ${JSON.stringify(titles, null, 2)}`);

        await page.screenshot({ path: 'search_test.png' });
        logger.info('Search test screenshot saved to search_test.png');

        // 4. Final Stealth Check
        logger.info('--- Phase 3: Final Stealth Verification ---');
        await browser.navigate(page, 'https://bot.sannysoft.com');
        await page.screenshot({ path: 'final_stealth_proof.png', fullPage: true });
        logger.info('Final stealth proof saved to final_stealth_proof.png');

        await browser.close();
        logger.info('All comprehensive tests completed successfully.');

    } catch (err) {
        logger.error(`Comprehensive Test Failed: ${err.message}`);
        if (browser) await browser.close();
    }
}

runComprehensiveTest();
