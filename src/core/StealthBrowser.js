const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AnonymizeUAPlugin = require('puppeteer-extra-plugin-anonymize-ua');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');

const Humanoid = require('../utils/Humanoid');
const FingerprintManager = require('../utils/FingerprintManager');
const logger = require('../utils/Logger');

puppeteer.use(StealthPlugin());
puppeteer.use(AnonymizeUAPlugin());

class StealthBrowser {
    constructor(config = {}) {
        this.proxy = config.proxy || null;
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

    async init(headless = true) {
        logger.info(`Initializing Advanced Stealth Browser (Headless: ${headless})`);

        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--window-size=1920,1080'
        ];

        if (this.proxy) {
            args.push(`--proxy-server=${this.proxy}`);
            logger.info(`Using Proxy: ${this.proxy}`);
        }

        this.browser = await puppeteer.launch({
            headless: headless ? 'new' : false,
            args,
            defaultViewport: null,
            ignoreDefaultArgs: ['--enable-automation']
        });

        return this.browser;
    }

    async createPage() {
        const page = await this.browser.newPage();

        // Apply advanced stealth & fingerprinting masking
        await FingerprintManager.applyStealth(page);

        // Hide webdriver
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        return page;
    }

    async navigate(page, url) {
        logger.info(`Navigating to ${url}`);
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            await this.handleSecurityChecks(page);
        } catch (error) {
            logger.error(`Navigation failed for ${url}: ${error.message}`);
            throw error;
        }
    }

    async handleSecurityChecks(page) {
        const title = await page.title();
        if (title.includes('Cloudflare') || title.includes('Just a moment')) {
            logger.warn('Cloudflare detected. Waiting for clearance...');
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => { });
            await Humanoid.sleep(5000);
        }
    }

    async performAction(page, action) {
        const { type, selector, value } = action;
        logger.info(`Action: ${type} on ${selector || 'page'}`);

        try {
            switch (type) {
                case 'click':
                    await page.waitForSelector(selector, { visible: true });
                    const rect = await page.$eval(selector, el => {
                        const { x, y, width, height } = el.getBoundingClientRect();
                        return { x, y, width, height };
                    });
                    await Humanoid.bezierMove(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
                    await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
                    break;

                case 'type':
                    await Humanoid.humanType(page, selector, value);
                    break;

                case 'scroll':
                    await page.evaluate(async () => {
                        await new Promise(r => {
                            let totalHeight = 0;
                            let distance = 100;
                            let timer = setInterval(() => {
                                let scrollHeight = document.body.scrollHeight;
                                window.scrollBy(0, distance);
                                totalHeight += distance;
                                if (totalHeight >= scrollHeight || totalHeight > 5000) {
                                    clearInterval(timer);
                                    r();
                                }
                            }, 100);
                        });
                    });
                    break;

                case 'solveCaptcha':
                    if (this.captchaKey) {
                        logger.info('Attempting to solve Recaptcha...');
                        await page.solveRecaptchas();
                    }
                    break;
            }
        } catch (e) {
            logger.error(`Action ${type} failed: ${e.message}`);
        }
    }

    async close() {
        if (this.browser) await this.browser.close();
        logger.info('Browser closed.');
    }
}

module.exports = StealthBrowser;
