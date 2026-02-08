const logger = require('../Logger');

class YouTubeExtractor {
    static async extract(page) {
        const url = page.url();

        // Handle Search Results
        if (url.includes('youtube.com/results')) {
            // Wait for results to load
            try {
                await page.waitForSelector('ytd-video-renderer, ytd-grid-video-renderer', { timeout: 10000 });
                logger.info('YouTube search results loaded');
            } catch (e) {
                logger.warn('YouTube search results did not load in time');
            }

            return await page.evaluate(() => {
                const url = window.location.href;
                const videos = [];
                const videoElements = document.querySelectorAll('ytd-video-renderer, ytd-grid-video-renderer');

                videoElements.forEach((video, index) => {
                    if (index >= 10) return; // Limit to top 10 results

                    const titleEl = video.querySelector('#video-title');
                    const channelEl = video.querySelector('#channel-name a, ytd-channel-name a');
                    const viewsEl = video.querySelector('#metadata-line span:first-child');
                    const durationEl = video.querySelector('ytd-thumbnail-overlay-time-status-renderer span');

                    if (titleEl) {
                        videos.push({
                            title: titleEl.innerText?.trim() || titleEl.getAttribute('title') || '',
                            url: titleEl.href || '',
                            channel: channelEl?.innerText?.trim() || '',
                            views: viewsEl?.innerText?.trim() || '',
                            duration: durationEl?.innerText?.trim() || '',
                            thumbnail: video.querySelector('img')?.src || ''
                        });
                    }
                });

                const searchQuery = new URLSearchParams(window.location.search).get('search_query') || '';

                return {
                    url,
                    title: `YouTube Search: ${searchQuery}`,
                    text: `Search Results for: ${searchQuery}\n\nFound ${videos.length} videos:\n\n` +
                        videos.map((v, i) => `${i + 1}. ${v.title}\n   Channel: ${v.channel}\n   Views: ${v.views}\n   URL: ${v.url}`).join('\n\n'),
                    wordCount: videos.reduce((sum, v) => sum + v.title.split(/\s+/).length, 0),
                    searchQuery,
                    results: videos,
                    metadata: {
                        platform: 'youtube',
                        type: 'search',
                        totalResults: videos.length,
                        query: searchQuery
                    },
                    links: videos.map(v => v.url)
                };
            });
        }

        // Handle Watch Page
        if (url.includes('youtube.com/watch')) {
            return await page.evaluate(() => {
                const url = window.location.href;
                // Primary Strategy: Extract from ytInitialData (The most robust way)
                const getInitialData = () => {
                    try {
                        const scripts = Array.from(document.querySelectorAll('script'));
                        const dataScript = scripts.find(s => s.textContent.includes('var ytInitialData =') || s.textContent.includes('window["ytInitialData"] ='));
                        if (dataScript) {
                            const jsonStr = dataScript.textContent.split(/var ytInitialData = |window\["ytInitialData"\] = /)[1].split(';')[0];
                            return JSON.parse(jsonStr);
                        }
                    } catch (e) { return null; }
                };

                const ytData = getInitialData();

                if (ytData && ytData.contents) {
                    try {
                        const videoPrimary = ytData.contents.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.videoPrimaryInfoRenderer;
                        const videoSecondary = ytData.contents.twoColumnWatchNextResults?.results?.results?.contents?.[1]?.videoSecondaryInfoRenderer;

                        if (videoPrimary || videoSecondary) {
                            const title = videoPrimary?.title?.runs?.map(r => r.text).join('') || document.title;
                            const description = videoSecondary?.attributedDescription?.content ||
                                videoSecondary?.description?.runs?.map(r => r.text).join('') || '';
                            const channel = videoSecondary?.owner?.videoOwnerRenderer?.title?.runs?.[0]?.text || '';
                            const viewCount = videoPrimary?.viewCount?.videoViewCountRenderer?.viewCount?.simpleText || '';

                            // If we got high-quality data, return it
                            if (title && description) {
                                return {
                                    title,
                                    description,
                                    channel,
                                    metadata: {
                                        platform: 'youtube',
                                        type: 'video',
                                        views: viewCount,
                                        description: description,
                                        channel: channel
                                    }
                                };
                            }
                        }
                    } catch (e) { /* fallback to DOM */ }
                }

                // Fallback: DOM Extraction (Keep existing logic as backup)
                const getMetaContent = (name) => {
                    const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
                    return meta?.content || '';
                };

                const videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title, #title h1')?.innerText?.trim() ||
                    getMetaContent('title') ||
                    document.title.replace(' - YouTube', '');

                // Advanced Description Extraction (Handles truncated and expanded states)
                const getDescription = () => {
                    const selectors = [
                        '#description-text span',
                        'yt-attributed-string#description',
                        '#description-inline-expander yt-formatted-string',
                        '#description-text',
                        '#description'
                    ];

                    for (const selector of selectors) {
                        const els = document.querySelectorAll(selector);
                        if (els.length > 0) {
                            const text = Array.from(els).map(el => el.innerText || el.textContent).join('\n').trim();
                            if (text && !text.endsWith('...')) return text; // Found likely full text
                        }
                    }

                    // Fallback to first available or meta
                    const firstEl = document.querySelector(selectors.join(', '));
                    return firstEl?.innerText?.trim() || firstEl?.textContent?.trim() || getMetaContent('description');
                };

                const description = getDescription();

                const channel = document.querySelector('ytd-channel-name a, #channel-name a, #owner-name a, #upload-info #channel-name a')?.innerText?.trim() ||
                    getMetaContent('author');

                const views = document.querySelector('.view-count, #info-text, #metadata-line span:first-child')?.innerText?.trim() || '';

                const likeEl = document.querySelector('#segmented-like-button button, ytd-toggle-button-renderer button, button[aria-label*="like"]');
                let likes = likeEl?.getAttribute('aria-label') || likeEl?.innerText || '';

                // If it's the aria-label "like this video along with 1,234 other people", try to extract just the number
                if (likes && likes.toLowerCase().includes('like')) {
                    const match = likes.match(/[\d,.]+/);
                    if (match) likes = match[0];
                }

                const commentEl = document.querySelector('ytd-comments-header-renderer #count, ytd-item-section-renderer #count');
                let comments = commentEl?.innerText?.trim() || '';

                return {
                    url,
                    title: videoTitle,
                    text: `${videoTitle}\n\nChannel: ${channel}\n${views}\nLikes: ${likes}\nComments: ${comments}\n\nDescription:\n${description}`,
                    wordCount: description.split(/\s+/).length,
                    metadata: {
                        platform: 'youtube',
                        type: 'video',
                        channel,
                        views,
                        likes,
                        comments,
                        description: description.substring(0, 500)
                    },
                    links: Array.from(document.querySelectorAll('a')).map(a => a.href).slice(0, 10)
                };
            });
        }

        return null;
    }
}

module.exports = YouTubeExtractor;
