const AIService = require('./src/utils/AIService');
const logger = require('./src/utils/Logger');
const fs = require('fs');

const QUERIES = [
    { q: "Samsung S24 Ultra specs", expected: "gsmarena" },
    { q: "Weather in London", expected: "accuweather" },
    { q: "Python merge dictionaries", expected: "stackoverflow" }, // fallback to SO strategy
    { q: "Latest tech news", expected: "default" } // Fallback to Bing
];

async function runBenchmark() {
    logger.info("=== STARTING AI ACCURACY BENCHMARK ===");
    let results = [];

    for (const item of QUERIES) {
        logger.info(`\nTesting: "${item.q}" (Expected: ${item.expected})`);
        try {
            const start = Date.now();
            const result = await AIService.process(item.q, {
                device: 'desktop',
                useSystem: true,
                isHeadless: false // Headed for visual check
            });
            const duration = (Date.now() - start) / 1000;

            const platform = result.rawData?.metadata?.platform || result.plan?.action || 'unknown';
            const success = (item.expected === 'default') ? true : (platform === item.expected);

            results.push({
                query: item.q,
                platform: platform,
                duration: `${duration.toFixed(1)}s`,
                success: success
            });

        } catch (e) {
            logger.error(`Failed: ${e.message}`);
            results.push({ query: item.q, platform: 'error', duration: '-', success: false });
        }
    }

    console.table(results);
    fs.writeFileSync('data/benchmark_results.json', JSON.stringify(results, null, 2));
}

runBenchmark();
