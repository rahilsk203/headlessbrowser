#!/usr/bin/env node
const { program } = require('commander');
const StealthBrowser = require('./core/StealthBrowser');
const Extractor = require('./utils/Extractor');
const Humanoid = require('./utils/Humanoid');
const BatchRunner = require('./utils/BatchRunner');
const logger = require('./utils/Logger');
const fs = require('fs');
const pkg = require('../package.json');

program
    .version(pkg.version)
    .description('Stealth Browser Pro CLI - Advanced Web Automation & Extraction')
    .option('-s, --search <query>', 'Search for a query on Bing')
    .option('-b, --batch <list>', 'Run a batch of queries (comma-separated or file path)')
    .option('-d, --device <device>', 'Emulate a device profile (desktop, iphone-15, android-pixel, ipad-pro)', 'desktop')
    .option('-e, --extract', 'Enable smart content extraction')
    .option('--deep', 'Follow search results and extract target page content')
    .option('-u, --url <url>', 'Scrape a direct URL with optional interactions')
    .option('--click <selector>', 'Click an element selector')
    .option('--type <input>', 'Type into an element ("selector:text")')
    .option('--upload <input>', 'Upload a file ("selector:path")')
    .option('--key <key>', 'Press a key (e.g. "Enter")')
    .option('--wait <ms>', 'Wait time in milliseconds', 0)
    .option('--screenshot <path>', 'Save a screenshot to the specified path')
    .option('--system', 'Use the system browser instead of bundled Chromium')
    .option('--headed', 'Run browser in headed (visible) mode')
    .option('--scroll', 'Execute a human-like scroll before other actions')
    .option('--ai <query>', 'Use AI to derive plan, automate browser, and filter results')
    .option('--clear-cache', 'Clear all cached results before starting')
    .allowUnknownOption() // Allow extra flags
    .allowExcessArguments(); // Allow positional args to prevent the error

program.parse(process.argv);

// Enable extract by default if batch is used but no other flags are set
const options = program.opts();
const positionalArgs = program.args;

// If no batch/url/search flag but we have positional args, treat lead positional as AI query
if (!options.batch && !options.url && !options.search && !options.ai && positionalArgs.length > 0) {
    options.ai = positionalArgs.join(' ');
}

if (!options.url && !options.search && !options.batch && !options.ai) {
    logger.error('Error: Provide URL (--url), search (--search), batch (--batch), or AI query (--ai)');
    program.help();
    process.exit(1);
}

async function runCli() {
    // Mode 0: AI-Driven Automation
    if (options.ai) {
        const AIService = require('./utils/AIService');

        if (options.clearCache) {
            const { getInstance: getCacheManager } = require('./utils/CacheManager');
            getCacheManager().clear();
            logger.info("✓ Cache cleared.");
        }

        logger.info(`Entering AI Automation Mode: "${options.ai}"`);

        try {
            const result = await AIService.process(options.ai, {
                device: options.device,
                useSystem: !!options.system,
                isHeadless: !options.headed
            });

            if (result.error) {
                logger.error(`AI Mode failed: ${result.error}`);
            } else {
                // Save AI summary and plan
                const platform = result.plan?.url.includes('search') ? 'search' : 'ai_intent';
                const filename = `data/ai_output.json`;
                Extractor.saveToFile(result, filename);
                logger.info(`✓ AI Automation flow complete.`);
            }
            return;
        } catch (err) {
            logger.error(`Critical AI failure: ${err.message}`);
            process.exit(1);
        }
    }

    // Mode 1: Direct URL Scraping with Interactions
    if (options.url && (options.click || options.type || options.upload || options.wait || options.screenshot || options.extract)) {
        logger.info(`Direct URL Scraping Mode: ${options.url}`);
        const Scraper = require('./utils/Scraper');

        const result = await Scraper.scrapeUrl(options.url, {
            device: options.device,
            extract: options.extract || true,
            click: options.click,
            type: options.type,
            upload: options.upload,
            key: options.key,
            wait: options.wait,
            screenshot: options.screenshot,
            useSystem: options.system,
            isHeadless: !options.headed
        });

        logger.info(`✓ Scraping complete: ${result.wordCount || 0} words extracted`);

        // Save to file
        // Save to file based on platform
        const platform = result.metadata?.platform || 'url';
        const filename = `data/${platform}_scrape.json`;
        Extractor.saveToFile(result, filename);
        console.log(JSON.stringify(result, null, 2));
        return;
    }

    // Mode 2: Batch Processing
    if (options.batch) {
        let items = [];
        logger.info(`Processing Batch: ${options.batch}`);

        if (fs.existsSync(options.batch)) {
            const content = fs.readFileSync(options.batch, 'utf8');
            items = content.split('\n').filter(l => l.trim()).map(l => ({
                label: l.trim(),
                url: `https://www.bing.com/search?q=${encodeURIComponent(l.trim())}`
            }));
        } else {
            items = options.batch.split(',').map(query => ({
                label: query.trim(),
                url: `https://www.bing.com/search?q=${encodeURIComponent(query.trim())}`
            }));
        }

        const batchResults = await BatchRunner.run(items, {
            concurrency: 1, // Sequential execution for stealth
            device: options.device,
            extract: options.extract || true, // FORCE extraction for batch if asked
            deep: !!options.deep,
            useSystem: !!options.system,
            isHeadless: !options.headed
        });

        Extractor.saveToFile(batchResults, 'data/batch_results.json');
        logger.info(`Batch complete. Saved ${batchResults.length} results to data/batch_results.json`);
        return;
    }

    const browser = new StealthBrowser();

    try {
        const isHeadless = !options.headed;
        const useSystem = !!options.system;

        await browser.init(isHeadless, useSystem);
        const page = await browser.createPage(options.device);

        let targetUrl = options.url;
        if (options.search) {
            targetUrl = `https://www.bing.com/search?q=${encodeURIComponent(options.search)}`;
            logger.info(`Searching for: "${options.search}"`);
        }

        await browser.navigate(page, targetUrl);

        if (options.scroll) {
            logger.info('Performing human-like scroll...');
            await browser.performAction(page, { type: 'scroll' });
            await Humanoid.sleep(2000);
        }

        if (options.screenshot) {
            await page.screenshot({ path: options.screenshot, fullPage: true });
            logger.info(`Screenshot saved to: ${options.screenshot}`);
        }

        if (options.extract) {
            logger.info('Executing smart extraction...');
            const data = await Extractor.smartExtract(page);
            const outputPath = 'data/cli_extract.json';
            Extractor.saveToFile(data, outputPath);
            console.log('\n--- Extracted Headlines ---');
            if (data.results && data.results.length > 0) {
                data.results.slice(0, 10).forEach((r, i) => {
                    if (r && r.title) console.log(`${i + 1}. ${r.title}`);
                });
            } else {
                console.log('No results extracted.');
            }
            console.log(`\nFull data saved to: ${outputPath}\n`);
        }

        await browser.close();

    } catch (err) {
        logger.error(`CLI execution failed: ${err.message}`);
        if (browser) await browser.close();
        process.exit(1);
    }
}

runCli();
