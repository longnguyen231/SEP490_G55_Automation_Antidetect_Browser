import React, { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { useAdminApi } from '../../hooks/useAdminApi';
import toast from 'react-hot-toast';

const GITHUB_BASE = 'https://github.com/OngBanTat/ObtAutomationAntidetectBrowser/releases/latest/download';

const DEFAULT_DOWNLOAD_URLS = {
  windows: `${GITHUB_BASE}/HL-MCK.Antidetect.Browser.Setup.exe`,
  portable: `${GITHUB_BASE}/HL-MCK.Antidetect.Browser.Portable.zip`,
  linux: `${GITHUB_BASE}/HL-MCK.Antidetect.Browser.AppImage`,
  macos: `${GITHUB_BASE}/HL-MCK.Antidetect.Browser.dmg`,
};

export default function Config() {
  const { getConfig, saveConfig } = useAdminApi();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [downloadUrls, setDownloadUrls] = useState({ ...DEFAULT_DOWNLOAD_URLS });
  const [appVersion, setAppVersion] = useState('1.0.0');

  useEffect(() => {
    getConfig()
      .then(c => {
        setConfig(c);
        setForm(c);
        if (c.downloadUrls) {
          setDownloadUrls({ ...DEFAULT_DOWNLOAD_URLS, ...c.downloadUrls });
        }
        if (c.appVersion) setAppVersion(c.appVersion);
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Filter out empty download URLs (keep defaults for empties)
      const filteredUrls = Object.fromEntries(
        Object.entries(downloadUrls).filter(([, v]) => v.trim())
      );
      const updated = await saveConfig({
        proPriceVnd: parseInt(form.proPriceVnd, 10),
        maintenanceMode: form.maintenanceMode,
        maintenanceBanner: form.maintenanceBanner || '',
        downloadUrls: filteredUrls,
        appVersion: appVersion.trim() || '1.0.0',
      });
      setConfig(updated);
      setForm(updated);
      toast.success('Đã lưu cấu hình');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Đang tải...</div>;

  return (
    <>
      <PageHeader title="Cấu hình hệ thống" description="Download links, maintenance mode, giá" />

      <form onSubmit={handleSave} className="max-w-2xl space-y-6">

        {/* Download links */}
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Download Links</h3>
            <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
              /api/download/:platform
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Để trống để dùng mặc định (GitHub Releases). Điền URL trực tiếp nếu host file ở chỗ khác.
          </p>

          <div className="grid gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Version
              </label>
              <input
                type="text"
                value={appVersion}
                onChange={e => setAppVersion(e.target.value)}
                placeholder="1.0.0"
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 w-40 focus:outline-none focus:border-primary"
              />
            </div>

            {[
              { key: 'windows', label: 'Windows (.exe)', icon: 'desktop_windows' },
              { key: 'portable', label: 'Portable (.zip)', icon: 'folder_zip' },
              { key: 'linux', label: 'Linux (.AppImage)', icon: 'terminal' },
              { key: 'macos', label: 'macOS (.dmg)', icon: 'laptop_mac' },
            ].map(({ key, label, icon }) => (
              <div key={key}>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  <span className="material-symbols-outlined text-sm">{icon}</span>
                  {label}
                </label>
                <input
                  type="url"
                  value={downloadUrls[key] || ''}
                  onChange={e => setDownloadUrls(u => ({ ...u, [key]: e.target.value }))}
                  placeholder={DEFAULT_DOWNLOAD_URLS[key]}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary font-mono text-xs"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Pro price */}
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            Giá Pro License
            <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full font-normal">Thanh toán tạm tắt</span>
          </h3>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Giá (VND)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1000"
                step="1000"
                value={form.proPriceVnd || ''}
                onChange={e => setForm(f => ({ ...f, proPriceVnd: e.target.value }))}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 w-40 focus:outline-none focus:border-primary"
              />
              <span className="text-sm text-slate-400">₫ = {new Intl.NumberFormat('vi-VN').format(form.proPriceVnd || 0)}₫</span>
            </div>
          </div>
        </div>

        {/* Maintenance mode */}
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Maintenance Mode</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setForm(f => ({ ...f, maintenanceMode: !f.maintenanceMode }))}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${form.maintenanceMode ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.maintenanceMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {form.maintenanceMode ? <span className="text-rose-400 font-semibold">Đang bảo trì</span> : 'Off'}
            </span>
          </label>
          {form.maintenanceMode && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Banner thông báo</label>
              <input
                type="text"
                value={form.maintenanceBanner || ''}
                onChange={e => setForm(f => ({ ...f, maintenanceBanner: e.target.value }))}
                placeholder="Hệ thống đang bảo trì, vui lòng quay lại sau..."
                maxLength={200}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary"
              />
            </div>
          )}
        </div>

        {/* PayOS Webhook (read-only, will be re-enabled when payment is turned on) */}
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3 opacity-50">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            PayOS Webhook URL
            <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full font-normal">Disabled</span>
          </h3>
          <p className="text-xs text-slate-400">Cấu hình trong file <code className="text-primary">.env</code> → <code>PAYOS_WEBHOOK_URL</code></p>
          <code className="block text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-500 break-all">
            {config?.payosWebhookUrl || '(chưa cấu hình)'}
          </code>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-primary hover:brightness-110 text-white font-semibold px-6 py-2.5 rounded-lg transition-all disabled:opacity-50 text-sm"
        >
          {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>
      </form>
    </>
  );
}
