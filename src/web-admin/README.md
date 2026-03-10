# Web Admin Dashboard

Web-based control panel cho OBT Antidetect Browser.

## 🚀 Getting Started

### Installation

```bash
cd src/web-admin
npm install
```

### Development

```bash
npm run dev
```

App sẽ chạy ở http://localhost:5174

### Build

```bash
npm run build
```

## 📁 Structure

```
web-admin/
├── src/
│   ├── components/     # Web-specific components
│   ├── pages/         # Application pages
│   ├── App.jsx        # Main app component
│   ├── main.jsx       # Entry point
│   └── index.css      # Global styles
├── public/            # Static assets
├── index.html         # HTML template
├── package.json
└── vite.config.js
```

## 🔗 API Connection

Web admin kết nối với Desktop App qua REST API.

**Default API URL:** `http://localhost:5478`

Đảm bảo Desktop App đã bật REST API server trong Settings.

## 🎨 Shared Code

Web admin sử dụng shared components, hooks, và services từ `src/shared/`:

```jsx
import { Button } from '@components/common/Button';
import { useProfiles } from '@hooks/useProfiles';
import { useApiClient } from '@hooks/useApiClient';
```

Xem [src/shared/README.md](../shared/README.md) để biết thêm chi tiết.

## 🔐 Authentication

API có thể yêu cầu API key. Configure trong App settings hoặc environment variables:

```javascript
const api = useApiClient({
  baseURL: 'http://localhost:5478',
  apiKey: 'your-api-key-here'
});
```

## 🌐 Features

- ✅ Profile Management (CRUD)
- ✅ Launch/Stop Profiles
- ✅ Automation Scripts
- ✅ Proxy Management
- ✅ Extensions Management
- ✅ Real-time Status Updates
- ✅ Multi-language Support (EN/VI)

## 🔧 Configuration

Edit `vite.config.js` để customize:

- Port number
- API proxy settings
- Build options

## 📚 Documentation

- [Architecture Guide](../../ARCHITECTURE.md)
- [Shared Code README](../shared/README.md)
- [API Documentation](../../src/main/api/openapi.json)
