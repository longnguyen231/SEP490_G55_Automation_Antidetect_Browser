import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/PageHeader';
import { useAdminApi } from '../../hooks/useAdminApi';

const PLATFORM_LABEL = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  portable: 'Portable',
  unknown: 'Other',
};

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function Releases() {
  const { listReleases, uploadRelease, deleteRelease } = useAdminApi();
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const refresh = async () => {
    try {
      const data = await listReleases();
      setReleases(data.releases || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const handleFilePick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    // Infer version from filename (e.g. "HL-MCK Antidetect Browser Setup 1.0.0.exe")
    if (!version) {
      const m = /(\d+\.\d+\.\d+(?:[-.][\w.]+)?)/.exec(f.name);
      if (m) setVersion(m[1]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Chọn file .exe trước');
    setUploading(true);
    setProgress(0);
    try {
      await uploadRelease(file, {
        version: version.trim(),
        notes: notes.trim(),
        onProgress: (r) => setProgress(r),
      });
      toast.success('Đã upload bản cài đặt');
      setFile(null);
      setNotes('');
      setProgress(0);
      await refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa bản build này?')) return;
    try {
      await deleteRelease(id);
      toast.success('Đã xóa');
      await refresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader title="Builds & Releases" description="Upload và quản lý file cài đặt cho người dùng tải về" />

      {/* Upload form */}
      <form onSubmit={handleUpload} className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 max-w-3xl">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Upload bản build mới</h3>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">File cài đặt</label>
            <input
              type="file"
              accept=".exe,.zip,.dmg,.AppImage,.deb,.rpm,.msi"
              onChange={handleFilePick}
              disabled={uploading}
              className="w-full text-sm text-slate-700 dark:text-slate-200 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white file:font-semibold hover:file:brightness-110"
            />
            {file && (
              <p className="text-xs text-slate-400 mt-1">{file.name} — {formatBytes(file.size)}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Version</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
              disabled={uploading}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 w-full focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Ghi chú (tùy chọn)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={2000}
            disabled={uploading}
            placeholder="Release notes, changelog..."
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary"
          />
        </div>

        {uploading && (
          <div className="space-y-1">
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="text-xs text-slate-400">Đang upload... {Math.round(progress * 100)}%</p>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !file}
          className="bg-primary hover:brightness-110 text-white font-semibold px-6 py-2.5 rounded-lg transition-all disabled:opacity-50 text-sm"
        >
          {uploading ? 'Đang upload...' : 'Upload'}
        </button>
      </form>

      {/* List */}
      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-w-5xl">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Bản build đã upload</h3>
          <span className="text-xs text-slate-400">{releases.length} file</span>
        </div>

        {loading ? (
          <p className="text-slate-400 text-sm py-8 text-center">Đang tải...</p>
        ) : releases.length === 0 ? (
          <p className="text-slate-400 text-sm py-8 text-center">Chưa có bản build nào. Upload file đầu tiên ở trên.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-6 py-3">Version</th>
                  <th className="text-left px-6 py-3">Platform</th>
                  <th className="text-left px-6 py-3">File</th>
                  <th className="text-right px-6 py-3">Size</th>
                  <th className="text-left px-6 py-3">Created</th>
                  <th className="text-right px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {releases.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-6 py-3 font-semibold text-slate-800 dark:text-slate-100">{r.version || '—'}</td>
                    <td className="px-6 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {PLATFORM_LABEL[r.platform] || r.platform}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-600 dark:text-slate-300 break-all max-w-md">{r.fileName}</td>
                    <td className="px-6 py-3 text-right text-slate-500">{formatBytes(r.size)}</td>
                    <td className="px-6 py-3 text-slate-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">
                      <a
                        href={r.downloadUrl}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline mr-3"
                      >
                        <span className="material-symbols-outlined text-sm">download</span>
                        Tải về
                      </a>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-rose-500 hover:underline"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
