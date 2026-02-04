const StealthBrowser = require('./core/StealthBrowser');
const logger = require('./utils/Logger');

/**
 * Advanced Stealth Browser Pro Entry Point
 */
async function main() {
    const browser = new StealthBrowser({
        // proxy: process.env.PROXY_URL,
        // captchaKey: process.env.CAPTCHA_KEY
    });

    try {
        await browser.init(true);
        const page = await browser.createPage();

        await browser.navigate(page, 'https://bot.sannysoft.com');

        // Take proof for user
        await page.screenshot({ path: 'pro_stealth_test.png', fullPage: true });
        logger.info('Stealth test screenshot saved to pro_stealth_test.png');

        const results = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.result')).map(el => el.innerText);
        });

        logger.info(`Sannysoft Results: ${JSON.stringify(results, null, 2)}`);

        await browser.close();
    } catch (err) {
        logger.error(`Fatal Execution Error: ${err.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
