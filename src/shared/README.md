# Shared Components & Services

Thư mục này chứa code dùng chung giữa Desktop App (Electron) và Web Admin Dashboard.

## 📁 Cấu Trúc

```
shared/
├── components/          # UI Components
│   ├── common/         # Basic components (Button, Card, Toast)
│   ├── layout/         # Layout components (Sidebar, Header)
│   └── domain/         # Business components (ProfileCard, ProfileForm)
│
├── hooks/              # Custom React Hooks
│   ├── useProfiles.js     # Profile management
│   ├── useAutomation.js   # Automation scripts
│   ├── useSettings.js     # App settings
│   ├── useToast.js        # Toast notifications
│   └── useApiClient.js    # API client creation
│
├── services/           # API & IPC Services
│   ├── api/           # REST API services
│   │   ├── client.js  # Base API client
│   │   ├── profiles.js
│   │   ├── automation.js
│   │   └── settings.js
│   └── ipc/           # Electron IPC bridge
│       └── ipcBridge.js
│
├── utils/              # Utility functions
│   ├── constants.js   # App constants
│   ├── validators.js  # Validation functions
│   └── formatters.js  # Formatting utilities
│
└── styles/            # Shared styles
    ├── variables.css  # CSS variables (theme)
    └── global.css     # Global styles
```

## 🚀 Import Aliases

Import aliases đã được configure trong `vite.config.js`:

```javascript
import { Button } from '@components/common/Button';
import { useProfiles } from '@hooks/useProfiles';
import { ApiClient } from '@services/api';
import { BROWSER_TYPES } from '@utils/constants';
import '@styles/variables.css';
```

## 📦 Components

### Button

```jsx
import { Button } from '@components/common/Button';

<Button 
  variant="primary"    // primary | secondary | success | danger | ghost
  size="medium"        // small | medium | large
  onClick={handleClick}
  disabled={false}
  loading={false}
>
  Click Me
</Button>
```

### Card

```jsx
import { Card } from '@components/common/Card';

<Card 
  title="Profile Name"
  subtitle="Profile description"
  variant="elevated"     // outlined | elevated | flat
  interactive={true}
  onClick={handleClick}
>
  Card content here
</Card>
```

### Toast

```jsx
import { ToastContainer } from '@components/common/Toast';
import { useToast } from '@hooks/useToast';

function MyComponent() {
  const { toasts, success, error, removeToast } = useToast();
  
  return (
    <>
      <button onClick={() => success('Profile created!')}>
        Show Toast
      </button>
      
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
}
```

## 🎣 Hooks

### useApiClient

Tự động detect môi trường (Electron hoặc Web) và tạo API client phù hợp:

```jsx
import { useApiClient } from '@hooks/useApiClient';

function App() {
  const api = useApiClient({
    baseURL: 'http://localhost:5478',  // REST API URL
    apiKey: 'your-api-key',            // Optional
    preferIpc: true                     // Prefer IPC when available
  });
  
  // api.profiles, api.automation, api.settings, api.presets
  return <YourComponent api={api} />;
}
```

### useProfiles

Quản lý profiles với CRUD operations:

```jsx
import { useProfiles } from '@hooks/useProfiles';
import { useApiClient } from '@hooks/useApiClient';

function ProfilesPage() {
  const api = useApiClient();
  const {
    profiles,
    loading,
    error,
    runningProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    launchProfile,
    stopProfile,
    isProfileRunning
  } = useProfiles(api);
  
  return (
    <div>
      {profiles.map(profile => (
        <ProfileCard 
          key={profile.id}
          profile={profile}
          isRunning={isProfileRunning(profile.id)}
          onLaunch={() => launchProfile(profile.id)}
          onStop={() => stopProfile(profile.id)}
        />
      ))}
    </div>
  );
}
```

### useAutomation

Quản lý automation scripts:

```jsx
import { useAutomation } from '@hooks/useAutomation';

function AutomationPage() {
  const api = useApiClient();
  const {
    scripts,
    loading,
    createScript,
    runScript,
    stopScript,
    isScriptRunning
  } = useAutomation(api);
  
  // ... implementation
}
```

### useToast

