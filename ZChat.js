const axios = require('axios');
const crypto = require('crypto');
const readline = require('readline');

const BASE_URL = "https://chat.z.ai";

class ZChat {
    constructor() {
        this.session = axios.create({
            baseURL: BASE_URL,
            validateStatus: (status) => status < 500, // Handle 404 gracefully for debug
            headers: {
                "Origin": BASE_URL,
                "Referer": `${BASE_URL}/`,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
            }
        });
        this.cookies = [];
        this.token = "";
        this.userId = "";
        this.chatId = crypto.randomUUID();
        this.messages = [];
        this.model = "glm-4.7";
        this.useWebSearch = false;
        this.useThinking = true;
        this.useImageGen = false;
        this.usePreviewMode = false;
        this.userName = "Guest";
        this.saltKey = "key-@@@@)))()((9))-xxxx&&&%%%%%"; // Fallback
        this.feVersion = "prod-fe-1.0.185"; // Fallback
    }

    async scrapeConfig() {
        console.log("[*] Scraping configuration from Z.AI...");
        try {
            const r = await this.session.get('/');
            if (r.status === 200) {
                const versionMatch = r.data.match(/prod-fe-\d+\.\d+\.\d+/);
                if (versionMatch) {
                    this.feVersion = versionMatch[0];
                }
            }
        } catch (e) {
            console.error(`[!] Scraping error: ${e.message}`);
        }
    }

    generateZaSignature(prompt, token, userId) {
        const timestamp = Date.now().toString();
        const requestId = crypto.randomUUID();
        const bucket = Math.floor(parseInt(timestamp) / 300000);

        // Calculate w_key
        const wKey = crypto.createHmac('sha256', this.saltKey)
            .update(bucket.toString())
            .digest('hex');

        const payloadDict = {
            timestamp,
            requestId,
            user_id: userId
        };

        // Sort keys and join
        const sortedPayload = Object.keys(payloadDict)
            .sort()
            .map(k => `${k},${payloadDict[k]}`)
            .join(',');

        const promptB64 = Buffer.from(prompt.trim()).toString('base64');
        const dataToSign = `${sortedPayload}|${promptB64}|${timestamp}`;

        const signature = crypto.createHmac('sha256', wKey)
            .update(dataToSign)
            .digest('hex');

        const browserInfo = {
            version: "0.0.1",
            platform: "web",
            token: token,
            user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
            language: "en-US",
            screen_resolution: "1920x1080",
            viewport_size: "1920x1080",
            timezone: "Europe/Paris",
            timezone_offset: "-60"
        };

        const params = { ...payloadDict, ...browserInfo };
        const urlParams = new URLSearchParams(params).toString();

        return {
            signature,
            timestamp,
            suffix: `${urlParams}&signature_timestamp=${timestamp}`
        };
    }

    async initialize() {
        await this.scrapeConfig();
        console.log("[*] Initializing Z.AI Session...");

        try {
            // First guest call to set cookies
            const r1 = await this.session.post('/api/v1/auths/guest', {});
            if (r1.headers['set-cookie']) {
                this.cookies = r1.headers['set-cookie'].map(s => s.split(';')[0]);
            }

            // Get auth info with cookies
            const r2 = await this.session.get('/api/v1/auths/', {
                headers: { "Cookie": this.cookies.join('; ') }
            });

            if (r2.status === 200) {
                this.token = r2.data.token || "";

                if (!this.token) {
                    const r3 = await this.session.post('/api/v1/auths/guest', {}, {
                        headers: { "Cookie": this.cookies.join('; ') }
                    });
                    this.token = r3.data.token || "";
                    if (r3.headers['set-cookie']) {
                        this.cookies = r3.headers['set-cookie'].map(s => s.split(';')[0]);
                    }
                }

                if (this.token) {
                    try {
                        const payloadBase64 = this.token.split('.')[1];
                        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
                        this.userId = payload.id || "";
                        this.userName = (payload.email || "Guest").split('@')[0];
                        console.log(`[+] Connected. UserID: ${this.userId.substring(0, 8)}... (Name: ${this.userName})`);
                    } catch (e) {
                        console.log("[!] Token decode failed, but connected.");
                    }
                } else {
                    console.log("[!] No token in auth response.");
                }
            } else {
                console.log(`[!] Auth Failed: ${r2.status}`);
            }
        } catch (e) {
            console.error(`[!] Initialization Error: ${e.message}`);
        }
    }

