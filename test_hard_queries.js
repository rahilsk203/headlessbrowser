const AIService = require('./src/utils/AIService');
const logger = require('./src/utils/Logger');
const fs = require('fs');

const HARD_QUERIES = [
    {
        q: "Compare iPhone 15 Pro vs Samsung S24 specs",
        expected: "gsmarena",
        reason: "Comparison of phone specs should trigger GSMArena autonomous planning."
    },
    {
        q: "What is the SAR value of Sony Xperia 1 VI?",
        expected: "gsmarena",
        reason: "Specific technical field buried in device specs."
    },
    {
        q: "Current gold price per gram in USD and last 24h trend",
        expected: "search",
        reason: "Real-time financial data requiring Bing search and deep dive into a results page."
    },
    {
        q: "Find the latest video from Marques Brownlee on YouTube and tell me what product he is talking about.",
        expected: "youtube",
        reason: "Multi-layered YouTube task (search -> channel/video -> summary)."
    }
];

async function runHardBenchmark() {
    logger.info("=== STARTING HARD QUERY CHALLENGE ===");
    let results = [];

    for (const item of HARD_QUERIES) {
        logger.info(`\n[CHALLENGE]: "${item.q}"`);
        try {
            const start = Date.now();
            const result = await AIService.process(item.q, {
                device: 'desktop',
                useSystem: true,
                isHeadless: false,
                clearCache: true // Fresh run for every hard query
            });
            const duration = (Date.now() - start) / 1000;

            const targetUrl = result.plan?.url || 'none';
            const logEntry = {
                query: item.q,
                target_url: targetUrl,
                duration: `${duration.toFixed(1)}s`,
                response_length: result.response?.length || 0,
                status: result.response ? '✅ Success' : '❌ Failed'
            };

            results.push(logEntry);
            logger.info(`Done in ${duration.toFixed(1)}s. Target: ${targetUrl}`);

        } catch (e) {
            logger.error(`Hard Test Failed: ${e.message}`);
            results.push({ query: item.q, status: '❌ Error: ' + e.message, duration: '-' });
        }
    }

    console.table(results);
    fs.writeFileSync('data/hard_benchmark_results.json', JSON.stringify(results, null, 2));
}

runHardBenchmark();
