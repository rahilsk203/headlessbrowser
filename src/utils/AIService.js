const ZChat = require('../../ZChat');
const Scraper = require('./Scraper');
const logger = require('./Logger');
const { getInstance: getCacheManager } = require('./CacheManager');
const { getInstance: getSearchStrategy } = require('./SearchStrategyManager');
const { getInstance: getResultScorer } = require('./ResultScorer');
const { getInstance: getToolDiscovery } = require('./ToolDiscovery');

class AIService {
    constructor() {
        this.ai = new ZChat();
        this.initialized = false;
        this.cache = getCacheManager();
        this.searchStrategy = getSearchStrategy();
        this.resultScorer = getResultScorer();
        this.toolDiscovery = getToolDiscovery();
    }

    async init() {
        if (!this.initialized) {
            await this.ai.initialize();
            this.initialized = true;
        }
    }

    /**
     * Main entry point for AI-driven automation
     * @param {string} query User natural language query
     * @param {object} options Browser options (system, headless, etc.)
     */
    async processDirectUrl(url, query, options, cacheKey) {
        // Direct navigation bypasses search planning
        logger.info(`Approaching direct target: ${url}`);

        let rawData = await Scraper.scrapeStore({
            ...options,
            url: url,
            extract: true
        });

        if (!rawData) return { error: "Direct navigation scrape failed." };

        // Handle Location List (e.g. AccuWeather) OR Search Results (e.g. GSMArena)
        const results = rawData.results || rawData.metadata?.results;

        if (rawData.metadata && (rawData.metadata.type === 'location_list' || rawData.metadata.type === 'search_results') && results && results.length > 0) {
            logger.info("Direct navigation landed on a list. Automatically selecting the first result...");
            const target = results[0]; // Pick first result (usually most relevant)

            logger.info(`Navigating to primary result: ${target.title} (${target.url})`);

            const deepData = await Scraper.scrapeStore({
                ...options,
                url: target.url,
                extract: true
            });

            if (deepData) {
                rawData = {
                    ...deepData,
                    originalSearch: rawData
                };
            }
        }

        // Even with direct navigation, check if we need to go deeper (e.g. if we landed on a search or list page)
        // But usually direct navigation implies we are at the source.

        this.ai.useThinking = true;
        const filterPrompt = `
User wanted: "${query}"
We directly visited: ${url}
${rawData.originalSearch ? `(Followed link: ${rawData.url})` : ''}

--- RAW DATA ---
${JSON.stringify(rawData, null, 2).substring(0, 15000)} 
--- END RAW DATA ---

Filter this data and provide a comprehensive, professional response. 
Use markdown tables or lists for readability.
If the data is insufficient, state what is missing.
`;

        logger.info("AI Generating final response...");
        const finalResponse = await this.ai.chat(filterPrompt, true);

        const result = {
            response: finalResponse,
            plan: { url, action: "direct_navigation" },
            rawData: rawData
        };

        // Cache the result
        this.cache.set(cacheKey, result);

        return result;
    }

