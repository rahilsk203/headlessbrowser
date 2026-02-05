const logger = require('../Logger');

class GitHubExtractor {
    static async extract(page) {
        // Wait for key elements (Layout-agnostic)
        try {
            await page.waitForSelector('.application-main', { timeout: 5000 });
        } catch (e) {
            logger.warn('GitHub main container not found');
        }

        return await page.evaluate(() => {
            const url = window.location.href;
            const pathParts = new URL(url).pathname.split('/').filter(Boolean);

            // Standardizing Helper Functions
            const getText = (selector) => document.querySelector(selector)?.innerText?.trim() || '';
            const getCount = (selector) => {
                const text = getText(selector);
                return text.replace(/[^0-9.kKmMbB]/g, ''); // Clean number
            };
            const cleanText = (text) => text?.replace(/\s+/g, ' ').trim() || '';

            // 0. SEARCH / TOPICS VIEW
            // URL format: /search?q=... or /topics/...
            if (url.includes('/search') || url.includes('/topics/')) {
                const results = [];
                // GitHub Search Results selectors
                // Container: .repo-list-item or [data-testid="results-list"] > div
                const repoElements = document.querySelectorAll('[data-testid="results-list"] > div, .repo-list-item');

                repoElements.forEach((el, index) => {
                    if (index >= 10) return;

                    const titleEl = el.querySelector('a[href^="/"]');
                    const descEl = el.querySelector('span[class*="Text"], p');
                    const stats = el.querySelectorAll('ul li, [class*="Text"]'); // Generic stat grabber

                    if (titleEl) {
                        const repoName = titleEl.innerText || titleEl.getAttribute('href').substring(1);
                        results.push({
                            name: repoName,
                            url: titleEl.href,
                            description: descEl?.innerText?.trim() || '',
                            // Using text based heuristic for stats as classes are dynamic
                            tags: Array.from(stats).map(s => s.innerText.trim()).filter(t => t.length > 0 && t.length < 20).slice(0, 3)
                        });
                    }
                });

                const query = new URLSearchParams(window.location.search).get('q') || url.split('/').pop();

                return {
                    url,
                    title: `GitHub Search: ${query}`,
                    text: `Search Results for "${query}"\n\n` +
                        results.map(r => `• ${r.name}\n  ${r.description}\n  ${r.url}`).join('\n\n'),
                    wordCount: results.length * 10,
                    metadata: {
                        platform: 'github',
                        type: 'search',
                        query,
                        results
                    },
                    links: results.map(r => r.url)
                };
            }

            // 1. FILE/CODE VIEW
            // URL format: /user/repo/blob/...
            if (pathParts[2] === 'blob') {
                const codeLines = document.querySelectorAll('.blob-code-inner');
                let rawCode = '';
                if (codeLines.length > 0) {
                    rawCode = Array.from(codeLines).map(el => el.innerText).join('\n');
                } else {
                    // Fallback for raw view or different layout
                    rawCode = document.querySelector('textarea[aria-label="file content"]')?.value || getText('table');
                }

                const lines = rawCode.split('\n').length;
                const size = getText('[data-testid="blob-size"]');

                return {
                    url,
                    title: document.title,
                    text: rawCode.substring(0, 10000), // Cap for JSON size
                    wordCount: lines,
                    metadata: {
                        platform: 'github',
                        type: 'code',
                        language: getText('[data-testid="blob-language"]'),
                        lines: lines,
                        size: size
                    },
                    links: []
                };
            }

            // 2. REPOSITORY VIEW
            // URL format: /user/repo (length 2)
            if (pathParts.length === 2) {
                const repoName = pathParts[1];
                const author = pathParts[0];

                // Stats (Stars, Forks, Watching) - Selectors change, using heuristics
                // Usually in the sidebar or header
                // 2024 GitHub layout: Sidebar contains "Stars", "Forks"

                // Stars
                const starEl = document.querySelector('#repo-stars-counter-star') ||
                    document.querySelector('a[href$="/stargazers"] span');
                const stars = starEl?.innerText?.trim() || '0';

                // Forks
                const forkEl = document.querySelector('#repo-network-counter') ||
                    document.querySelector('a[href$="/network/members"] span');
                const forks = forkEl?.innerText?.trim() || '0';

                // Issues
                const issuesTab = document.querySelector('#issues-tab span');
                const issues = issuesTab?.innerText?.trim() || '0';

                // Description
                const description = getText('p.f4') || getText('div.f4') || '';

                // Readme (First chunk)
                const readme = getText('article.markdown-body') || '';

                // Languages
                const languages = [];
                const langElements = document.querySelectorAll('.Progress + ul li, a[data-ga-click*="Repository, language_stats"]');
                langElements.forEach(el => {
                    languages.push(cleanText(el.innerText));
                });

                return {
                    url,
                    title: document.title,
                    text: `Repository: ${author}/${repoName}\n\nDescription: ${description}\n\nREADME Preview:\n${readme.substring(0, 1000)}...`,
                    wordCount: readme.split(/\s+/).length,
                    metadata: {
                        platform: 'github',
                        type: 'repository',
                        name: repoName,
                        owner: author,
                        description,
                        stats: {
                            stars,
                            forks,
                            issues,
                            languages
                        }
                    },
                    links: Array.from(document.querySelectorAll('a[href^="http"]')).map(a => a.href).slice(0, 10)
                };
            }

            // 3. PROFILE VIEW
            // URL format: /user (length 1)
            if (pathParts.length === 1) {
                const username = pathParts[0];
                const name = getText('span.p-name') || username;
                const bio = getText('div.p-note');

                const followers = getText('a[href$="?tab=followers"] span');
                const following = getText('a[href$="?tab=following"] span');

                // Contribution Graph
                const contribText = getText('.js-yearly-contributions h2') || '';
                const contributions = contribText.match(/([0-9,]+)/)?.[1] || '0';

                // Pinned Repos
                const pinned = [];
                document.querySelectorAll('.pinned-item-list-item').forEach(el => {
                    pinned.push({
                        name: el.querySelector('span.repo')?.innerText,
                        desc: el.querySelector('.pinned-item-desc')?.innerText?.trim(),
                        stars: el.querySelector('a[href$="/stargazers"]')?.innerText?.trim()
                    });
                });

                return {
                    url,
                    title: `${name} (${username}) - GitHub`,
                    text: `User: ${name}\nBio: ${bio}\nContributions: ${contributions}\n\nPinned Repos:\n${JSON.stringify(pinned, null, 2)}`,
                    wordCount: bio.split(/\s+/).length,
                    metadata: {
                        platform: 'github',
                        type: 'profile',
                        username,
                        name,
                        bio,
                        stats: {
                            followers,
                            following,
                            contributions
                        },
                        pinnedRepos: pinned
                    },
                    links: pinned.map(p => `https://github.com/${username}/${p.name}`)
                };
            }

            // Fallback for other pages (Issues list, Actions, etc.)
            return {
                url,
                title: document.title,
                text: document.body.innerText.substring(0, 2000),
                wordCount: 0,
                metadata: {
                    platform: 'github',
                    type: 'generic'
                },
                links: []
            };
        });
    }
}

module.exports = GitHubExtractor;
