const logger = require('./Logger');

/**
 * Humanoid Utility - Hardcore Edition
 * Mimics real human behavior: Bezier splines, mouse inertia, hesitations, and "thinking" pauses.
 */
class Humanoid {
    static async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Move mouse in a human-like path
     * Features: Multi-point curves, Acceleration/Deceleration, Hesitations
     */
    static async bezierMove(page, targetX, targetY) {
        const mouse = page.mouse;

        // Start from current or random offset
        let curX = Math.random() * 500;
        let curY = Math.random() * 500;

        // Create 2-3 intermediate control points for organic curves
        const ctrlPoints = [
            { x: curX, y: curY },
            {
                x: curX + (targetX - curX) * 0.3 + (Math.random() - 0.5) * 200,
                y: curY + (targetY - curY) * 0.3 + (Math.random() - 0.5) * 200
            },
            {
                x: curX + (targetX - curX) * 0.7 + (Math.random() - 0.5) * 150,
                y: curY + (targetY - curY) * 0.7 + (Math.random() - 0.5) * 150
            },
            { x: targetX, y: targetY }
        ];

        const steps = Math.floor(Math.max(15, Math.random() * 40));

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;

            // Ease-In-Out timing function (Physics: Acceleration -> Deceleration)
            const easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

            // Cubic Bezier calculation
            const x = Math.pow(1 - easeT, 3) * ctrlPoints[0].x +
                3 * Math.pow(1 - easeT, 2) * easeT * ctrlPoints[1].x +
                3 * (1 - easeT) * Math.pow(easeT, 2) * ctrlPoints[2].x +
                Math.pow(easeT, 3) * ctrlPoints[3].x;

            const y = Math.pow(1 - easeT, 3) * ctrlPoints[0].y +
                3 * Math.pow(1 - easeT, 2) * easeT * ctrlPoints[1].y +
                3 * (1 - easeT) * Math.pow(easeT, 2) * ctrlPoints[2].y +
                Math.pow(easeT, 3) * ctrlPoints[3].y;

            await mouse.move(x, y);

            // Random Hesitation: 5% chance to pause mid-movement (searching for target)
            if (Math.random() < 0.05) {
                await this.sleep(Math.random() * 200 + 50);
            }

            // Variable micro-delay
            await this.sleep(Math.random() * 10);
        }

        // Final micro-adjustment (Overshoot correction)
        if (Math.random() < 0.3) {
            const ox = targetX + (Math.random() - 0.5) * 5;
            const oy = targetY + (Math.random() - 0.5) * 5;
            await mouse.move(ox, oy);
            await this.sleep(Math.random() * 100);
            await mouse.move(targetX, targetY);
        }
    }

    /**
     * Human-like typing with "thinking" pauses and typos
     */
    static async humanType(page, selector, text) {
        await page.focus(selector);

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // Thinking pause between words or punctuation
            if (char === ' ' || char === '.' || char === ',') {
                await this.sleep(Math.random() * 400 + 100);
            }

            // Rare Typo Simulation (0.5%)
            if (Math.random() < 0.005) {
                const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
                await page.keyboard.type(wrongChar);
                await this.sleep(Math.random() * 200 + 150);
                await page.keyboard.press('Backspace');
                await this.sleep(Math.random() * 100 + 50);
            }

            // Burst typing: Speed varies
            const delay = Math.random() < 0.2 ? Math.random() * 30 : Math.random() * 150 + 50;
            await page.keyboard.type(char, { delay });
        }
    }

    /**
     * Simulate a user reading a page with random scrolls and pauses
     */
    static async scrollRandomly(page) {
        logger.info('Simulating reading behavior (random scrolling)...');
        try {
            const viewport = page.viewport();
            if (!viewport) return;

            // Number of scroll steps
            const steps = Math.floor(Math.random() * 3 + 2);

            for (let i = 0; i < steps; i++) {
                // Scroll down a random amount (300-700px)
                const scrollAmount = Math.floor(Math.random() * 400 + 300);
                await page.evaluate((y) => window.scrollBy(0, y), scrollAmount);

                // Random pause (1-3s)
                await this.sleep(Math.random() * 2000 + 1000);

                // 20% chance to scroll up a tiny bit (simulating re-reading)
                if (Math.random() < 0.2) {
                    const upAmount = Math.floor(Math.random() * 100 + 50);
                    await page.evaluate((y) => window.scrollBy(0, -y), upAmount);
                    await this.sleep(Math.random() * 1000 + 500);
                }
            }
        } catch (e) {
            logger.warn(`Scroll simulation failed: ${e.message}`);
        }
    }
}

module.exports = Humanoid;
