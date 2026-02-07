const StealthBrowser = require('./src/core/StealthBrowser');
const logger = require('./src/utils/Logger');

async function testBing() {
    const browser = new StealthBrowser();
    try {
        await browser.init(false, true); // Headed, System Browser for best stealth
        const page = await browser.createPage('desktop');

        const testUrl = 'https://www.bing.com/search?q=SpaceX+Starship+latest+news';
        logger.info(`Testing Bing Bypass on: ${testUrl}`);

        await browser.navigate(page, testUrl);

        // Wait for results
        await page.waitForSelector('#b_results', { timeout: 10000 });

        const results = await page.evaluate(() => {
            return document.querySelectorAll('.b_algo').length;
        });

        if (results > 0) {
            logger.info(`SUCCESS: Found ${results} results on Bing!`);
        } else {
            logger.warn('FAILURE: No results found or blocked.');
        }

    } catch (error) {
        logger.error(`Test failed: ${error.message}`);
    } finally {
        // Keep browser open for a bit to inspect
        setTimeout(async () => {
            await browser.close();
            process.exit();
        }, 5000);
    }
}

testBing();
