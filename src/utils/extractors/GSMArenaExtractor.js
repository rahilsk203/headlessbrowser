const logger = require('../Logger');

class GSMArenaExtractor {
    static async extract(page) {
        return await page.evaluate(() => {
            const url = window.location.href;
            const title = document.title;

            // Check if this is a makers list (search results or brand list)
            const makerList = document.querySelector('.makers');
            if (makerList) {
                const results = Array.from(makerList.querySelectorAll('li')).map(li => {
                    const link = li.querySelector('a');
                    const img = li.querySelector('img');
                    const span = li.querySelector('span');

                    return {
                        name: span ? span.innerText.trim() : (link ? link.innerText.trim() : 'Unknown'),
                        url: link ? link.href : '',
                        image: img ? img.src : ''
                    };
                });

                const textContent = results.map(r => `- ${r.name}: ${r.url}`).join('\n');

                return {
                    url,
                    title,
                    text: `GSMArena Search Results:\n\n${textContent}`,
                    wordCount: textContent.split(/\s+/).length,
                    metadata: {
                        platform: 'gsmarena',
                        type: 'search_results',
                        results: results
                    },
                    links: results.map(r => r.url).slice(0, 5)
                };
            }

            // Otherwise, treat as specifications page
            const tables = document.querySelectorAll('table');
            let specs = [];

            tables.forEach(table => {
                const rows = table.querySelectorAll('tr');
                let currentCategory = '';

                rows.forEach(row => {
                    const th = row.querySelector('th');
                    if (th) {
                        currentCategory = th.innerText.trim();
                    }

                    const ttl = row.querySelector('.ttl');
                    const nfo = row.querySelector('.nfo');

                    if (ttl && nfo) {
                        specs.push({
                            category: currentCategory,
                            name: ttl.innerText.trim(),
                            value: nfo.innerText.trim()
                        });
                    }
                });
            });

            const textContent = specs.map(s => `[${s.category}] ${s.name}: ${s.value}`).join('\n');

            return {
                url,
                title,
                text: `GSMArena Specifications:\n\n${textContent}`,
                wordCount: textContent.split(/\s+/).length,
                metadata: {
                    platform: 'gsmarena',
                    type: 'specifications',
                    specs: specs
                },
                links: Array.from(document.querySelectorAll('a')).map(a => a.href).slice(0, 5)
            };
        });
    }
}

module.exports = GSMArenaExtractor;