    getContextVars() {
        const now = new Date();
        return {
            "{{USER_NAME}}": this.userName,
            "{{USER_LOCATION}}": "Unknown",
            "{{CURRENT_DATETIME}}": now.toISOString().replace('T', ' ').substring(0, 19),
            "{{CURRENT_DATE}}": now.toISOString().split('T')[0],
            "{{CURRENT_TIME}}": now.toTimeString().split(' ')[0],
            "{{CURRENT_WEEKDAY}}": now.toLocaleDateString('en-US', { weekday: 'long' }),
            "{{CURRENT_TIMEZONE}}": "Europe/Paris",
            "{{USER_LANGUAGE}}": "en-US"
        };
    }

    processLine(line, stream) {
        let contentChunk = "";
        const trimmed = line.trim();
        if (!trimmed) return "";

        if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.substring(6).trim();
            if (dataStr === '[DONE]') return "[DONE]";
            try {
                const dataJson = JSON.parse(dataStr);

                // Flexible parsing for different Z.AI response formats
                contentChunk = dataJson.data?.delta_content ||
                    dataJson.data?.edit_content ||
                    dataJson.choices?.[0]?.delta?.content ||
                    "";

                if (contentChunk && stream) {
                    process.stdout.write(contentChunk);
                }
            } catch (e) {
                // Only log parse errors if the line wasn't obviously empty
                if (dataStr && dataStr !== '[DONE]') {
                    console.debug(`[debug] Failed to parse stream chunk: ${dataStr.substring(0, 50)}...`);
                }
            }
        } else if (trimmed && !trimmed.startsWith(':')) {
            // Log non-data lines that aren't keep-alive comments
            console.debug(`[debug] Received non-standard line: ${trimmed.substring(0, 50)}`);
        }
        return contentChunk;
    }

    async chat(prompt, stream = true) {
        const cleanPrompt = prompt.trim();
        this.messages.push({ role: "user", content: cleanPrompt });
        const { signature, timestamp, suffix } = this.generateZaSignature(cleanPrompt, this.token, this.userId);

        const url = `/api/v2/chat/completions?${suffix}`;
        const payload = {
            model: this.model,
            chat_id: this.chatId,
            messages: this.messages,
            signature_prompt: cleanPrompt,
            stream: true, // Always request stream for consistency
            params: {},
            extra: {},
            features: {
                image_generation: this.useImageGen,
                web_search: this.useWebSearch,
                auto_web_search: this.useWebSearch,
                preview_mode: this.usePreviewMode,
                flags: [],
                enable_thinking: this.useThinking
            },
            variables: this.getContextVars(),
            background_tasks: {
                title_generation: true,
                tags_generation: true
            },
            max_tokens: 4096
        };

        let fullAssistantContent = "";


        try {
            const response = await this.session.post(url, payload, {
                headers: {
                    "Authorization": `Bearer ${this.token}`,
                    "X-Signature": signature,
                    "X-FE-Version": this.feVersion,
                    "Content-Type": "application/json",
                    "Cookie": this.cookies.join('; ')
                },
                responseType: 'stream'
            });

            if (response.status === 400) {
                let errBody = "";
                for await (const chunk of response.data) {
                    errBody += chunk.toString();
                }
                console.error(`[!] AI 400 Error Body: ${errBody}`);

                // Rollback history on 400
                if (this.messages.length > 0 && this.messages[this.messages.length - 1].role === 'user') {
                    this.messages.pop();
                }

                // Auto-reset if history is corrupted
                if (errBody.includes('model output must contain') || errBody.includes('empty')) {
                    console.warn("[!] Corrupted history detected. Resetting session...");
                    this.messages = [];
                    this.chatId = require('crypto').randomUUID();
                }

                return null;
            }

            let buffer = "";
            return new Promise((resolve) => {
                response.data.on('data', (chunk) => {
                    buffer += chunk.toString();
                    let lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep partial line in buffer

                    for (const line of lines) {
                        const content = this.processLine(line, stream);
                        if (content === "[DONE]") {
                            resolve(fullAssistantContent);
                            return;
                        }
                        fullAssistantContent += content;
                    }
                });

                response.data.on('end', () => {
                    if (buffer.trim()) {
                        const content = this.processLine(buffer, stream);
                        if (content !== "[DONE]") {
                            fullAssistantContent += content;
                        }
                    }

                    if (fullAssistantContent) {
                        this.messages.push({ role: "assistant", content: fullAssistantContent });
                    } else {
                        console.warn("[!] AI stream ended with NO content. Rolling back history...");
                        this.messages.pop(); // Remove the user message that didn't get a reply
                    }
                    if (stream) console.log("\n");
                    resolve(fullAssistantContent);
                });

                response.data.on('error', (err) => {
                    console.error("Stream Error:", err.message);
                    if (!fullAssistantContent) this.messages.pop();
                    resolve(fullAssistantContent);
                });
            });

        } catch (e) {
            console.error(`\n[!] API Connection Error: ${e.message}`);

            // Critical fix: Pop user message on failure to keep history alternating
            if (this.messages.length > 0 && this.messages[this.messages.length - 1].role === 'user') {
                this.messages.pop();
            }

            // Check if we need to reset session due to specific upstream errors
            if (e.message.includes('model output must contain') || e.message.includes('empty')) {
                console.warn("[!] Detected upstream model error. Resetting session...");
                this.messages = [];
                this.chatId = crypto.randomUUID();
            }

            return null;
        }
    }
}

