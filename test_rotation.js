const CookieManager = require('./src/utils/CookieManager');
const logger = require('./src/utils/Logger');
const path = require('path');

async function testRotation() {
    const cm = CookieManager.getInstance();

    logger.info('--- Starting Cookie Rotation Test ---');

    const first = cm.getNextCookiePath();
    logger.info(`Run 1: ${path.basename(first)}`);

    const second = cm.getNextCookiePath();
    logger.info(`Run 2: ${path.basename(second)}`);

    const third = cm.getNextCookiePath();
    logger.info(`Run 3: ${path.basename(third)}`);

    if (first !== second && first === third) {
        logger.info('✅ SUCCESS: Rotation confirmed (A -> B -> A)');
    } else {
        logger.warn('⚠️ Rotation pattern unexpected. Check available cookie files in data/.');
        const files = cm.getCookieFiles();
        logger.info(`Detected files: ${files.map(f => path.basename(f)).join(', ')}`);
    }
}

testRotation();
