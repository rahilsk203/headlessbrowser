const { Cluster } = require('puppeteer-cluster');
const StealthBrowser = require('./stealth-browser');

async function runCluster() {
    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 1, // Reduce concurrency for better stealth
        puppeteerOptions: {
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        }
    });

    await cluster.task(async ({ page, data: query }) => {
        const sb = new StealthBrowser(); // Local instance helper

        // Random initial delay to desynchronize
        await sb.sleep(2000 + Math.random() * 3000);

        const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}`;
        console.log(`[CLUSTER] Searching for: "${query}"`);

        await page.goto(url, { waitUntil: 'networkidle2' });
        await sb.bypassCloudflare(page);
        await sb.sleep(3000); // Wait for results to render

        // Debug screenshot for the first query
        if (query === 'crypto news') {
            await page.screenshot({ path: 'cluster_debug.png' });
        }

        // Extract results - Try multiple selectors for Bing News
        const results = await page.evaluate(() => {
            const sels = ['a.title', 'a.news-card-title', 'div.title a'];
            for (const sel of sels) {
                const elms = Array.from(document.querySelectorAll(sel));
                if (elms.length > 0) return elms.map(el => el.innerText);
            }
            return [];
        });

        console.log(`[CLUSTER] Done: "${query}" -> Found ${results.length} results.`);
        if (results.length > 0) {
            console.log(`[CLUSTER] Top Result for "${query}": ${results[0]}`);
        }
    });

    // Queue multiple queries
    const queries = ['crypto news', 'weather today', 'AI breakthroughs', 'space exploration'];
    for (const q of queries) {
        cluster.queue(q);
    }

    await cluster.idle();
    await cluster.close();
}

runCluster().catch(console.error);
