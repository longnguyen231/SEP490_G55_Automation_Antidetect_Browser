# Usage Guide

## Getting Started

### Installation

1. Clone the repository and install dependencies:
```bash
git clone https://github.com/OngBanTat/ObtAutomationAntidetectBrowser.git
cd ObtAutomationAntidetectBrowser
npm install
```

### Running the Application

#### Development Mode
```bash
npm run dev
```
This will start both the Vite dev server and Electron application with hot reload enabled.

#### Production Mode
```bash
# Build the application
npm run build:vite

# Run the built application
npm start
```

## Creating Your First Profile

1. **Launch the Application**: Start the app using `npm run dev`

2. **Create New Profile**: Click the "+ Create New Profile" button

3. **Fill Basic Information**:
   - **Profile Name**: Enter a descriptive name (e.g., "Testing Profile 1")
   - **Description**: Optional description of the profile's purpose
   - **Start URL**: The URL that will open when launching this profile (default: https://www.google.com)
   - **Active Profile**: Check to mark this profile as active

4. **Configure Browser Fingerprint (Antidetect Settings)**:

   **Operating System**:
   - Select Windows, macOS, or Linux
   - The User Agent will automatically update based on your selection

   **Browser**:
   - Choose from Chrome, Firefox, Safari, or Edge
   
   **Browser Version**:
   - Specify the browser version (e.g., 120.0.0.0)
   
   **User Agent**:
   - Auto-generated based on OS and browser selection
   - Can be manually customized for specific needs
   
   **Language**:
   - Select from various language options (en-US, en-GB, es-ES, fr-FR, de-DE, ja-JP, zh-CN)
   
   **Screen Resolution**:
   - Choose from common resolutions: 1920x1080, 1366x768, 1440x900, 1536x864, 2560x1440
   
   **Timezone**:
   - Select appropriate timezone (EST, CST, MST, PST, GMT, CET, JST, CST)
   
   **Advanced Features**:
   - ✅ Enable WebGL - Controls WebGL rendering capabilities
   - ✅ Enable Canvas - Controls Canvas fingerprinting
   - ✅ Enable Audio Context - Controls Audio API fingerprinting

5. **Save Profile**: Click "Create Profile" button

## Managing Profiles
Click the "Launch" button on any profile card. Engine & headless mode are selectable per profile card:
- Engine: Playwright (default) or Real Chrome (CDP)
- Headless: toggle (disabled while running)

On launch you receive (internally) a DevTools/Playwright WebSocket endpoint. Use "Copy WS" to copy it for external automation.
### Viewing Profiles
Click the "Delete" button on any profile card and confirm. The profile’s CDP user-data folder and storage state JSON are purged.
- Operating System
- Browser type
## Profile Data & Runtime Folders

- Stored under `data/` (git-ignored): `profiles.json`, `settings.json`, `logs/`, `profiles/` (storage state), `cdp-user-data/` (per CDP profile)
- Deleting a profile removes its storage state and CDP user-data directory.
### Launching a Profile
Check that the Start URL is valid
Ensure Chrome/Edge executable is found for CDP engine (set CHROME_PATH or place portable build in `vendor/`)
Playwright missing browsers: automatic install attempted; else run `npx playwright install chromium`
Check logs (`data/logs/<id>.log`)
1. Click the "✏️ Edit" button on the profile card
Verify write permissions to the `data/` directory
Check renderer DevTools console for IPC errors
Ensure the profile name is not empty
If running pure web (no Electron preload), REST fallback used: confirm API server running
### Deleting a Profile
1. Click the "🗑️ Delete" button on the profile card
### Engine Parity & Fingerprint Injection

- Playwright: context options + init scripts for navigator overrides & WebGL patching
- CDP: Emulation.* commands + addInitScript in persistent context + page session overrides
- Unified fields: hardwareConcurrency, deviceMemory, platform, doNotTrack, devicePixelRatio, maxTouchPoints, languages, plugins, WebGL vendor/renderer

### WebSocket Endpoint Usage

Use the copied WS endpoint with external scripts:
```js
// Playwright example attach
const { chromium } = require('playwright');
const browser = await chromium.connectOverCDP(wsEndpoint); // or chromium.connect(wsEndpoint) for PW server
```
Create multiple profiles with different Operating Systems to test how your website appears across platforms:
- Profile 1: Windows + Chrome
- Profile 2: macOS + Safari
- Profile 3: Linux + Firefox

### Use Case 2: Multi-Account Management
Create separate profiles for different accounts to keep sessions isolated:
- Each profile uses a separate partition in Electron
- Cookies and storage are isolated between profiles
- Launch multiple profiles simultaneously

### Use Case 3: Geolocation Testing
Create profiles with different timezones and languages to test localization:
- Profile for US users: en-US, America/New_York
- Profile for EU users: en-GB, Europe/London
- Profile for Asian users: ja-JP, Asia/Tokyo

## Profile Data Location

Profiles are stored locally in JSON format at:
- **Windows**: `%APPDATA%\obtautomationantidetectbrowser\profiles.json`
- **macOS**: `~/Library/Application Support/obtautomationantidetectbrowser/profiles.json`
- **Linux**: `~/.config/obtautomationantidetectbrowser/profiles.json`

## Troubleshooting

### Application Won't Start
- Ensure Node.js is installed (version 16 or higher)
- Delete `node_modules` and run `npm install` again
- Check that ports 5173 is available (used by Vite dev server)

### Profile Won't Launch
- Check that the Start URL is valid
- Ensure Electron has necessary permissions
- Check console logs for errors

### Changes Not Saving
- Verify write permissions to the user data directory
- Check browser console for error messages
- Ensure the profile name is not empty

## Tips and Best Practices

1. **Use Descriptive Names**: Name profiles based on their purpose (e.g., "Facebook-Testing", "US-Market-Research")

2. **Match Configurations**: Ensure OS, Browser, and User Agent settings are consistent for realistic fingerprints

3. **Regular Updates**: Update browser versions periodically to match current browser releases

4. **Test Profiles**: After creating a profile, launch it and visit https://www.whatismybrowser.com to verify fingerprint settings

5. **Backup Profiles**: Periodically backup your profiles.json file to prevent data loss

## Advanced Features

### Custom User Agents
While the application auto-generates User Agents, you can customize them for specific needs:
```
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
```

### Session Isolation
Each profile uses a separate Electron partition (`persist:profile_{id}`), ensuring:
- Separate cookies
- Separate local storage
- Separate session data
- No cross-contamination between profiles

## Support

For issues, questions, or contributions, please visit:
https://github.com/OngBanTat/ObtAutomationAntidetectBrowser

## Profile Actions (experimental)

You can drive a running browser by profile ID via IPC from the renderer:

```
// Click on an element
window.electron.ipcRenderer.invoke('profile-action', profileId, 'click.element', { selector: '#submit' });

// Click at absolute coordinates
window.electron.ipcRenderer.invoke('profile-action', profileId, 'click.at', { x: 200, y: 300 });

// Scroll viewport by percent
window.electron.ipcRenderer.invoke('profile-action', profileId, 'scroll.percent', { yPercent: 1 });

// Capture screen (returns base64 if no path)
window.electron.ipcRenderer.invoke('profile-action', profileId, 'capture.screen', { fullPage: true });
// Evaluate JS on the page
window.electron.ipcRenderer.invoke('profile-action', profileId, 'js.eval', { expression: "document.title" });

// Inject a script tag
window.electron.ipcRenderer.invoke('profile-action', profileId, 'page.script.add', { url: 'https://example.com/script.js' });

Supported actions and params:
 - js.eval: { expression, arg?, index? }
 - element.eval: { selector, expression, index?, timeout? }
 - page.content: { index? }
 - page.title: { index? }
 - page.url: { index? }
 - element.text: { selector, index?, timeout? }
 - element.html: { selector, index?, timeout? }
 - element.attr: { selector, name, index?, timeout? }
 - page.script.add: { url? | path? | content?, type? }
 - page.style.add: { url? | path? | content? }
 - page.pdf: { path, format?, printBackground?, landscape?, scale?, margin? }
```

Supported actions and params:
- click.at: { x, y, button?, clickCount?, delay? }
- click.percent: { xPercent, yPercent, selector?, button?, clickCount?, delay?, timeout? }
- click.element: { selector, button?, clickCount?, timeout?, position? }
- scroll.percent: { xPercent, yPercent, selector? }
- scroll.fromTo: { x1, y1, x2, y2, steps? }
- scroll.elementToElement: { fromSelector, toSelector, behavior?, block?, inline?, timeout? }
- keyboard.send: { text?, press?, sequence?, delay? }
- capture.screen: { index?, path?, fullPage? }
- capture.element: { selector, path?, timeout? }
- wait: { ms? } or { selector, state?, timeout? }
- hover: { selector, timeout? }
- dragAndDrop: { from, to, steps?, timeout? }
- input.fill: { selector, value, timeout? }
- select.option: { selector, values, timeout? }
 - nav.goto: { url, waitUntil?, newPage?, index? }
 - nav.back: { waitUntil?, index? }
 - nav.forward: { waitUntil?, index? }
 - nav.reload: { waitUntil?, index? }
 - wait.loadState: { state?, index?, timeout? }
 - element.focus: { selector, timeout? }
 - input.type: { selector, text, delay?, timeout? }
 - input.clear: { selector, timeout? }
 - input.check: { selector, timeout? }
 - input.uncheck: { selector, timeout? }
 - input.setFiles: { selector, files, timeout? }
 - storage.local.set: { items } (values auto JSON stringified if not string)
 - storage.local.get: { keys? } (omit keys to get all)
 - storage.local.remove: { keys }
 - storage.local.clear: {}
 - storage.session.set / get / remove / clear (same shape)
 - cookies.get: { urls? }
 - cookies.set: { cookies: [ { name, value, url or domain/path/... } ] }
 - cookies.clear: {}
 - network.setOffline: { offline? }
 - geolocation.set: { latitude, longitude, accuracy? }
 - viewport.set: { width, height, deviceScaleFactor? }
 - headers.setExtra: { headers }
 - tab.new: { url?, waitUntil? }
 - tab.close: { index? }
 - page.front: { index? }

Each returns { success: boolean, ...data }.
