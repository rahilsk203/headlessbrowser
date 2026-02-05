# 🕵️‍♂️ Headless Browser Pro (Stealth Edition)

An advanced, professional-grade headless browser automation framework built with **Node.js** and **Puppeteer**. Designed to bypass high-end bot detection systems (Cloudflare, Akamai, Datadome, etc.) using human-like behavior, hardware fingerprint masking, and system-level browser integration.

---

## 🚀 Key Modules & Features

### 1. **🎭 Extreme Stealth Engine**
The core engine is built for maximum invisibility:
- **Fingerprint Masking**: Real-time noise injection for **Canvas** and **WebGL**.
- **Hardware Spoofing**: Masks CPU cores, device memory, and screen resolutions to match real-world devices.
- **Deep Property Scrubber**: Removes `navigator.webdriver`, `chrome` traits, and `permissions` flags that standard bots leave behind.
- **System Browser Integration**: Uses your local Chrome/Edge installation to leverage existing cookies, history, and trust scores.

### 2. **🧠 Humanoid Utility**
Mimics human interaction patterns with high precision:
- **Bezier Mouse Movements**: Semi-organic, curved mouse paths instead of linear "bot-like" moves.
- **Jittery Typing**: Realistic keyboard input with randomized per-character delays and occasional "human" pacing.
- **Natural Scrolling**: Smooth, fragmented scrolling that mimics a user reading a page.

### 3. **🧪 Universal Extraction System**
A modular extraction layer that targets high-value platforms:
- **`AccuWeather`**: Precise temperature, RealFeel, Wind, and Air Quality (AQI) data.
- **`GSMArena`**: Full mobile specification tables and search result indexing.
- **`Facebook`**: Reels statistics, author data, and profile bios.
- **`Instagram`**: Reels metadata and profile performance stats.
- **`YouTube`**: Video metadata (views, likes, description) and search result parsing.
- **`GitHub Master`**: Repository stars/forks, README analysis, file extraction, and profile contributions.
- **`Generic`**: A fallback heuristic-engine that extracts main content from any website.

---

## ⌨️ Professional CLI Usage

Run powerful operations directly from your terminal.

### **Basic Scraping**
```bash
# Extract data from any URL
node src/cli.js --url "https://example.com" --extract
```

### **Advanced Search & Extraction**
```bash
# Search for mobile specs on GSMArena
node src/cli.js --url "https://www.gsmarena.com/results.php3?sQuickText=vivo+v40" --extract --system

# Get live weather for Delhi
node src/cli.js --url "https://www.accuweather.com/en/in/delhi/weather-forecast/202396" --extract --system --wait 5000
```

### **Automation & Interaction**
```bash
# Upload an image, type a prompt, and hit Enter key
node src/cli.js --url "https://target-site.com" \
  --upload "input[type=file]:path/to/image.png" \
  --type "textarea:Analyze this" \
  --key "Enter" \
  --extract --wait 15000 --system
```

**Available Flags:**
- `-u, --url <url>`: Direct navigation.
- `-s, --search <query>`: Fast search shortcut (Bing-integrated).
- `-d, --device <name>`: Emulation profile (`desktop`, `iphone-15`, `android-pixel`).
- `-e, --extract`: Enable specialized data extraction logic.
- `--system`: Use the local system browser for maximum stealth.
- `--upload "selector:path"`: Automate file uploads.
- `--type "selector:text"`: Human-like typing.
- `--key <key>`: Press specific keys (e.g., `Enter`, `Tab`).
- `--wait <ms>`: Delay before extraction.
- `--screenshot <path>`: Save a full-page visual evidence.

---

## 📂 Project Structure

```text
├── config/             # Emulation profiles and hardware configs
├── src/
│   ├── core/           # StealthBrowser.js (The Brain)
│   ├── utils/          # Humanoid, Fingerprint, Scraper, Logger
│   └── extractors/      # Specialized logic (YouTube, GitHub, etc.)
├── data/               # Automated JSON outputs
├── examples/           # Standalone implementation scripts
└── package.json        # Dependencies and scripts
```

## 🛠️ Installation

```bash
git clone https://github.com/rahilsk203/headlessbrowser.git
cd headlessbrowser
npm install
```

---
*Developed for advanced researchers and automation engineers.* 🤖🕊️