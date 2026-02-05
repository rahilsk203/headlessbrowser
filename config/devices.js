/**
 * Device Emulation Profiles
 * Standard viewports, User Agents, and hardware specs for different devices.
 */
const devices = {
    'desktop': {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
        hardware: { cores: 8, memory: 16 }
    },
    'iphone-15': {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        viewport: { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
        hardware: { cores: 6, memory: 8 }
    },
    'android-pixel': {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        viewport: { width: 412, height: 915, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
        hardware: { cores: 8, memory: 12 }
    },
    'ipad-pro': {
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        viewport: { width: 1024, height: 1366, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
        hardware: { cores: 8, memory: 16 }
    }
};

module.exports = devices;