async function main() {
    const bot = new ZChat();
    await bot.initialize();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: `[${bot.messages.length}] ${bot.userName} > `
    });

    console.log("\n--- Z.AI JS Chat Console ---");
    console.log(`Current Settings: Model=${bot.model}, WebSearch=${bot.useWebSearch}, Thinking=${bot.useThinking}`);
    console.log("Commands: /search, /thinking, /new, /history, /exit\n");

    rl.prompt();

    rl.on('line', async (line) => {
        const input = line.trim();
        if (!input) {
            rl.prompt();
            return;
        }

        if (input.startsWith('/')) {
            const cmd = input.split(' ')[0];
            switch (cmd) {
                case '/exit':
                    rl.close();
                    return;
                case '/new':
                    bot.messages = [];
                    bot.chatId = crypto.randomUUID();
                    console.log("[*] History cleared. New conversation started.");
                    break;
                case '/history':
                    console.log(`\n--- Conversation (${bot.messages.length} messages) ---`);
                    bot.messages.forEach((m, idx) => {
                        console.log(`[${idx}] ${m.role.toUpperCase()}: ${m.content.substring(0, 60)}...`);
                    });
                    console.log("-----------------------------\n");
                    break;
                case '/search':
                    bot.useWebSearch = !bot.useWebSearch;
                    console.log(`[*] Web Search: ${bot.useWebSearch ? 'ON' : 'OFF'}`);
                    break;
                case '/thinking':
                    bot.useThinking = !bot.useThinking;
                    console.log(`[*] Thinking Mode: ${bot.useThinking ? 'ON' : 'OFF'}`);
                    break;
                default:
                    console.log("[!] Unknown command.");
            }
            rl.setPrompt(`[${bot.messages.length}] ${bot.userName} > `);
            rl.prompt();
            return;
        }

        await bot.chat(input);
        rl.setPrompt(`[${bot.messages.length}] ${bot.userName} > `);
        rl.prompt();
    }).on('close', () => {
        console.log('Goodbye!');
        process.exit(0);
    });
}

module.exports = ZChat;

if (require.main === module) {
    main();
}
