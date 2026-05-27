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

// Group releases by version to find which is truly latest per platform
function getLatestIds(releases) {
  const seen = {};
  for (const r of releases) {
    const key = r.platform || 'unknown';
    if (!seen[key]) seen[key] = r.id; // list is already sorted newest-first
  }
  return new Set(Object.values(seen));
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
    if (!file) return toast.error('Please select a file first');
    setUploading(true);
    setProgress(0);
    try {
      await uploadRelease(file, {
        version: version.trim(),
        notes: notes.trim(),
        onProgress: (r) => setProgress(r),
      });
      toast.success('Build uploaded successfully');
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
    if (!confirm('Delete this build?')) return;
    try {
      await deleteRelease(id);
      toast.success('Deleted');
      await refresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader title="Builds & Releases" description="Upload and manage installer files for users to download" />

      {/* Upload form */}
      <form onSubmit={handleUpload} className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 max-w-3xl">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Upload new build</h3>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Installer file</label>
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
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Notes (optional)</label>
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
            <p className="text-xs text-slate-400">Uploading... {Math.round(progress * 100)}%</p>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !file}
          className="bg-primary hover:brightness-110 text-white font-semibold px-6 py-2.5 rounded-lg transition-all disabled:opacity-50 text-sm"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>

      {/* List */}
      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-w-5xl">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Uploaded builds</h3>
          <span className="text-xs text-slate-400">{releases.length} file</span>
        </div>

        {loading ? (
          <p className="text-slate-400 text-sm py-8 text-center">Loading...</p>
        ) : releases.length === 0 ? (
          <p className="text-slate-400 text-sm py-8 text-center">No builds yet. Upload the first file above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-6 py-3">Version</th>
                  <th className="text-left px-6 py-3">Platform</th>
                  <th className="text-left px-6 py-3">File</th>
                  <th className="text-left px-6 py-3">Notes</th>
                  <th className="text-right px-6 py-3">Size</th>
                  <th className="text-left px-6 py-3">Created</th>
                  <th className="text-right px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(() => {
                  const latestIds = getLatestIds(releases);
                  return releases.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">{r.version || '—'}</span>
                          {latestIds.has(r.id) && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 leading-none">
                              LATEST
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {PLATFORM_LABEL[r.platform] || r.platform}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-slate-600 dark:text-slate-300 max-w-[180px] truncate" title={r.fileName}>
                        {r.fileName}
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-500 max-w-[180px]">
                        {r.notes ? (
                          <span className="truncate block" title={r.notes}>{r.notes}</span>
                        ) : (
                          <span className="text-slate-700 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-500 whitespace-nowrap">{formatBytes(r.size)}</td>
                      <td className="px-6 py-3 text-slate-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                      <td className="px-6 py-3 text-right whitespace-nowrap space-x-3">
                        <a
                          href={r.downloadUrl}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <span className="material-symbols-outlined text-sm">download</span>
                          Download
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(r.downloadUrl);
                            toast.success('Download link copied!');
                          }}
                          title="Copy download link"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:underline"
                        >
                          <span className="material-symbols-outlined text-sm">content_copy</span>
                          Copy link
                        </button>
                        {r.sha256 && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(r.sha256);
                              toast.success('SHA256 copied!');
                            }}
                            title={`SHA256: ${r.sha256}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:underline"
                          >
                            <span className="material-symbols-outlined text-sm">fingerprint</span>
                            SHA256
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-500 hover:underline"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
