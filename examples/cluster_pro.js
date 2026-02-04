const { Cluster } = require('puppeteer-cluster');
const StealthBrowser = require('../src/core/StealthBrowser');
const logger = require('../src/utils/Logger');

async function runProCluster() {
    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 1,
        puppeteerOptions: {
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    await cluster.task(async ({ page, data: query }) => {
        const sb = new StealthBrowser();
        const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}`;
        logger.info(`[PRO-CLUSTER] Task started: ${query}`);

        try {
            await sb.navigate(page, url);
            const titles = await page.$$eval('.news-card-title', els => els.map(el => el.innerText));
            logger.info(`[PRO-CLUSTER] Finished ${query}: Found ${titles.length} headlines.`);
        } catch (e) {
            logger.error(`[PRO-CLUSTER] Task failed for ${query}: ${e.message}`);
        }
    });

    const queries = ['Global Tech', 'Web Automation', 'Cybersecurity'];
    queries.forEach(q => cluster.queue(q));

    await cluster.idle();
    await cluster.close();
    logger.info('[PRO-CLUSTER] All tasks completed.');
}

runProCluster().catch(err => logger.error(err.message));
