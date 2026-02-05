const logger = require('../Logger');

class AccuWeatherExtractor {
    static async extract(page) {
        return await page.evaluate(() => {
            const url = window.location.href;
            const title = document.title;

            // AccuWeather Current Conditions (New Selectors)
            const curCondBody = document.querySelector('.cur-con-weather-card__body');
            let current = {};

            if (curCondBody) {
                const tempEl = curCondBody.querySelector('.temp');
                const condEl = curCondBody.querySelector('.phrase');
                const realFeelEl = curCondBody.querySelector('.real-feel');

                current = {
                    temp: tempEl ? tempEl.innerText.trim() : '',
                    condition: condEl ? condEl.innerText.trim() : '',
                    realFeel: realFeelEl ? realFeelEl.innerText.replace('RealFeel®', '').trim() : ''
                };
            }

            // Specs / Details (New Selectors)
            const detailsPanel = document.querySelector('.cur-con-weather-card__panel.details-container');
            let details = {};
            if (detailsPanel) {
                const detailItems = detailsPanel.querySelectorAll('.detail');
                detailItems.forEach(item => {
                    const label = item.querySelector('.label');
                    const value = item.querySelector('.value') || item.innerText.split('\n')[1];
                    // value might be direct text after label in some structures
                    if (label) {
                        const labelText = label.innerText.trim();
                        let valText = value ? (typeof value === 'string' ? value : value.innerText.trim()) : '';
                        if (!valText && item.innerText.includes('\n')) {
                            valText = item.innerText.split('\n')[1].trim();
                        }
                        details[labelText] = valText;
                    }
                });
            }

            // Air Quality Heuristic
            const aqEl = Array.from(document.querySelectorAll('.body-item, .air-quality-content'))
                .find(el => el.innerText.toLowerCase().includes('air quality'));
            let airQuality = aqEl ? aqEl.innerText.trim() : '';

            const textContent = `Current Weather:\nTemp: ${current.temp}\nCondition: ${current.condition}\nRealFeel: ${current.realFeel}\n\nDetails:\n${Object.entries(details).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nAir Quality: ${airQuality}`;

            return {
                url,
                title,
                text: `AccuWeather Forecast:\n\n${textContent}`,
                wordCount: textContent.split(/\s+/).length,
                metadata: {
                    platform: 'accuweather',
                    type: 'weather',
                    current,
                    details,
                    airQuality
                },
                links: Array.from(document.querySelectorAll('.card-header a')).map(a => a.href).slice(0, 5)
            };
        });
    }
}

module.exports = AccuWeatherExtractor;
