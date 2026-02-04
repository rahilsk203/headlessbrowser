const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AnonymizeUAPlugin = require('puppeteer-extra-plugin-anonymize-ua');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const axios = require('axios');

// Add stealth plugin and other necessary plugins
puppeteer.use(StealthPlugin());
puppeteer.use(AnonymizeUAPlugin());

class StealthBrowser {
    constructor(config = {}) {
        this.proxy = config.proxy || null; // e.g., 'http://user:pass@host:port'
        this.captchaKey = config.captchaKey || null;
        this.browser = null;

        if (this.captchaKey) {
            puppeteer.use(
                RecaptchaPlugin({
                    provider: { id: '2captcha', token: this.captchaKey },
                    visualFeedback: true
                })
            );
        }
    }

    async launchBrowser(headless = true) {
        console.log(`[INFO] Launching browser (headless: ${headless})...`);
        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
            '--disable-blink-features=AutomationControlled',
        ];

        if (this.proxy) {
            args.push(`--proxy-server=${this.proxy}`);
        }

        this.browser = await puppeteer.launch({
            headless: headless ? 'new' : false,
            args: args,
            defaultViewport: { width: 1920, height: 1080 },
            ignoreDefaultArgs: ['--enable-automation']
        });

        return this.browser;
    }

    async navigateAndInteract(url, actions = []) {
        const page = await this.browser.newPage();

        // Anti-fingerprinting: Advanced spoofs
        await page.evaluateOnNewDocument(() => {
            // Mask the 'webdriver' property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });

            // Mask chrome-specific features
            window.chrome = {
                runtime: {},
                loadTimes: function () { },
                csi: function () { },
                app: {}
            };

            // Mask permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        });

        console.log(`[INFO] Navigating to ${url}...`);
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

            await this.bypassCloudflare(page);

            for (const action of actions) {
                await this.executeAction(page, action);
                // Random human delay
                await this.sleep(Math.floor(Math.random() * 2000) + 1000);
            }

            return page;
        } catch (error) {
            console.error(`[ERROR] Navigation to ${url} failed:`, error.message);
            throw error;
        }
    }

    async executeAction(page, action) {
        const { type, selector, value } = action;
        console.log(`[ACTION] ${type} on ${selector || 'page'}`);

        try {
            switch (type) {
                case 'click':
                    await page.waitForSelector(selector, { visible: true });
                    await this.humanClick(page, selector);
                    break;
                case 'type':
                    await page.waitForSelector(selector, { visible: true });
                    await this.humanType(page, selector, value);
                    break;
                case 'scroll':
                    await this.humanScroll(page);
                    break;
                case 'wait':
                    await this.sleep(value || 2000);
                    break;
                case 'solveCaptcha':
                    if (this.captchaKey) {
                        console.log('[INFO] Attempting to solve CAPTCHA...');
                        await page.solveRecaptchas();
                    }
                    break;
            }
        } catch (e) {
            console.warn(`[WARN] Action ${type} failed: ${e.message}`);
        }
    }

    async bypassCloudflare(page) {
        console.log('[INFO] Checking for Cloudflare/WAF...');
        const isCloudflare = await page.evaluate(() => {
            return document.title.includes('Cloudflare') ||
                !!document.querySelector('#cf-content') ||
                !!document.querySelector('.cf-browser-verification');
        });

        if (isCloudflare) {
            console.log('[INFO] Cloudflare detected, waiting for clearance...');
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => { });
            await this.sleep(5000); // Extra safety
        }
    }

    async humanClick(page, selector) {
        const element = await page.$(selector);
        const box = await element.boundingBox();
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;

        // Move mouse to element with jitter
        await page.mouse.move(x + (Math.random() * 5), y + (Math.random() * 5), { steps: 10 });
        await page.mouse.click(x, y);
    }

    async humanType(page, selector, text) {
        await page.focus(selector);
        for (const char of text) {
            await page.keyboard.type(char, { delay: Math.random() * 100 + 50 });
        }
    }

    async humanScroll(page) {
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                let distance = 100;
                let maxScroll = document.body.scrollHeight;
                let timer = setInterval(() => {
                    let scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    // Safety: stop if we reached the bottom or exceeded a reasonable height
                    if (totalHeight >= scrollHeight || totalHeight > 10000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
                // Fail-safe timeout after 10 seconds of scrolling
                setTimeout(() => {
                    clearInterval(timer);
                    resolve();
                }, 10000);
            });
        });
    }

    async extractData(page, selector, attribute = 'innerText') {
        return await page.evaluate((sel, attr) => {
            const elements = Array.from(document.querySelectorAll(sel));
            return elements.map(el => el[attr]);
        }, selector, attribute);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async close() {
        if (this.browser) await this.browser.close();
    }
}

module.exports = StealthBrowser;
