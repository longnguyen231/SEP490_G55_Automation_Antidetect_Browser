# SEP490 G55 - Automation Antidetect Browser

## 📋 Mô Tả Dự Án

Đây là base code cho dự án Automation Antidetect Browser của nhóm SEP490 G55.

**Tech Stack:**
- **Electron** - Desktop application framework
- **React** - Frontend UI library 
- **Playwright** - Browser automation
- **Vite** - Build tool

---

## 📁 Cấu Trúc Thư Mục

```
SEP490_G55_Automation_Antidetect_Browser/
├── src/
│   ├── main/                 # Electron Main Process
│   │   ├── config/           # Cấu hình ứng dụng
│   │   │   └── app.config.js # File config chính
│   │   ├── controllers/      # Controllers xử lý IPC requests
│   │   ├── models/           # Data models
│   │   │   └── Profile.js    # Model Profile
│   │   ├── services/         # Business logic services
│   │   │   ├── ProfileService.js    # CRUD profiles
│   │   │   ├── BrowserService.js    # Launch/stop browser
│   │   │   └── AutomationService.js # Automation execution
│   │   ├── utils/            # Utilities
│   │   │   └── logger.js     # Logging utility
│   │   └── index.js          # Entry point
│   │
│   ├── preload/              # Electron Preload Scripts
│   │   └── preload.js        # IPC bridge
│   │
│   └── renderer/             # React Frontend
│       ├── components/       # React components
│       ├── pages/            # Page components
│       ├── hooks/            # Custom React hooks
│       ├── styles/           # CSS styles
│       ├── App.jsx           # Main App component
│       ├── App.css           # App styles
│       ├── main.jsx          # React entry point
│       └── index.css         # Global styles
│
├── tests/                    # Unit tests
├── docs/                     # Documentation
├── package.json              # Dependencies
└── vite.config.js            # Vite configuration
```

---

## 🏗️ Giải Thích Architecture

### 1. **Main Process** (`src/main/`)

Đây là process chính của Electron, chạy trong môi trường Node.js.

| Thư mục | Mô tả |
|---------|-------|
| `config/` | Chứa tất cả cấu hình của ứng dụng (APP_CONFIG, BROWSER_CONFIG...) |
| `models/` | Định nghĩa cấu trúc dữ liệu (Profile model) |
| `services/` | Business logic - nơi xử lý chính (CRUD, browser control, automation) |
| `controllers/` | Xử lý requests từ Renderer (qua IPC) |
| `utils/` | Các utility functions (logging, helpers...) |

### 2. **Preload Script** (`src/preload/`)

Cầu nối giữa Main và Renderer process. Expose các API an toàn thông qua `contextBridge`.

### 3. **Renderer Process** (`src/renderer/`)

Frontend React application.

| Thư mục | Mô tả |
|---------|-------|
| `components/` | Các React components tái sử dụng |
| `pages/` | Page-level components |
| `hooks/` | Custom React hooks |
| `styles/` | CSS files |

---

## 🔄 Data Flow

```
┌──────────────┐     IPC      ┌──────────────┐
│   Renderer   │ ←──────────→ │     Main     │
│   (React)    │   invoke     │  (Electron)  │
└──────────────┘              └──────────────┘
       ↑                             ↓
       │                      ┌──────────────┐
   preload.js                 │   Services   │
       │                      └──────────────┘
       ↓                             ↓
┌──────────────┐              ┌──────────────┐
│  electronAPI │              │   Storage    │
│   (window)   │              │   (JSON)     │
└──────────────┘              └──────────────┘
```

---

## 🚀 Bắt Đầu

### 1. Cài đặt dependencies

```bash
cd SEP490_G55_Automation_Antidetect_Browser
npm install
```

### 2. Chạy Development

```bash
npm run dev
```

### 3. Build Production

```bash
npm run build
```

---

## 📝 Phân Công Công Việc

### Suggested Task Division (5 members):

| Thành Viên | Nhiệm Vụ | Files Chính |
|------------|----------|-------------|
| **Member 1** | Profile Management UI | `src/renderer/components/ProfileCard.jsx`, `ProfileForm.jsx`, `ProfileList.jsx` |
| **Member 2** | Browser Control & Fingerprint | `src/main/services/BrowserService.js`, fingerprint logic |
| **Member 3** | Automation Engine | `src/main/services/AutomationService.js`, script editor UI |
| **Member 4** | Proxy & Network | Proxy handling, network interceptor |
| **Member 5** | Settings & Storage | `src/main/services/SettingsService.js`, export/import |

---

## 🔧 Các Services Chính

### ProfileService

```javascript
// Lấy tất cả profiles
ProfileService.getAllProfiles()

// Tạo profile mới
ProfileService.createProfile({ name: 'My Profile' })

// Cập nhật profile
ProfileService.updateProfile(id, { name: 'New Name' })

// Xóa profile
ProfileService.deleteProfile(id)
```

### BrowserService

```javascript
// Launch browser với profile
BrowserService.launchProfile(profileId, { headless: false })

// Dừng browser
BrowserService.stopProfile(profileId)

// Lấy danh sách profiles đang chạy
BrowserService.getRunningProfiles()
```

### AutomationService

```javascript
// Chạy automation steps
AutomationService.runAutomation(profileId, [
  { action: 'navigate', url: 'https://example.com' },
  { action: 'click', selector: '#login-btn' },
  { action: 'type', selector: '#username', text: 'user123' },
  { action: 'wait', ms: 2000 },
  { action: 'screenshot', path: './screenshot.png' }
])
```

---

## 📚 Automation Actions

| Action | Mô Tả | Params |
|--------|-------|--------|
| `navigate` | Điều hướng URL | `url`, `waitUntil` |
| `click` | Click element | `selector`, `button`, `clickCount` |
| `type` | Gõ text (từng ký tự) | `selector`, `text`, `delay` |
| `fill` | Điền text (nhanh) | `selector`, `text` |
| `wait` | Chờ thời gian | `ms` |
| `waitForSelector` | Chờ element | `selector`, `state` |
| `screenshot` | Chụp màn hình | `path`, `fullPage` |
| `eval` | Chạy JavaScript | `expression` |
| `scroll` | Cuộn trang | `x`, `y`, `selector` |
| `hover` | Di chuột | `selector` |
| `select` | Chọn dropdown | `selector`, `value` |
| `press` | Nhấn phím | `key` |
| `upload` | Upload file | `selector`, `file` |

---

## 🎨 Coding Conventions

### File Naming
- Components: `PascalCase.jsx` (e.g., `ProfileCard.jsx`)
- Services: `PascalCase.js` (e.g., `ProfileService.js`)
- Utilities: `camelCase.js` (e.g., `logger.js`)
- Styles: `ComponentName.css`

### Code Style
- Use ES6+ syntax
- Async/await for async operations
- JSDoc comments for functions
- Vietnamese comments are OK

---

## 🐛 Troubleshooting

### 1. Playwright browsers not installed
```bash
npx playwright install chromium
```

### 2. Electron không chạy được
```bash
npm rebuild
```

### 3. Port 5173 đã được sử dụng
```bash
# Tìm và kill process
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

---

## 📞 Liên Hệ

Nhóm SEP490 G55 - FPT University

---

*Last updated: February 2026*
