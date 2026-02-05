const logger = require('../Logger');

class FacebookExtractor {
    static async extract(page) {
        // Wait for content to load
        try {
            // Wait for generic container or specific reel container
            await page.waitForSelector('[role="main"], [role="article"], video', { timeout: 8000 });
        } catch (e) {
            logger.warn('Facebook specific content container not found, proceeding with general extraction');
        }

        return await page.evaluate(() => {
            const url = window.location.href;

            const getMetaContent = (property) => {
                const meta = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
                return meta?.content || '';
            };

            // 1. Metadata from Open Graph
            const title = getMetaContent('og:title') || document.title;
            const description = getMetaContent('og:description') ||
                document.querySelector('meta[name="description"]')?.content || '';
            const imageUrl = getMetaContent('og:image');
            const videoUrl = getMetaContent('og:video');
            const type = getMetaContent('og:type') || 'website';

            // 2. Content Extraction via Heuristics
            // Facebook classes are obfuscated, so we rely on ARIA roles and generic structures

            // Try to find the main post text
            let postText = '';
            // Common text containers
            const textElements = document.querySelectorAll('div[data-ad-preview="message"], div[dir="auto"]');

            // Filter and join meaningful text
            const meaningfulText = Array.from(textElements)
                .map(el => el.innerText.trim())
                .filter(text => text.length > 5 && !text.includes('Comment') && !text.includes('Share'));

            if (meaningfulText.length > 0) {
                // Heuristic: The longest distinct text block often contains the post body
                postText = meaningfulText.sort((a, b) => b.length - a.length)[0];
            } else {
                postText = description;
            }

            // 3. Stats (Likes, Comments, Shares) - parsing from ARIA labels or Description
            // Description often contains: "1.2K views, 50 likes..."
            // Or look for specific buttons
            const stats = {
                likes: '',
                comments: '',
                shares: ''
            };

            // Attempt to parse stats from description if available
            // Example: "Jane Doe on Facebook. 50K Likes. 200 Comments."
            if (description) {
                const likeMatch = description.match(/(\d+[K,M,B]?|\d+)\s+Likes?/i);
                if (likeMatch) stats.likes = likeMatch[1];

                const commentMatch = description.match(/(\d+[K,M,B]?|\d+)\s+Comments?/i);
                if (commentMatch) stats.comments = commentMatch[1];

                const shareMatch = description.match(/(\d+[K,M,B]?|\d+)\s+Shares?/i);
                if (shareMatch) stats.shares = shareMatch[1];
            }

            // 4. Author Extraction
            let author = '';
            const authorEl = document.querySelector('h3 strong a, h3 a, h2 strong a, h2 a, [role="article"] h3 span');
            if (authorEl) {
                author = authorEl.innerText.trim();
            } else {
                // Fallback to extraction from title
                // Format: "Title | specific | Facebook" or "Author Name - Post..."
                const titleParts = title.split(/[|\-–]/);
                if (titleParts.length > 1) {
                    author = titleParts[0].trim();
                }
            }

            // Determine content type
            let contentType = 'post';
            if (url.includes('/reel/')) contentType = 'reel';
            else if (url.includes('/video/') || url.includes('/watch/')) contentType = 'video';
            else if (url.includes('/profile.php') || (!url.includes('/posts/') && !url.includes('/media/'))) contentType = 'profile';

            // Profile specific extraction
            if (contentType === 'profile') {
                // Meta description often has: "Page · Software. 4.6K likes · 4.8K followers."
                // Or: "John Doe. 500 likes."

                // Parse stats from description for profiles
                const followerMatch = description.match(/(\d+[K,M,B]?|\d+)\s+followers?/i);
                if (followerMatch) stats.followers = followerMatch[1];

                const likeMatch = description.match(/(\d+[K,M,B]?|\d+)\s+likes?/i);
                if (likeMatch) stats.likes = likeMatch[1];

                // Try to extract Category/Bio
                // Heuristic: Often the text immediately following the name in title or description
                const bio = description.split(/\.\s+/)[1] || ''; // Crude heuristic

                return {
                    url,
                    title: title.replace(' | Facebook', ''),
                    text: `Profile: ${title}\n\nBio/Info: ${bio}\n\nStats:\nFollowers: ${stats.followers}\nLikes: ${stats.likes}`,
                    wordCount: bio.split(/\s+/).length,
                    metadata: {
                        platform: 'facebook',
                        type: 'profile',
                        name: title.replace(' | Facebook', ''),
                        bio: bio,
                        stats: {
                            followers: stats.followers,
                            likes: stats.likes
                        },
                        imageUrl
                    },
                    links: [imageUrl].filter(Boolean)
                };
            }

            return {
                url,
                title: title.replace(' | Facebook', ''),
                text: `${postText}\n\nAuthor: ${author}\nType: ${contentType}\n\nStats:\nLikes: ${stats.likes}\nComments: ${stats.comments}\nShares: ${stats.shares}`,
                wordCount: postText.split(/\s+/).length,
                metadata: {
                    platform: 'facebook',
                    type: contentType,
                    author,
                    caption: postText.substring(0, 500),
                    stats,
                    imageUrl,
                    videoUrl
                },
                links: [videoUrl, imageUrl].filter(Boolean)
            };
        });
    }
}

module.exports = FacebookExtractor;
