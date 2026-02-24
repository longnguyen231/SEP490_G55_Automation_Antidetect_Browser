import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const messages = {
  vi: {
    'app.title': 'HL-MCK Automation Antidetect Browser',
    'app.subtitle': 'Quản lý hồ sơ trình duyệt với chống nhận diện',

    // Sidebar
    'nav.navigation': 'Điều hướng',
    'nav.profiles': 'Hồ sơ',
    'nav.scripts': 'Kịch bản',
    'nav.settings': 'Cài đặt',
    'nav.language': 'Ngôn ngữ',
    'nav.theme': 'Giao diện',

    // Language
    'lang.vi': '🇻🇳 Tiếng Việt',
    'lang.en': '🇬🇧 English',

    // Actions (toolbar / bulk)
    'actions.selectAll': 'Chọn tất cả',
    'actions.clear': 'Bỏ chọn',
    'actions.startSelected': 'Chạy',
    'actions.stopSelected': 'Dừng',
    'actions.deleteSelected': 'Xoá',
    'actions.create': 'Tạo Profile',
    'actions.newProfile': 'Profile mới',
    'actions.selected': 'đã chọn',

    // Profile List
    'profiles.title': 'Hồ sơ',
    'profiles.count': 'hồ sơ',
    'profiles.empty.title': 'Chưa có hồ sơ nào',
    'profiles.empty.desc': 'Tạo hồ sơ trình duyệt đầu tiên để bắt đầu',
    'profiles.empty.btn': 'Tạo Profile',

    // Profile Card
    'profile.status.running': 'Đang chạy',
    'profile.status.stopped': 'Đã dừng',
    'profile.edit': 'Sửa',
    'profile.clone': 'Nhân bản',
    'profile.cookies': 'Cookie',
    'profile.logs': 'Nhật ký',
    'profile.copyWs': 'Sao chép WS',
    'profile.delete': 'Xoá',
    'profile.launch': 'Khởi chạy',
    'profile.stop': 'Dừng',
    'profile.notSet': 'Chưa đặt',
    'profile.headless': 'Headless:',
    'profile.engine': 'Engine:',
    'profile.proxy': 'Proxy:',
    'profile.os': 'HĐH:',
    'profile.browser': 'Trình duyệt:',
    'profile.resolution': 'Độ phân giải:',
    'profile.language': 'Ngôn ngữ:',
    'profile.created': 'Tạo lúc:',

    // ProfileList table columns
    'pl.col.noId': 'Số/ID',
    'pl.col.group': 'Nhóm',
    'pl.col.name': 'Tên',
    'pl.col.ip': 'IP',
    'pl.col.lastOp': 'Thao tác cuối',
    'pl.col.platform': 'Nền tảng',
    'pl.col.action': 'Hành động',

    // ProfileList search & filter
    'pl.search.placeholder': 'Tìm theo tên hoặc ID...',
    'pl.filter.allStatus': 'Mọi trạng thái',
    'pl.filter.running': 'Đang chạy',
    'pl.filter.stopped': 'Đã dừng',
    'pl.filter.allProxy': 'Mọi Proxy',
    'pl.filter.hasProxy': 'Có Proxy',
    'pl.filter.noProxy': 'Không Proxy',
    'pl.filter.clear': 'Xóa',

    // Profile Form
    'profileForm.header.create': 'Tạo Profile Mới',
    'profileForm.header.edit': 'Sửa Profile',
    'profileForm.randomize': 'Ngẫu nhiên',
    'profileForm.save': 'Lưu',
    'profileForm.create': 'Tạo',
    'profileForm.cancel': 'Đóng',

    // ProfileForm tabs
    'pf.tab.general': 'Tổng quát',
    'pf.tab.proxy': 'Proxy',
    'pf.tab.platform': 'Nền tảng',
    'pf.tab.fingerprint': 'Fingerprint',
    'pf.tab.advanced': 'Nâng cao',

    // General section
    'pf.name': 'Name',
    'pf.name.ph': 'Optional: tên profile',
    'pf.browser': 'Browser',
    'pf.ua': 'User-Agent',
    'pf.group': 'Group',
    'pf.cookie': 'Cookie',
    'pf.remark': 'Remark',
    'pf.remark.ph': 'Nhập ghi chú',

    // Proxy section
    'pf.proxy.type': 'Proxy type',
    'pf.proxy.ipChecker': 'IP checker',

    // Platform section
    'pf.platform': 'Platform',
    'pf.tabs': 'Tabs',

    // Advanced section
    'pf.adv.extension': 'Extension',

    // Fingerprint section
    'pf.fp.title': 'Browser Fingerprint (Antidetect)',
    'pf.fp.preset': 'Fingerprint Preset',
    'pf.fp.suggestions': 'Gợi ý đã tạo…',
    'pf.fp.customPresets': 'Preset tuỳ chỉnh',
    'pf.fp.regenerate': 'Tạo lại gợi ý',
    'pf.fp.savePreset': 'Lưu cấu hình hiện tại',
    'pf.fp.presetHint': 'Chọn nhanh fingerprint gợi ý; có thể tinh chỉnh bên dưới.',
    'pf.fp.os': 'Hệ điều hành',
    'pf.fp.os.hint': 'Ảnh hưởng tới userAgent.',
    'pf.fp.browser': 'Trình duyệt',
    'pf.fp.browser.hint': 'Chọn trình duyệt mô phỏng.',
    'pf.fp.browserVer': 'Phiên bản',
    'pf.fp.browserVer.hint': 'Phiên bản trong userAgent.',
    'pf.fp.ua': 'User Agent Override',
    'pf.fp.ua.hint': 'Bỏ chọn để dùng UA mặc định.',
    'pf.fp.ua.str': 'User Agent String',
    'pf.fp.ua.copy': 'Copy UA',
    'pf.fp.lang': 'Language Override',
    'pf.fp.lang.hint': 'Bỏ chọn để dùng ngôn ngữ gốc.',
    'pf.fp.lang.primary': 'Ngôn ngữ chính',
    'pf.fp.tz': 'Timezone Override',
    'pf.fp.tz.hint': 'Bỏ chọn để dùng múi giờ hệ thống.',
    'pf.fp.tz.label': 'Múi giờ',
    'pf.fp.tz.matchHint': 'Nên phù hợp với vị trí / Proxy.',
    'pf.fp.vp': 'Viewport & DPR Override',
    'pf.fp.vp.hint': 'Bỏ chọn để dùng kích thước mặc định.',
    'pf.fp.vp.res': 'Độ phân giải',
    'pf.fp.features': 'Tính năng nâng cao',
    'pf.fp.features.hint': 'Bật/tắt các API vân tay (WebGL, Canvas, Audio).',

    // Environment section
    'pf.env.title': 'Môi trường & Bảo mật',
    'pf.env.hw': 'Hardware Concurrency & Memory',
    'pf.env.hw.hint': 'Bỏ chọn để giữ navigator thực tế.',
    'pf.env.cpu': 'CPU Cores',
    'pf.env.mem': 'Memory (GB)',
    'pf.env.proxy': 'Proxy',
    'pf.env.proxy.hint': 'Áp dụng cho toàn bộ profile.',
    'pf.env.webrtc': 'WebRTC Policy',
    'pf.env.webrtc.hint': 'proxy_only giúp hạn chế rò rỉ IP.',
    'pf.env.media': 'Thiết bị phương tiện',
    'pf.env.media.hint': 'Quyền thiết bị ghi âm/ghi hình.',
    'pf.env.geo': 'Geolocation Override',
    'pf.env.geo.hint': 'Bỏ chọn để không set toạ độ.',
    'pf.env.geo.coordHint': 'Chỉ áp dụng nếu có toạ độ hợp lệ.',

    // Advanced section
    'pf.adv.title': 'Anti-Detect nâng cao',
    'pf.adv.nav': 'Navigator Properties Override',
    'pf.adv.nav.hint': 'Bỏ chọn để giữ nguyên platform, touchPoints, dnt…',
    'pf.adv.dpr': 'Device Pixel Ratio Override',
    'pf.adv.dpr.hint': 'Thuộc viewport; bỏ chọn để trả về DPR thực tế.',
    'pf.adv.webgl': 'WebGL Vendor/Renderer Override',
    'pf.adv.webgl.hint': 'Bỏ chọn để giữ GPU renderer gốc.',

    // Settings
    'settings.title': 'Cài đặt',
    'settings.apiServer': 'Máy chủ API',
    'settings.status': 'Trạng thái',
    'settings.port': 'Cổng',
    'settings.control': 'Điều khiển',
    'settings.start': 'Khởi động',
    'settings.stop': 'Dừng',
    'settings.restart': 'Khởi động lại',
    'settings.apiDocs': 'Tài liệu API',
    'settings.running': 'Đang chạy',
    'settings.stopped': 'Đã dừng',

    // Scripts
    'scripts.title': 'Kịch bản tự động',
    'scripts.new': 'Kịch bản mới',
    'scripts.filter': 'Tìm theo tên',
    'scripts.selectProfile': 'Chọn profile để chạy',
    'scripts.noScripts': 'Chưa có kịch bản',
    'scripts.edit': 'Sửa',
    'scripts.run': 'Chạy',
    'scripts.name': 'Tên',
    'scripts.description': 'Mô tả',
    'scripts.code': 'Code (async JS)',
    'scripts.save': 'Lưu',
    'scripts.cancel': 'Huỷ',

    // Cookies
    'cookies.title': 'Cookie của:',
    'cookies.saved': 'Cookie đã lưu',
    'cookies.export': 'Xuất',
    'cookies.import': 'Nhập',
    'cookies.copyJson': 'Sao chép JSON',
    'cookies.importBtn': 'Nhập Cookie',
    'cookies.placeholder': 'Dán mảng JSON cookie vào đây',
    'cookies.loading': 'Đang tải cookie...',
    'cookies.empty': 'Chưa có cookie',
    'cookies.name': 'Tên',
    'cookies.domain': 'Domain',
    'cookies.path': 'Đường dẫn',
    'cookies.expires': 'Hết hạn',

    // Logs
    'logs.title': 'Nhật ký:',
    'logs.copy': 'Sao chép',
    'logs.empty': 'Chưa có nhật ký',

    // API password modal
    'api.password.title': 'Nhập mật khẩu để khởi động API',
    'api.password.prompt': 'Vui lòng nhập mật khẩu API',
    'api.password.start': 'Khởi động',
    'api.status.running': 'API: Đang chạy',
    'api.status.stopped': 'API: Đã dừng',
    'api.status.error': 'API: Lỗi',

    // Automation (ProfileForm section)
    'automation.section': 'Tự động hoá',
    'automation.enabled': 'Bật tự động hoá',
    'automation.runOnLaunch': 'Chạy steps sau khi launch',
    'automation.schedule': 'Lịch (cron)',
    'automation.schedule.enabled': 'Bật lịch lặp lại',
    'automation.steps': 'Steps (JSON)',
    'automation.hint.schedule': 'Biểu thức cron 5 phần, ví dụ: */5 * * * * (mỗi 5 phút). Để trống nếu không dùng.',
    'automation.hint.steps': 'Mảng JSON các steps: navigate|wait|eval. Ví dụ: [{"action":"navigate","url":"https://example.com"}]',
  },
  en: {
    'app.title': 'OBT Automation Antidetect Browser',
    'app.subtitle': 'Manage browser profiles with fingerprint spoofing',

    // Sidebar
    'nav.navigation': 'Navigation',
    'nav.profiles': 'Profiles',
    'nav.scripts': 'Scripts',
    'nav.settings': 'Settings',
    'nav.language': 'Language',
    'nav.theme': 'Theme',

    // Language
    'lang.vi': '🇻🇳 Tiếng Việt',
    'lang.en': '🇬🇧 English',

    // Actions (toolbar / bulk)
    'actions.selectAll': 'Select All',
    'actions.clear': 'Clear',
    'actions.startSelected': 'Start',
    'actions.stopSelected': 'Stop',
    'actions.deleteSelected': 'Delete',
    'actions.create': 'Create Profile',
    'actions.newProfile': 'New Profile',
    'actions.selected': 'selected',

    // Profile List
    'profiles.title': 'Profiles',
    'profiles.count': 'profile(s)',
    'profiles.empty.title': 'No profiles yet',
    'profiles.empty.desc': 'Create your first browser profile to get started',
    'profiles.empty.btn': 'Create Profile',

    // Profile Card
    'profile.status.running': 'Running',
    'profile.status.stopped': 'Stopped',
    'profile.edit': 'Edit',
    'profile.clone': 'Clone',
    'profile.cookies': 'Cookies',
    'profile.logs': 'Logs',
    'profile.copyWs': 'Copy WS',
    'profile.delete': 'Delete',
    'profile.launch': 'Launch',
    'profile.stop': 'Stop',
    'profile.notSet': 'Not set',
    'profile.headless': 'Headless:',
    'profile.engine': 'Engine:',
    'profile.proxy': 'Proxy:',
    'profile.os': 'OS:',
    'profile.browser': 'Browser:',
    'profile.resolution': 'Resolution:',
    'profile.language': 'Language:',
    'profile.created': 'Created:',

    // ProfileList table columns
    'pl.col.noId': 'No./ID',
    'pl.col.group': 'Group',
    'pl.col.name': 'Name',
    'pl.col.ip': 'IP',
    'pl.col.lastOp': 'Last op.',
    'pl.col.platform': 'Platform',
    'pl.col.action': 'Action',

    // ProfileList search & filter
    'pl.search.placeholder': 'Search by name or ID...',
    'pl.filter.allStatus': 'All Status',
    'pl.filter.running': 'Running',
    'pl.filter.stopped': 'Stopped',
    'pl.filter.allProxy': 'All Proxy',
    'pl.filter.hasProxy': 'Has Proxy',
    'pl.filter.noProxy': 'No Proxy',
    'pl.filter.clear': 'Clear',

    // Profile Form
    'profileForm.header.create': 'Create New Profile',
    'profileForm.header.edit': 'Edit Profile',
    'profileForm.randomize': 'Randomize',
    'profileForm.save': 'Save',
    'profileForm.create': 'Create',
    'profileForm.cancel': 'Close',

    // ProfileForm tabs
    'pf.tab.general': 'General',
    'pf.tab.proxy': 'Proxy',
    'pf.tab.platform': 'Platform',
    'pf.tab.fingerprint': 'Fingerprint',
    'pf.tab.advanced': 'Advanced',

    // General section
    'pf.name': 'Name',
    'pf.name.ph': 'Optional: profile name',
    'pf.browser': 'Browser',
    'pf.ua': 'User-Agent',
    'pf.group': 'Group',
    'pf.cookie': 'Cookie',
    'pf.remark': 'Remark',
    'pf.remark.ph': 'Enter remark',

    // Proxy section
    'pf.proxy.type': 'Proxy type',
    'pf.proxy.ipChecker': 'IP checker',

    // Platform section
    'pf.platform': 'Platform',
    'pf.tabs': 'Tabs',

    // Advanced section
    'pf.adv.extension': 'Extension',

    // Fingerprint section
    'pf.fp.title': 'Browser Fingerprint (Antidetect)',
    'pf.fp.preset': 'Fingerprint Preset',
    'pf.fp.suggestions': 'Generated suggestions…',
    'pf.fp.customPresets': 'Custom presets',
    'pf.fp.regenerate': 'Regenerate suggestions',
    'pf.fp.savePreset': 'Save current config',
    'pf.fp.presetHint': 'Quick-select a fingerprint suggestion; fine-tune below.',
    'pf.fp.os': 'Operating System',
    'pf.fp.os.hint': 'Affects userAgent string.',
    'pf.fp.browser': 'Browser',
    'pf.fp.browser.hint': 'Select browser to emulate.',
    'pf.fp.browserVer': 'Version',
    'pf.fp.browserVer.hint': 'Version in userAgent.',
    'pf.fp.ua': 'User Agent Override',
    'pf.fp.ua.hint': 'Uncheck to use default UA.',
    'pf.fp.ua.str': 'User Agent String',
    'pf.fp.ua.copy': 'Copy UA',
    'pf.fp.lang': 'Language Override',
    'pf.fp.lang.hint': 'Uncheck to use default browser language.',
    'pf.fp.lang.primary': 'Primary Language',
    'pf.fp.tz': 'Timezone Override',
    'pf.fp.tz.hint': 'Uncheck to use system timezone.',
    'pf.fp.tz.label': 'Timezone',
    'pf.fp.tz.matchHint': 'Should match location / Proxy.',
    'pf.fp.vp': 'Viewport & DPR Override',
    'pf.fp.vp.hint': 'Uncheck to use default size.',
    'pf.fp.vp.res': 'Screen Resolution',
    'pf.fp.features': 'Advanced Features',
    'pf.fp.features.hint': 'Toggle fingerprint APIs (WebGL, Canvas, Audio).',

    // Environment section
    'pf.env.title': 'Environment & Privacy',
    'pf.env.hw': 'Hardware Concurrency & Memory',
    'pf.env.hw.hint': 'Uncheck to keep real navigator values.',
    'pf.env.cpu': 'CPU Cores',
    'pf.env.mem': 'Memory (GB)',
    'pf.env.proxy': 'Proxy',
    'pf.env.proxy.hint': 'Apply to entire profile.',
    'pf.env.webrtc': 'WebRTC Policy',
    'pf.env.webrtc.hint': 'proxy_only limits IP leaks via UDP.',
    'pf.env.media': 'Media Devices',
    'pf.env.media.hint': 'Microphone/Camera permissions when requested.',
    'pf.env.geo': 'Geolocation Override',
    'pf.env.geo.hint': 'Uncheck to skip geolocation override.',
    'pf.env.geo.coordHint': 'Only applies with valid coordinates.',

    // Advanced section
    'pf.adv.title': 'Advanced Anti-Detect Metrics',
    'pf.adv.nav': 'Navigator Properties Override',
    'pf.adv.nav.hint': 'Uncheck to keep platform, touchPoints, dnt…',
    'pf.adv.dpr': 'Device Pixel Ratio Override',
    'pf.adv.dpr.hint': 'Viewport-related; uncheck for real DPR.',
    'pf.adv.webgl': 'WebGL Vendor/Renderer Override',
    'pf.adv.webgl.hint': 'Uncheck to keep native GPU renderer.',

    // Settings
    'settings.title': 'Settings',
    'settings.apiServer': 'API Server',
    'settings.status': 'Status',
    'settings.port': 'Port',
    'settings.control': 'Control',
    'settings.start': 'Start',
    'settings.stop': 'Stop',
    'settings.restart': 'Restart',
    'settings.apiDocs': 'API Docs',
    'settings.running': 'Running',
    'settings.stopped': 'Stopped',

    // Scripts
    'scripts.title': 'Automation Scripts',
    'scripts.new': 'New Script',
    'scripts.filter': 'Filter by name',
    'scripts.selectProfile': 'Select profile to run',
    'scripts.noScripts': 'No scripts',
    'scripts.edit': 'Edit',
    'scripts.run': 'Run',
    'scripts.name': 'Name',
    'scripts.description': 'Description',
    'scripts.code': 'Code (async JS)',
    'scripts.save': 'Save',
    'scripts.cancel': 'Cancel',

    // Cookies
    'cookies.title': 'Cookies for:',
    'cookies.saved': 'Saved Cookies',
    'cookies.export': 'Export',
    'cookies.import': 'Import',
    'cookies.copyJson': 'Copy JSON',
    'cookies.importBtn': 'Import Cookies',
    'cookies.placeholder': 'Paste cookies JSON array here',
    'cookies.loading': 'Loading cookies...',
    'cookies.empty': 'No cookies saved',
    'cookies.name': 'Name',
    'cookies.domain': 'Domain',
    'cookies.path': 'Path',
    'cookies.expires': 'Expires',

    // Logs
    'logs.title': 'Logs:',
    'logs.copy': 'Copy',
    'logs.empty': 'No logs yet',

    // API password modal
    'api.password.title': 'Enter password to start API',
    'api.password.prompt': 'Please enter the API password',
    'api.password.start': 'Start',
    'api.status.running': 'API: Running',
    'api.status.stopped': 'API: Stopped',
    'api.status.error': 'API: Error',

    // Automation (ProfileForm section)
    'automation.section': 'Automation',
    'automation.enabled': 'Enable automation',
    'automation.runOnLaunch': 'Run steps after launch',
    'automation.schedule': 'Schedule (cron)',
    'automation.schedule.enabled': 'Enable recurring schedule',
    'automation.steps': 'Steps (JSON)',
    'automation.hint.schedule': 'Cron expression (5 fields), e.g. */5 * * * * (every 5 min). Leave blank if not used.',
    'automation.hint.steps': 'JSON array of steps: navigate|wait|eval. Example: [{"action":"navigate","url":"https://example.com"}]',
  }
};

const I18nContext = createContext({ lang: 'vi', setLang: () => { }, t: (k, d) => d || k });

export function I18nProvider({ children }) {
  const [lang, setLang] = useState('vi');

  // Load persisted language from settings
  useEffect(() => {
    (async () => {
      try {
        const res = await window.electronAPI?.loadSettings?.();
        const stored = res?.success ? (res.settings?.language || res.settings?.appLanguage) : null;
        if (stored && (stored === 'vi' || stored === 'en')) setLang(stored);
      } catch { }
    })();
  }, []);

  // Persist on change and update <html lang>
  useEffect(() => {
    try { document.documentElement.setAttribute('lang', lang); } catch { }
    (async () => { try { await window.electronAPI?.saveSettings?.({ appLanguage: lang }); } catch { } })();
  }, [lang]);

  const t = useMemo(() => {
    return (key, def) => {
      const dict = messages[lang] || messages.vi;
      return (dict && dict[key]) || def || key;
    };
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);
  return React.createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() { return useContext(I18nContext); }
