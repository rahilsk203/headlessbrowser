/**
 * Humanoid Utility
 * Logic for mimicking real human behavior (Bezier mouse, random delays)
 */
class Humanoid {
    static async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static async jitter(ms = 500) {
        await this.sleep(Math.random() * ms);
    }

    /**
     * Move mouse in a semi-organic path using Bezier-like steps
     */
    static async bezierMove(page, targetX, targetY) {
        const mouse = page.mouse;
        // Start from current mouse position (mocked or actual)
        let curX = Math.random() * 100;
        let curY = Math.random() * 100;

        const steps = 25;
        // Control point for a simple quadratic bezier
        const cpX = (curX + targetX) / 2 + (Math.random() - 0.5) * 100;
        const cpY = (curY + targetY) / 2 + (Math.random() - 0.5) * 100;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = (1 - t) * (1 - t) * curX + 2 * (1 - t) * t * cpX + t * t * targetX;
            const y = (1 - t) * (1 - t) * curY + 2 * (1 - t) * t * cpY + t * t * targetY;

            await mouse.move(x, y);
            // Micro-delay between steps
            if (i % 2 === 0) await new Promise(r => setTimeout(r, Math.random() * 5));
        }
    }

    static async humanType(page, selector, text) {
        await page.focus(selector);
        for (const char of text) {
            // Random chance of "typo" and backspace (1%)
            if (Math.random() < 0.01) {
                await page.keyboard.press('a');
                await this.sleep(100);
                await page.keyboard.press('Backspace');
            }
            await page.keyboard.type(char, { delay: Math.random() * 150 + 50 });
        }
    }
}

module.exports = Humanoid;
