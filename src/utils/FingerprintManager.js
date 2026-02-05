/**
 * Fingerprint Manager
 * Injects scripts to mask Canvas, WebGL, and other hardware fingerprints
 */
class FingerprintManager {
    static async applyStealth(page, hardware = { cores: 8, memory: 8 }) {
        await page.evaluateOnNewDocument((hw) => {
            // Mask Canvas Fingerprinting
            const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
            CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h) {
                const imageData = originalGetImageData.apply(this, arguments);
                // Subtle noise injection
                imageData.data[0] = imageData.data[0] + (Math.random() > 0.5 ? 1 : -1);
                return imageData;
            };

            // Mask WebGL
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (parameter) {
                // Return generic instead of specific hardware
                if (parameter === 37445) return 'Intel Open Source Technology Center';
                if (parameter === 37446) return 'Mesa DRI Intel(R) Sandybridge Mobile';
                return getParameter.apply(this, arguments);
            };

            // Mask Hardware Concurrency
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => hw.cores });

            // Mask Memory
            Object.defineProperty(navigator, 'deviceMemory', { get: () => hw.memory });
        }, hardware);
    }
}

module.exports = FingerprintManager;
