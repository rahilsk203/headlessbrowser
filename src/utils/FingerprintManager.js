/**
 * Fingerprint Manager - Hardcore Edition
 * Injects scripts to mask Canvas, WebGL, Audio, and Hardware fingerprints.
 */
class FingerprintManager {
    static async applyStealth(page, hardware = { cores: 8, memory: 8 }) {
        await page.evaluateOnNewDocument((hw) => {
            // 1. Mask Canvas Fingerprinting (Noise Injection)
            const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
            CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h) {
                const imageData = originalGetImageData.apply(this, arguments);
                // Subtle noise: Modify 1 channel by 1 unit
                imageData.data[0] = imageData.data[0] + (Math.random() > 0.5 ? 1 : -1);
                return imageData;
            };

            // 2. Mask Audio Fingerprinting (AudioContext Noise)
            const originalCreateOscillator = AudioContext.prototype.createOscillator;
            AudioContext.prototype.createOscillator = function () {
                const osc = originalCreateOscillator.apply(this, arguments);
                const originalStop = osc.stop;
                osc.stop = function () {
                    // Inject jitter into the audio processing sequence
                    return originalStop.apply(this, arguments);
                };
                return osc;
            };

            // 3. Mask WebGL / Graphics Vendor
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (parameter) {
                // UNMASKED_VENDOR_WEBGL
                if (parameter === 37445) {
                    const vendors = ['Google Inc. (NVIDIA)', 'Google Inc. (Intel)', 'Google Inc. (AMD)'];
                    return vendors[Math.floor(Math.random() * vendors.length)];
                }
                // UNMASKED_RENDERER_WEBGL
                if (parameter === 37446) {
                    const renderers = [
                        'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
                        'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
                        'ANGLE (AMD, Radeon(TM) RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)'
                    ];
                    return renderers[Math.floor(Math.random() * renderers.length)];
                }
                return getParameter.apply(this, arguments);
            };

            // 4. Mock Plugins & MimeTypes
            const mockPlugins = [
                { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
            ];

            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    const p = [...mockPlugins];
                    p.item = (i) => p[i];
                    p.namedItem = (n) => p.find(x => x.name === n);
                    return p;
                }
            });

            Object.defineProperty(navigator, 'mimeTypes', {
                get: () => {
                    const m = [{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: mockPlugins[0] }];
                    m.item = (i) => m[i];
                    m.namedItem = (n) => m.find(x => x.type === n);
                    return m;
                }
            });

            // 5. Mock Permissions API (Prevent headless detection)
            const originalQuery = Permissions.prototype.query;
            Permissions.prototype.query = (params) => (
                params.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery.apply(this, [params])
            );

            // 6. Mask Hardware & Network
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => hw.cores });
            Object.defineProperty(navigator, 'deviceMemory', { get: () => hw.memory });
            Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            Object.defineProperty(navigator, 'language', { get: () => 'en-US' });

            // Spoof Battery API if it exists
            if (navigator.getBattery) {
                const originalGetBattery = navigator.getBattery;
                navigator.getBattery = () => Promise.resolve({
                    charging: true,
                    chargingTime: 0,
                    dischargingTime: Infinity,
                    level: 1,
                    addEventListener: () => { }
                });
            }
        }, hardware);
    }
}

module.exports = FingerprintManager;