Hiển thị notifications:

```jsx
import { useToast } from '@hooks/useToast';

function MyComponent() {
  const { success, error, warning, info } = useToast();
  
  const handleSave = async () => {
    try {
      await saveProfile();
      success('Profile saved successfully!');
    } catch (err) {
      error('Failed to save profile');
    }
  };
}
```

## 🔧 Services

### API Services

REST API client với built-in error handling:

```jsx
import { ApiClient, createApiServices } from '@services/api';

// Create client
const client = new ApiClient('http://localhost:5478');
client.setApiKey('your-api-key');

// Create services
const services = createApiServices(client);

// Use services
const profiles = await services.profiles.getProfiles();
const result = await services.profiles.launchProfile(profileId);
await services.automation.runScript(scriptId, [profileId]);
```

### IPC Bridge (Electron Only)

Wrap Electron IPC thành API-like interface:

```jsx
import { IpcBridge } from '@services/ipc';

const ipc = new IpcBridge();

// Use like REST API
const profiles = await ipc.getProfiles();
await ipc.launchProfile(profileId, { headless: false });

// Subscribe to events
const unsubscribe = ipc.onRunningMapChanged((runningMap) => {
  console.log('Running profiles:', runningMap);
});
```

## 🎨 Styling

### CSS Variables

Tất cả colors, spacing, shadows được define trong `styles/variables.css`:

```css
/* Usage in your CSS */
.myComponent {
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}
```

### CSS Modules

Tất cả components dùng CSS Modules để tránh conflict:

```jsx
import styles from './MyComponent.module.css';

<div className={styles.container}>
  <h1 className={styles.title}>Title</h1>
</div>
```

## 📝 Validation & Formatting

```jsx
import { validateProfile, validateUrl } from '@utils/validators';
import { formatRelativeTime, formatDuration } from '@utils/formatters';

// Validation
const { valid, errors } = validateProfile(profileData);
if (!valid) {
  console.error(errors);
}

// Formatting
const timeAgo = formatRelativeTime(profile.lastUsed);
const duration = formatDuration(1234567); // "20m 34s"
```

## 🔄 Migration từ Code Cũ

### Desktop App (renderer/)

**Trước:**
```jsx
// renderer/App.jsx
const [profiles, setProfiles] = useState([]);

const loadProfiles = async () => {
  const data = await window.electronAPI.getProfiles();
  setProfiles(data);
};
```

**Sau:**
```jsx
// renderer/App.jsx
import { useApiClient } from '@hooks/useApiClient';
import { useProfiles } from '@hooks/useProfiles';

function App() {
  const api = useApiClient();
  const { profiles, loading, createProfile, deleteProfile } = useProfiles(api);
  
  // Business logic đã được extract vào hook
}
```

### Web Admin

**Trước:**
```jsx
// hl-kcm/pages/Profiles.jsx
const [profiles, setProfiles] = useState([]);

async function apiGetProfiles() {
  return fetch('/api/profiles').then(r => r.json());
}
```

**Sau:**
```jsx
// web-admin/pages/Profiles.jsx
import { useApiClient } from '@hooks/useApiClient';
import { useProfiles } from '@hooks/useProfiles';

function ProfilesPage() {
  const api = useApiClient({ baseURL: 'http://localhost:3000' });
  const { profiles, loading } = useProfiles(api);
  
  // Code dùng chung 100%
}
```

## 🎯 Best Practices

1. **Components**: Luôn dùng CSS Modules
2. **Imports**: Dùng aliases (@components, @hooks, @utils)
3. **State Management**: Extract logic vào custom hooks
4. **API Calls**: Dùng services layer, không gọi fetch trực tiếp
5. **Validation**: Dùng validators từ @utils/validators
6. **Styling**: Dùng CSS variables thay vì hardcode values
7. **Error Handling**: Luôn handle errors trong hooks/services

## 🚧 TODO

- [ ] Add TypeScript definitions
- [ ] Add unit tests cho hooks và services
- [ ] Thêm domain components (ProfileCard, ProfileForm)
- [ ] Implement i18n trong shared
- [ ] Add loading skeleton components
- [ ] Theme switcher (dark/light mode)
