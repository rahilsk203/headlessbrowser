const StealthBrowser = require('./stealth-browser');

async function run() {
    // Optional: Proxy and Captcha Key
    const browser = new StealthBrowser({
        // proxy: 'http://user:pass@host:port',
        // captchaKey: 'YOUR_2CAPTCHA_KEY'
    });

    try {
        await browser.launchBrowser(true); // Headless mode

        // Example: Search for "today news" on DuckDuckGo (more headless friendly)
        const searchUrl = 'https://duckduckgo.com/?q=today+news&ia=news';
        const actions = [
            { type: 'wait', value: 3000 },
            { type: 'scroll' }
        ];

        const page = await browser.navigateAndInteract(searchUrl, actions);

        // Take a screenshot for visual verification
        await page.screenshot({ path: 'news_search.png' });
        console.log('[INFO] Screenshot saved to news_search.png');

        // Extract news titles from DuckDuckGo search results
        // DuckDuckGo uses a.result__a for result titles
        const results = await browser.extractData(page, 'a.result__a', 'innerText');
        console.log('[RESULT] Today\'s News Titles:', results);

        await browser.close();
    } catch (err) {
        console.error('[FATAL]', err);
    }
}

run();
