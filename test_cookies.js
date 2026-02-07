const StealthBrowser = require('./src/core/StealthBrowser');
const logger = require('./src/utils/Logger');
const path = require('path');

async function testCookies() {
    const browser = new StealthBrowser();
    try {
        await browser.init(false, true);
        const page = await browser.createPage('desktop');

        const cookiePath = path.join(process.cwd(), 'data', 'cokie.json');
        const loaded = await browser.loadCookiesFromFile(page, cookiePath);

        if (loaded) {
            logger.info('SUCCESS: Cookies loaded into page.');

            // Navigate to Bing to see if it recognizes the session
            await browser.navigate(page, 'https://www.bing.com');

            // Check for a specific cookie-related behavior or just print cookies on page
            const cookies = await page.cookies();
            logger.info(`Verification: Page has ${cookies.length} cookies.`);

            // Check for MUID or SID from the file
            const hasMUID = cookies.some(c => c.name === 'MUID' && c.value === '16BC9029246669DC0EEF862525FD6858');
            if (hasMUID) {
                logger.info('✓ Verified: MUID cookie from data/cokie.json is present on Bing!');
            } else {
                logger.warn('MUID not found or changed, but cookies were loaded.');
            }
        } else {
            logger.error('FAILURE: Could not load cookies.');
        }

    } catch (error) {
        logger.error(`Test failed: ${error.message}`);
    } finally {
        setTimeout(async () => {
            await browser.close();
            process.exit();
        }, 5000);
    }
}

testCookies();
