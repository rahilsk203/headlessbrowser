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

    async init(headless = true, useSystemBrowser = false) {
        logger.info(`Initializing Advanced Stealth Browser (Headless: ${headless}, System Browser: ${useSystemBrowser})`);

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

        const launchOptions = {
            headless: headless ? 'new' : false,
            args,
            defaultViewport: null,
            ignoreDefaultArgs: ['--enable-automation']
        };

        if (useSystemBrowser) {
            const systemPath = this.findSystemBrowser();
            if (systemPath) {
                logger.info(`Detected System Browser: ${systemPath}`);
                launchOptions.executablePath = systemPath;
            } else {
                logger.warn('System browser not found in common locations. Falling back to default Chromium.');
            }
        }

        this.browser = await puppeteer.launch(launchOptions);

        return this.browser;
    }

    findSystemBrowser() {
        const fs = require('fs');
        const path = require('path');
        const commonPaths = [
            // Windows
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            // macOS
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            // Linux
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium'
        ];

        for (const p of commonPaths) {
            if (fs.existsSync(p)) return p;
        }
        return null;
    }

    async createPage(profileName = 'desktop') {
        const devices = require('../../config/devices');
        const profile = devices[profileName] || devices['desktop'];

        const page = await this.browser.newPage();

        // Apply device emulation
        logger.info(`Emulating Device: ${profileName}`);
        await page.setUserAgent(profile.userAgent);
        await page.setViewport(profile.viewport);

        // Apply advanced stealth & fingerprinting masking with hardware profile
        await FingerprintManager.applyStealth(page, profile.hardware);

        // Mask webdriver and platform
        await page.evaluateOnNewDocument((ua) => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'platform', { get: () => ua.includes('iPhone') ? 'iPhone' : 'Win32' });
        }, profile.userAgent);

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
