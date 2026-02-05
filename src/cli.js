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
    .allowUnknownOption() // Allow extra flags
    .allowExcessArguments(); // Allow positional args to prevent the error

program.parse(process.argv);

// Enable extract by default if batch is used but no other flags are set
const options = program.opts();
const positionalArgs = program.args;

// If no batch flag but we have positional args, treat lead positional as batch
if (!options.batch && positionalArgs.length > 0) {
    options.batch = positionalArgs.join(', ');
    options.extract = true; // Auto-extract for positional batch
}

if (!options.url && !options.search && !options.batch) {
    logger.error('Error: You must provide either a URL (--url), a search query (--search), or a batch (--batch)');
    program.help();
    process.exit(1);
}

async function runCli() {
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
            data.headings.slice(0, 10).forEach((h, i) => {
                if (h) console.log(`${i + 1}. ${h}`);
            });
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
