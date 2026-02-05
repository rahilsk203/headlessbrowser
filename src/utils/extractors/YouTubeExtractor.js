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
                const getMetaContent = (name) => {
                    const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
                    return meta?.content || '';
                };

                const videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title')?.innerText?.trim() ||
                    getMetaContent('title') ||
                    document.title.replace(' - YouTube', '');

                const description = document.querySelector('#description-inline-expander yt-formatted-string, #description')?.innerText?.trim() ||
                    getMetaContent('description');

                const channel = document.querySelector('ytd-channel-name a, #channel-name a, #owner-name a')?.innerText?.trim() ||
                    getMetaContent('author');

                const views = document.querySelector('.view-count, #info-text')?.innerText?.trim() || '';

                const likes = document.querySelector('#segmented-like-button button, ytd-toggle-button-renderer')?.getAttribute('aria-label') || '';

                return {
                    url,
                    title: videoTitle,
                    text: `${videoTitle}\n\nChannel: ${channel}\n${views}\n${likes}\n\nDescription:\n${description}`,
                    wordCount: description.split(/\s+/).length,
                    metadata: {
                        platform: 'youtube',
                        type: 'video',
                        channel,
                        views,
                        likes,
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
