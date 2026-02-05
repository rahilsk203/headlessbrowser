const logger = require('../Logger');

class InstagramExtractor {
    static async extract(page) {
        return await page.evaluate(() => {
            const url = window.location.href;

            const getMetaContent = (property) => {
                const meta = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
                return meta?.content || '';
            };

            const title = getMetaContent('og:title') || document.title;
            const description = getMetaContent('og:description') ||
                document.querySelector('meta[name="description"]')?.content || '';
            const imageUrl = getMetaContent('og:image');
            const videoUrl = getMetaContent('og:video');

            // Try to extract from page content
            const caption = document.querySelector('h1')?.innerText?.trim() ||
                document.querySelector('[class*="Caption"]')?.innerText?.trim() ||
                description;

            const author = document.querySelector('a[class*="Author"], a[href*="/"]')?.innerText?.trim() ||
                title.split('•')[0]?.trim() || '';

            const likes = document.querySelector('[aria-label*="like"]')?.innerText?.trim() || '';
            const comments = document.querySelector('[aria-label*="comment"]')?.innerText?.trim() || '';

            const type = url.includes('/reel/') ? 'reel' : url.includes('/p/') ? 'post' : 'profile';

            if (type === 'profile') {
                // Meta description format: "10K Followers, 200 Following, 500 Posts - See Instagram photos..."
                const stats = {
                    followers: '',
                    following: '',
                    posts: ''
                };

                const followerMatch = description.match(/([0-9.,K,M,B]+)\s+Followers?/i);
                if (followerMatch) stats.followers = followerMatch[1];

                const followingMatch = description.match(/([0-9.,K,M,B]+)\s+Following?/i);
                if (followingMatch) stats.following = followingMatch[1];

                const postsMatch = description.match(/([0-9.,K,M,B]+)\s+Posts?/i);
                if (postsMatch) stats.posts = postsMatch[1];

                return {
                    url,
                    title: title.replace(' • Instagram photos and videos', ''),
                    text: `Profile: ${title}\n\nBio: ${description}\n\nStats:\nFollowers: ${stats.followers}\nFollowing: ${stats.following}\nPosts: ${stats.posts}`,
                    wordCount: description.split(/\s+/).length,
                    metadata: {
                        platform: 'instagram',
                        type: 'profile',
                        name: title.split('(@')[0].trim(),
                        handle: title.match(/\(@([^)]+)\)/)?.[1] || '',
                        bio: description,
                        stats,
                        imageUrl
                    },
                    links: [imageUrl].filter(Boolean)
                };
            }

            return {
                url,
                title: title.replace(' • Instagram', ''),
                text: `${caption}\n\nAuthor: ${author}\nLikes: ${likes}\nComments: ${comments}`,
                wordCount: caption.split(/\s+/).length,
                metadata: {
                    platform: 'instagram',
                    type: type,
                    author,
                    caption: caption.substring(0, 500),
                    likes,
                    comments,
                    imageUrl,
                    videoUrl
                },
                links: [videoUrl, imageUrl].filter(Boolean)
            };
        });
    }
}

module.exports = InstagramExtractor;