    async process(query, options = {}) {
        await this.init();

        logger.info(`AI Processing Query: "${query}"`);

        // Check cache first
        const cacheKey = `query:${query}`;
        const cachedResult = this.cache.get(cacheKey);
        if (cachedResult) {
            logger.info('✓ Returning cached result');
            return cachedResult;
        }

        // REMOVED: directNav fast-path (AI now handles this in planPrompt)

        // Phase 1: Determine Initial Action Plan
        // Express Planning: Use thinking only for complex queries to save latency
        const complexTerms = ['specs', 'compare', 'research', 'latest', 'detailed', 'report', 'analyze', 'why', 'how'];
        const isComplex = complexTerms.some(term => query.toLowerCase().includes(term)) || query.length > 50;

        this.ai.useThinking = isComplex;
        logger.info(`Planning Mode: ${isComplex ? 'Elite (Thinking)' : 'Express'}`);

        // Use default search strategy fallback
        const defaultSearchUrl = this.searchStrategy.getSearchUrl(query);

        const supportedSites = this.toolDiscovery.getSupportedSites();
        const planPrompt = `User Query: "${query.trim()}"
Decide if you need to SEARCH the web or if you can ANSWER directly.

INTERNAL CAPABILITIES:
I have specialized extraction tools for these sites: [${supportedSites.join(', ')}].
If the query matches any of these, prioritize a DIRECT URL or specialized search for that site.

SPECIALIZED SEARCH FORMATS:
- GSMArena: https://www.gsmarena.com/res.php3?sSearch=[clean_term]
- AccuWeather: https://www.accuweather.com/en/search-locations?query=[clean_term]
- YouTube: https://www.youtube.com/results?search_query=[clean_term]
- GitHub: https://github.com/search?q=[clean_term]
- Tech News: Use specialized sites if mentioned, else default search.

Default Search Engine Fallback: ${defaultSearchUrl}

Rules:
1. If the user asks for "weather", "latest news", "specs", "docs", "repo", or specific real-time info -> MUST SEARCH (set action="search").
2. Prefer a specialized tool URL from the formats above if it matches the user's domain.
3. Clean the [clean_term] yourself - remove fillers like "latest", "find", "search for".
4. If you aren't sure, use the Default Search Engine Fallback.
5. If the user asks "hi", "help", "write code", "explain concept" (general knowledge) -> ANSWER DIRECTLY (set action="answer").

Return JSON:
{
  "action": "search" | "answer",
  "url": "destination url (required if action=search)",
  "answer": "your direct response (required if action=answer)",
  "reasoning": "why did you choose this tool/URL?"
}`.trim();

        const planResp = await this.ai.chat(planPrompt, true); // Use useThinking=true for better plan.
        logger.info(`AI Planning Response [Thinking Mode]: ${planResp.substring(0, 500)}...`);
        let plan = this.parseJson(planResp);

        if (plan && plan.action === 'answer' && plan.answer) {
            logger.info("✓ Query answered directly (No browser needed).");
            const result = {
                response: plan.answer,
                metadata: { source: "llm_knowledge" }
            };
            // Cache result
            this.cache.set(cacheKey, result);
            return result;
        }

        if (!plan || !plan.url) {
            logger.warn("AI failed to generate a valid plan or URL. Using default search fallback.");
            plan = { action: 'search', url: defaultSearchUrl, reasoning: "Fallback to search due to planning failure." };
        }

        // If the AI chose a specialized tool search, ensure we use their search results if available
        // This is where we could add logic to call processDirectUrl if needed, but for now
        // we follow the plan as a standard search/visit.
        if (plan.action === 'search' && !plan.actions) plan.actions = [];

        logger.info(`Agent Target: ${plan.url}`);
        logger.info(`Agent Reasoning: ${plan.reasoning ? plan.reasoning.substring(0, 100) + "..." : "Proceeding"}`);

        // Phase 2: Execute Initial Search/Visit
        let rawData = await Scraper.scrapeStore({
            ...options,
            url: plan.url,
            interactions: plan.actions,
            extract: true
        });

        if (!rawData) return { error: "Initial scrape failed." };

        // Interaction Loop (Max 3 attempts to get better data)
        let loopCount = 0;
        const MAX_LOOPS = 3;

        while (loopCount < MAX_LOOPS) {
            loopCount++;

            // Score results if it's a search page
            let needsDeepDive = false;
            let qualityAssessment = { recommendation: 'answer' };

            if (plan.url.includes('search') || (rawData.links && rawData.links.length > 5) || rawData.interactables?.length > 0) {
                // Score the search results or check interactables
                if (rawData.results) {
                    rawData.results = this.resultScorer.scoreResults(rawData.results, query);
                    qualityAssessment = this.resultScorer.assessQuality(rawData.results);

                    if (qualityAssessment.recommendation === 'deep_dive' || qualityAssessment.recommendation === 'retry') {
                        needsDeepDive = true;
                    }
                } else {
                    // check if we have interactables but low text content
                    if (rawData.wordCount < 100 && rawData.interactables?.length > 0) {
                        needsDeepDive = true; // Likely a landing page needing interaction
                        qualityAssessment.recommendation = 'interact';
                    } else if (!rawData.results) {
                        needsDeepDive = true; // No structured results found
                    }
                }
            }

            // Agent Logic: Decide if we need to go deeper
            if (needsDeepDive) {
                logger.info(`Agent Evaluation (Loop ${loopCount}/${MAX_LOOPS}): Determining next step...`);
                this.ai.useThinking = true;

                // Prepare interactables context
                let interactablesContext = "";
                if (rawData.interactables && rawData.interactables.length > 0) {
                    interactablesContext = `
INTERACTABLE ELEMENTS (Buttons/Inputs):
${rawData.interactables.map((el, i) => `${i + 1}. [${el.type}] "${el.text}" (Selector: ${el.selector})`).join('\n')}
`;
                }

                const decisionPrompt = `
User Query: "${query}"
Review the Current Page Content below. 
Do we have enough information to provide a COMPREHENSIVE and HIGH-ACCURACY answer?

CRITICAL ACCURACY CHECK:
1. Is the data TRUNCATED? (Look for "...", "Read More", or cut-off sentences).
2. Are specific technical metrics missing? (e.g., likes, comments).
3. Is this just a landing page or search result?

SEARCH QUALITY: ${qualityAssessment.recommendation}
${rawData.isBlocked ? 'WARNING: Web searching is currently BLOCKED by a CAPTCHA. If the user provided a direct URL in their query, use "deep_dive" to visit it immediately.' : ''}
${interactablesContext}

TOP RESULTS:
${(rawData.results || []).slice(0, 5).map(r => `- "${r.title}" (${r.score}/100) -> ${r.url}`).join('\n')}

RAW CONTENT SNIPPET:
${rawData.text ? rawData.text.substring(0, 800) : "No text content"}

DECISION RULES:
1. "action": "answer" - ONLY if data is perfect and complete. NO TRUNCATION ALLOWED.
2. "action": "click" - If content is cut off and an expander exists. 
   - REQUIREMENT: Use a valid CSS SELECTOR (e.g., "#expand", "button.more"). DO NOT USE PLAIN TEXT.
3. "action": "hover" - If data is hidden behind a mouse-over effect or tooltip.
4. "action": "scroll_to" - If the target data is likely at the bottom of the page or in a specific section that triggers lazy-loading ("running data").
5. "action": "deep_dive" - Navigate to a NEW URL. 
   - ANTI-LOOP RULE: Do NOT "deep_dive" to the current URL (${rawData.url}) unless you just clicked something and you need to reload a specific sub-state.

COMMON SITE HINTS:
- YouTube: "#expand", "tp-yt-paper-button#more", "#expand-user-content"
- GSMArena: "a.link-network-detail", "scroll_to" for full table
- GitHub: "a.v-align-middle", "hover" on commit messages
- Universal Expanders: "button:has-text('More')", "a[aria-label*='read']", ".show-more"

Return JSON:
{
  "action": "answer" | "deep_dive" | "click" | "hover" | "scroll_to",
  "reasoning": "What exactly is missing and why is this specific 'touch' (interaction) needed for running data?",
  "target_url": "url if deep_dive",
  "selector": "CSS selector if click/hover/scroll_to"
}`;

                const decision = await this.ai.chat(decisionPrompt, true);

                try {
                    const plan = this.parseJson(decision);
                    if (!plan) throw new Error("Could not extract JSON from decision");

                    logger.info(`Agent Decision: ${plan.action} ${plan.target_url || plan.selector || ''}`);

                    if (plan.action === 'answer') {
                        logger.info("Agent decided data is sufficient. Generating answer.");
                        break; // Exit loop
                    }

                    if (plan.action === 'deep_dive' && plan.target_url) {
                        logger.info(`Navigating to ${plan.target_url} for deep details...`);
                        const deepData = await Scraper.scrapeStore({ ...options, url: plan.target_url, extract: true });
                        if (deepData) {
                            rawData = {
                                ...deepData,
                                originalSearch: rawData
                            };
                        }
                    } else if (['click', 'hover', 'scroll_to'].includes(plan.action) && plan.selector) {
                        logger.info(`Interacting (${plan.action}) with element: ${plan.selector}...`);
                        // Perform interaction on the CURRENT url
                        const deepData = await Scraper.scrapeStore({
                            ...options,
                            url: rawData.url,
                            extract: true,
                            interactions: [
                                { type: plan.action, selector: plan.selector },
                                { type: 'wait', value: 5000 } // Wait for UI update
                            ]
                        });
                        if (deepData) {
                            rawData = {
                                ...deepData,
                                originalSearch: rawData
                            };
                        }
                    }
                } catch (e) {
                    logger.error(`Failed to parse agent decision: ${e.message}`);
                    break;
                }
            } else {
                break; // No deep dive needed
            }
        }

        // Phase 3: Final Filter and Format
        this.ai.useThinking = true;
        const filterPrompt = `
User wanted: "${query}"
We have extracted data from: ${rawData.url}
${rawData.originalSearch ? `(Previously searched: ${rawData.originalSearch.url})` : ''}

--- RAW DATA ---
${JSON.stringify(rawData, null, 2).substring(0, 15000)} 
--- END RAW DATA ---

Filter this data and provide a comprehensive, professional response. 
Use markdown tables or lists for readability.
`;

        logger.info("AI Generating final response...");
        const finalResponse = await this.ai.chat(filterPrompt, true);

        const result = {
            response: finalResponse || "I was able to retrieve the data but encountered an issue generating a summary. You can check the raw extraction in the logs.",
            plan: plan,
            rawData: rawData
        };

        // Cache the result
        this.cache.set(cacheKey, result);

        return result;
    }

    parseJson(str) {
        if (!str) return null;
        try {
            // Try direct parse first
            return JSON.parse(str);
        } catch (e) {
            // Try to find the last occurrence of a JSON-like block
            // Often when thinking is enabled, the model puts the JSON at the end
            try {
                const matches = str.match(/\{[\s\S]*\}/g);
                if (matches) {
                    // Try matches from last to first
                    for (let i = matches.length - 1; i >= 0; i--) {
                        try {
                            const candidate = matches[i];
                            return JSON.parse(candidate);
                        } catch (err) { continue; }
                    }
                }
            } catch (err) {
                return null;
            }
        }
        return null;
    }
}

module.exports = new AIService();
