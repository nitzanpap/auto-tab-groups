# 🔖 Auto Tab Groups (Cross-Browser Extension)

A lightweight cross-browser extension that automatically groups open tabs by domain, with intelligent domain name handling for better organization. Works on both Chrome and Firefox!

## 📦 Downloads

🦊 **[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/auto-tab-groups/)**  
🌐 **[Chrome Web Store](https://chromewebstore.google.com/detail/auto-tab-groups/cmolegdbajakaekbamkdhonkaldgield)**
💻 **Developer Builds**: See [`extension/`](extension/) folder for latest builds

## 🆕 What's New

### Enhanced International Domain Support

- ✨ **Country Code Second-Level Domain (ccSLD) Support**: Proper handling of international domains like `abc.net.au`, `.co.uk`, `.com.au`
- 🌍 **Better Grouping for International Users**: Domains like `abc.net.au` now correctly group as "abc" instead of "net"
- 🔧 **Improved Domain Extraction**: Supports 15+ countries with accurate domain name detection

## Example of tab groups in the navigation bar

[![Example of the extension in Chrome](images/chrome-images/tab-groups-with-popup.png)](https://chrome.google.com/webstore/detail/auto-tab-groups/)

[![Example of the extension in Firefox](images/firefox-images/tab-groups-with-popup-firefox-and-rules.png)](https://addons.mozilla.org/en-US/firefox/addon/auto-tab-groups/)

---

## 🌐 Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Firefox | 139+ | ✅ Fully supported (Manifest V3, Tab Groups API) |
| Chrome | Latest | ✅ Fully supported (Manifest V3, Tab Groups API) |

**Note**: Firefox 139+ required for full Tab Groups API support and enhanced features.

---

## 🚀 Features

- ✅ **Cross-browser compatibility** - Single codebase for Chrome and Firefox
- ✅ **Domain-based tab grouping** - Automatically groups tabs by website domain
- ✅ **Custom rules** - Create named groups that combine multiple domains
- ✅ **Rules export/import** - Backup, share, and migrate custom rules as JSON files
- ✅ **Smart domain display** - Shows clean domain names (e.g., "github" instead of "github.com")
- ✅ **Color management** - Persistent group colors across browser sessions
- ✅ **Collapse/expand controls** - Manage tab group visibility
- ✅ **Configuration options** - Auto-grouping, subdomain handling, etc.
- ✅ **Side panel support** - Chrome side panel and Firefox sidebar
- ✅ **Modern UI** - Clean, responsive interface

### 🪄 Intelligent Tab Grouping

- Automatically groups tabs by their domain/subdomain
- Smart domain name display (e.g., "github" instead of "www.github.com")
- **Country code second-level domain (ccSLD) support** - Properly handles domains like `dailymail.co.uk`, `example.co.uk`, `abc.net.au`, etc.
- Special handling for IP addresses, localhost, and .local domains
- Real-time group updates as you browse

### 🛠️ Custom Rules System

- **Priority System**: Custom rules take priority over domain-based grouping
- **Fallback**: Domains not covered by custom rules still use automatic domain grouping
- **Real-time**: Changes to rules immediately re-group existing tabs
- **Quick add from current tabs**: Select domains from your currently open tabs instead of typing them manually
- **Example Use Cases**:
  - **Communication**: Group `discord.com`, `teams.microsoft.com`, `slack.com` under "Communication"
  - **Development**: Group `github.com`, `stackoverflow.com`, `docs.google.com` under "Dev Tools"
  - **Social Media**: Group `twitter.com`, `facebook.com`, `instagram.com` under "Social"

### 📎 Group Management

- One-click collapse/expand all groups
- Real-time group updates
- Maintains existing groups without duplicates
- Group/Ungroup all tabs with one click

### 🎨 Advanced Color Management

- Consistent colors for each domain group
- Random color generation with one click
- Optional preservation of manually customized colors
- Remembers color preferences across browser sessions

### ⚙️ Configuration Options

- Toggle auto-grouping (on/off)
- Toggle grouping by subdomain (on/off)
- Toggle only applying to new tabs (on/off)
- Toggle preservation of manual color choices (on/off)

### 📱 Side Panel & Sidebar Support

- Chrome side panel and Firefox sidebar integration
- Displays tab groups for easy access
- Allows quick navigation between groups
- Sidebar popup as an alternative to the main popup

## Planned Features

- AI-powered tab grouping (In Progress):
  - Server-side AI grouping API with token-based usage tracking
  - Free tier with limited trial tokens and premium tier with unlimited usage
  - Smart grouping based on tab content, not just domain names
  - Secure data handling with proper authentication and encryption

The AI grouping feature is currently under active development with:

- API contract defined for client-server communication
- Server infrastructure being built with Go
- Planned integration with AI providers for intelligent grouping
- Premium model designed with free trial tokens and unlimited premium usage

**Since this is open source, to run the AI grouping feature locally, users will need to provide their own API key.**

---

## 🛠️ Development

The extension is built with a unified codebase supporting both Chrome and Firefox:

### Quick Start

```bash
cd extension/
npm install
```

### Build Commands

```bash
# Build for Chrome
npm run build:chrome

# Build for Firefox  
npm run build:firefox

# Build for both browsers
npm run build

# Development mode
npm run dev:chrome    # Sets up for Chrome development
npm run dev:firefox   # Sets up for Firefox development
```

### Project Structure

```sh
extension/
├── src/                          # Single source code base
│   ├── manifest.chrome.json     # Chrome Manifest V3
│   ├── manifest.firefox.json    # Firefox Manifest V3
│   ├── utils/BrowserAPI.js       # Cross-browser compatibility layer
│   └── ...                      # Shared components
├── package.json                  # Build scripts for both browsers
└── README.md                     # Detailed development docs
```

For detailed development information, see [`extension/README.md`](extension/README.md).

---

## 📦 Project Structure

```text
extension/
├── src/                          # Single source code base
│   ├── manifest.chrome.json     # Chrome Manifest V3
│   ├── manifest.firefox.json    # Firefox Manifest V3
│   ├── background.js             # Service worker (both browsers)
│   ├── utils/
│   │   ├── BrowserAPI.js        # Cross-browser compatibility layer
│   │   ├── DomainUtils.js       # Domain processing utilities
│   │   └── RulesUtils.js        # Custom rules utilities
│   ├── config/
│   │   └── StorageManager.js    # Cross-browser storage handling
│   ├── services/
│   │   ├── TabGroupService.js   # Tab grouping logic
│   │   └── RulesService.js      # Custom rules management
│   ├── state/
│   │   └── TabGroupState.js     # State management
│   ├── public/
│   │   ├── popup.html           # Extension popup
│   │   ├── popup.js             # Popup logic
│   │   ├── popup.css            # Styling
│   │   ├── rules-modal.html     # Custom rules modal
│   │   ├── rules-modal.js       # Rules modal logic
│   │   └── sidebar.html         # Side panel/sidebar
│   └── assets/
│       ├── icon16.png           # Icons (PNG for compatibility)
│       ├── icon48.png
│       └── icon128.png
├── package.json                  # Build scripts for both browsers
└── README.md                     # Detailed development docs
server/                           # Backend for AI-powered tab grouping (in development)
├── cmd/api/                      # Server entry point and configuration
├── internal/                     # Core server components
│   ├── database/                 # Database access layer
│   └── server/                   # HTTP server and route handlers
└── docs/                         # Documentation for AI features and implementation plans
```

---

## 🛠 Development Setup

### Extension

1. Install dependencies:

    ```bash
    npm install
    ```

2. Available scripts:

- `npm start`: Run the extension in Firefox for development
- `npm run build`: Build the extension and generate .xpi file
- `npm run format`: Format code using Prettier
- `npm run lint`: Run ESLint checks

### Server (TBD, for AI features)

1. Set up Go development environment
2. Navigate to the server directory:

    ```bash
    cd server
    ```

3. Build and run the server:

    ```bash
    make run
    ```

4. For development with hot reload:

    ```bash
    make dev
    ```

### Loading Extension for Development

1. Open Firefox and go to: `about:debugging`
2. Click **"This Firefox"** → **"Load Temporary Add-on..."**
3. Select the `manifest.json` file from the `src` directory

---

## 🧪 Usage

The extension works automatically in the background, grouping tabs by domain with intelligent name formatting. Click the extension icon in the browser toolbar to:

- Toggle automatic grouping
- Configure grouping options
- Manually trigger grouping for all tabs
- Generate new random colors for groups
- Collapse or expand all groups at once
- Access advanced settings:
  - Group by subdomain
  - Preserve manual color choices
- Create and manage custom rules for advanced grouping

### Custom Rules

Create named tab groups that combine multiple domains under a single group:

1. Open the extension popup
2. Click "🔧 Custom Rules" to expand the section
3. Click "➕ Add New Rule" to create your first rule
4. Enter a group name (or let the system suggest one)
5. **Quick add from current tabs**: Select domains from your currently open tabs instead of typing them manually
6. Choose a color and save

**Example Use Cases**:

- **Communication**: Group `discord.com`, `teams.microsoft.com`, `slack.com` under "Communication"
- **Development**: Group `github.com`, `stackoverflow.com`, `docs.google.com` under "Dev Tools"
- **Social Media**: Group `twitter.com`, `facebook.com`, `instagram.com` under "Social"

### Color Management

The extension provides several ways to manage tab group colors:

1. **Automatic Colors**: Each domain gets a consistent color by default
2. **Manual Customization**:
   - Right-click any tab group to change its color
   - The extension can remember your custom color choices
3. **Random Generation**:
   - Click "Generate New Colors" to randomly assign new colors
   - Use the "Preserve manual colors" setting to keep your custom choices when generating new colors

### Group Management

The extension provides convenient ways to manage your tab groups:

1. **Automatic Grouping**:
   - Tabs are automatically grouped by domain
   - New tabs are added to existing groups
2. **Manual Controls**:
   - Group/Ungroup all tabs with one click
   - Collapse or expand all groups simultaneously
   - Right-click groups for individual controls

---

## 🧠 How It Works

### Tab Grouping Logic

- Uses the [`browser.tabs.group()`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/group) API
- Groups tabs based on their root domain
- Maintains group consistency during tab operations (refresh, new tab, etc.)
- **Smart domain extraction** with support for country code second-level domains (ccSLDs):
  - `abc.net.au` → Groups as "abc" (recognizes `co.au` as single TLD)
  - `shop.example.co.uk` → Groups as "example" (recognizes `co.uk` as single TLD)
  - `www.github.com` → Groups as "github" (standard domain handling)
- Intelligently formats domain names for group titles:
  - Removes TLD properly (e.g., ".com", ".org", ".co.il", ".co.uk")
  - Removes "www" subdomain when present
  - Special handling for IP addresses and local domains

### Group State Management

- Tracks collapse state of all groups
- Provides unified controls for group visibility
- Maintains group state during tab operations
- Ensures smooth transitions when collapsing/expanding

### 🌍 Country Code Second-Level Domain (ccSLD) Support

The extension includes intelligent handling for country-specific domains that use two-part top-level domains:

**Supported ccSLDs include:**

- **United Kingdom**: `.co.uk`, `.org.uk`, `.net.uk`, `.ac.uk`, `.gov.uk`
- **Australia**: `.com.au`, `.net.au`, `.org.au`, `.edu.au`, `.gov.au`
- **New Zealand**: `.co.nz`, `.net.nz`, `.org.nz`, `.ac.nz`, `.govt.nz`
- **South Africa**: `.co.za`, `.org.za`, `.net.za`, `.ac.za`, `.gov.za`
- **Japan**: `.co.jp`, `.or.jp`, `.ne.jp`, `.ac.jp`, `.go.jp`
- **South Korea**: `.co.kr`, `.or.kr`, `.ne.kr`, `.ac.kr`, `.go.kr`
- And many more...

**Examples:**

- `abc.net.au` → Groups as "abc" (not "co")
- `shop.example.co.uk` → Groups as "example" (not "co")
- `api.service.com.au` → Groups as "service" (not "com")

This ensures that international users get proper domain grouping regardless of their country's domain structure.

## 📚 Resources

- [MDN WebExtensions API Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [tabs.group() API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/group)

---

## 📦 Distribution

### Building for Production

1. Update version in `manifest.json`
2. Build the extension:

    ```bash
    npm run build
    ```

3. The built extension will be available as an .xpi file

### Publishing to Firefox Add-ons

1. Update the version in `manifest.json`
2. Build using `npm run build`
3. Upload the .xpi file to [Firefox Add-ons Developer Hub](https://addons.mozilla.org/en-US/developers/)

---

## 👨‍💻 Author

Built by [Nitzan Papini](https://github.com/nitzanpap)

## 📄 License

See [LICENSE.md](LICENSE.md) for details.
