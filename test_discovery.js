const ToolDiscovery = require('./src/utils/ToolDiscovery');
const logger = require('./src/utils/Logger');

async function testDiscovery() {
    const td = ToolDiscovery.getInstance();
    const sites = td.getSupportedSites();

    logger.info('--- Tool Discovery Test ---');
    logger.info(`Detected Sites: ${sites.join(', ')}`);

    if (sites.includes('youtube') && sites.includes('github') && sites.includes('accuweather')) {
        logger.info('✅ SUCCESS: All core tools detected.');
    } else {
        logger.warn('⚠️ Missing some tools. Check src/utils/extractors/ directory.');
    }
}

testDiscovery();
