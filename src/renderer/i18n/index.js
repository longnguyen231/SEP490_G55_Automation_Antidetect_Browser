import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const messages = {
  vi: {
    'app.title': '🔒 OBT Automation Antidetect Browser',
    'app.subtitle': 'Quản lý hồ sơ trình duyệt với chống nhận diện',
    'app.header.count': 'Hồ sơ trình duyệt',
    'actions.selectAll': 'Chọn tất cả',
    'actions.clear': 'Bỏ chọn',
    'actions.startSelected': 'Chạy mục đã chọn',
    'actions.stopSelected': 'Dừng mục đã chọn',
    'actions.deleteSelected': '🗑️ Xoá mục đã chọn',
    'actions.create': '+ Tạo profile mới',
    'lang.vi': 'Tiếng Việt',
    'lang.en': 'English',

  // API server password modal
  'api.password.title': 'Nhập mật khẩu để khởi động API',
  'api.password.prompt': 'Vui lòng nhập mật khẩu API',
  'api.password.setAndStart': 'Đặt mật khẩu và khởi động',
  'api.password.start': 'Khởi động',

    'profileForm.header.create': 'Tạo Profile Mới',
    'profileForm.header.edit': 'Sửa Profile',
    'profileForm.randomize': '🔀 Ngẫu nhiên',
    'profileForm.save': 'Lưu',
    'profileForm.create': 'Tạo',
    'profileForm.cancel': 'Đóng',
    // Automation
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
    'app.title': '🔒 OBT Automation Antidetect Browser',
    'app.subtitle': 'Manage browser profiles with fingerprint spoofing',
    'app.header.count': 'Browser Profiles',
    'actions.selectAll': 'Select All',
    'actions.clear': 'Clear',
    'actions.startSelected': 'Start Selected',
    'actions.stopSelected': 'Stop Selected',
    'actions.deleteSelected': '🗑️ Delete Selected',
    'actions.create': '+ Create New Profile',
    'lang.vi': 'Vietnamese',
    'lang.en': 'English',

  // API server password modal
  'api.password.title': 'Enter password to start API',
  'api.password.prompt': 'Please enter the API password',
  'api.password.setAndStart': 'Set password and start',
  'api.password.start': 'Start',

    'profileForm.header.create': 'Create New Profile',
    'profileForm.header.edit': 'Edit Profile',
    'profileForm.randomize': '🔀 Randomize',
    'profileForm.save': 'Save',
    'profileForm.create': 'Create',
    'profileForm.cancel': 'Close',
    // Automation
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

const I18nContext = createContext({ lang: 'vi', setLang: () => {}, t: (k, d) => d || k });

export function I18nProvider({ children }) {
  const [lang, setLang] = useState('vi');

  // Load persisted language from settings
  useEffect(() => {
    (async () => {
      try {
        const res = await window.electronAPI?.loadSettings?.();
        const stored = res?.success ? (res.settings?.language || res.settings?.appLanguage) : null;
        if (stored && (stored === 'vi' || stored === 'en')) setLang(stored);
      } catch {}
    })();
  }, []);

  // Persist on change and update <html lang>
  useEffect(() => {
    try { document.documentElement.setAttribute('lang', lang); } catch {}
    (async () => { try { await window.electronAPI?.saveSettings?.({ appLanguage: lang }); } catch {} })();
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
