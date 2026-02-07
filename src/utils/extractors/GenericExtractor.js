const logger = require('../Logger');

class GenericExtractor {
    static async extract(page) {
        return await page.evaluate(() => {
            const isVisible = (el) => {
                const style = window.getComputedStyle(el);
                return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
            };

            const selectors = [
                'article', 'main', '.content', '.post-content', '.article-body', '.entry-content', 'section'
            ];

            let mainContent = '';
            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el && isVisible(el) && el.innerText.length > 500) {
                    mainContent = el.innerText.split('\n').filter(t => t.trim().length > 20).join('\n');
                    break;
                }
            }

            // Fallback: If no semantic container, get all paragraphs
            if (!mainContent) {
                mainContent = Array.from(document.querySelectorAll('p'))
                    .filter(isVisible)
                    .map(p => p.innerText.trim())
                    .filter(t => t.length > 30)
                    .join('\n');
            }

            // Extract Interactable Elements (Buttons, Inputs)
            const interactables = [];
            document.querySelectorAll('button, input[type="submit"], [role="button"], a.btn, .button').forEach(el => {
                if (isVisible(el) && el.innerText.trim().length > 0 && el.innerText.trim().length < 30) {
                    interactables.push({
                        text: el.innerText.trim(),
                        selector: el.id ? `#${el.id}` : (el.className ? `.${el.className.split(' ').join('.')}` : el.tagName.toLowerCase()),
                        x: el.getBoundingClientRect().x,
                        y: el.getBoundingClientRect().y,
                        type: el.tagName.toLowerCase()
                    });
                }
            });

            return {
                url: window.location.href,
                title: document.title,
                text: mainContent.substring(0, 5000), // Cap for memory
                wordCount: mainContent.split(/\s+/).length,
                metadata: {
                    platform: 'generic',
                    type: 'webpage'
                },
                links: Array.from(document.querySelectorAll('a')).map(a => a.href).slice(0, 10),
                interactables: interactables.slice(0, 10) // Top 10 buttons
            };
        });
    }
}

module.exports = GenericExtractor;
