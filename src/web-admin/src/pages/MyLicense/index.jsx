/**
 * MyLicense/index.jsx
 *
 * User page to view their license request status and copy JWT key.
 * Uses date-fns for formatting, lucide-react icons, react-hot-toast.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  ArrowLeft,
  Copy,
  CheckCircle2,
  Clock,
  XCircle,
  KeyRound,
  RefreshCw,
  ExternalLink,
  Monitor,
} from 'lucide-react';
import { ConfigProvider, theme } from 'antd';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { useLicenseStore } from '../../store/licenseStore';
import { TIER_CONFIG } from '../../services/licenseService';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatTs(ts) {
  if (!ts) return '—';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  return format(date, 'dd/MM/yyyy HH:mm', { locale: vi });
}

function calcExpiry(approvedAt, durationDays) {
  if (!approvedAt || durationDays === null) return null; // lifetime
  const base = approvedAt?.toDate ? approvedAt.toDate() : new Date(approvedAt);
  const expiry = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);
  return expiry;
}

// ─── Status Card ──────────────────────────────────────────────────────────────
function StatusIcon({ status }) {
  if (status === 'approved') return <CheckCircle2 size={20} className="text-emerald-400" />;
  if (status === 'rejected') return <XCircle size={20} className="text-rose-400" />;
  return <Clock size={20} className="text-amber-400" />;
}

// ─── Single License Card ──────────────────────────────────────────────────────
function LicenseCard({ request }) {
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const tierCfg = TIER_CONFIG[request.approvedTier || request.requestedTier] || {};
  const expiry = calcExpiry(request.approvedAt, request.durationDays);

  const handleCopy = async () => {
    if (!request.jwt) return;
    try {
      await navigator.clipboard.writeText(request.jwt);
      setCopied(true);
      toast.success('Đã copy JWT license key!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Không thể copy. Hãy copy thủ công.');
    }
  };

  const isApproved = request.status === 'approved';
  const isPending = request.status === 'pending';
  const isRejected = request.status === 'rejected';

  return (
    <div
      className={`rounded-2xl border p-6 ${
        isApproved
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : isPending
            ? 'border-amber-400/30 bg-amber-400/5'
            : 'border-rose-500/20 bg-rose-500/5'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <StatusIcon status={request.status} />
          <div>
            <p className="text-sm font-bold text-white">
              {isApproved ? 'License approved' : isPending ? 'Pending review' : 'Request rejected'}
            </p>
            <p className="text-xs text-slate-400">Submitted {formatTs(request.createdAt)}</p>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${tierCfg.badge || 'bg-slate-700 text-slate-400'}`}
        >
          {tierCfg.label || request.requestedTier}
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/30">
            <p className="text-xs text-slate-500 mb-1">Requested plan</p>
          <p className={`text-sm font-semibold ${TIER_CONFIG[request.requestedTier]?.color || 'text-white'}`}>
            {TIER_CONFIG[request.requestedTier]?.label || request.requestedTier}
          </p>
        </div>

        {isApproved && (
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/30">
            <p className="text-xs text-slate-500 mb-1">Approved plan</p>
            <p className={`text-sm font-semibold ${tierCfg.color || 'text-white'}`}>
              {tierCfg.label || request.approvedTier}
            </p>
          </div>
        )}

        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/30">
            <p className="text-xs text-slate-500 mb-1">Duration</p>
            <p className="text-sm font-semibold text-white">
              {request.durationDays === null ? 'Lifetime' : `${request.durationDays} days`}
          </p>
        </div>

        {isApproved && expiry && (
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/30">
            <p className="text-xs text-slate-500 mb-1">Expires</p>
            <p className="text-sm font-semibold text-white">{format(expiry, 'dd/MM/yyyy')}</p>
          </div>
        )}

        {isApproved && expiry === null && (
          <div className="p-3 rounded-xl bg-amber-400/10 border border-amber-400/20">
            <p className="text-xs text-amber-500 mb-1">Expires</p>
            <p className="text-sm font-semibold text-amber-400">Lifetime ∞</p>
          </div>
        )}

        {isApproved && (
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/30">
            <p className="text-xs text-slate-500 mb-1">Approved by</p>
            <p className="text-xs font-medium text-slate-300 truncate">{request.approvedBy}</p>
          </div>
        )}
      </div>

      {/* JWT Token (only if approved) */}
      {isApproved && request.jwt && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">JWT License Key</p>
            <button
              onClick={() => setShowFull((v) => !v)}
              className="text-xs text-slate-500 hover:text-primary transition-colors"
            >
              {showFull ? 'Collapse' : 'Show full'}
            </button>
          </div>

          <div className="relative">
            <div
              className={`rounded-xl border border-slate-700/50 bg-slate-900/70 px-4 py-3 font-mono text-xs text-slate-300 break-all
                ${!showFull ? 'max-h-16 overflow-hidden' : ''}`}
            >
              {request.jwt}
            </div>
            {!showFull && (
              <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-slate-900/70 rounded-b-xl" />
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-primary text-background-dark hover:bg-primary/90 shadow-md shadow-primary/20'
              }`}
            >
              <Copy size={15} />
              {copied ? 'Copied!' : 'Copy JWT Key'}
            </button>

            <a
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(request.jwt)}`}
              download={`license-${request.approvedTier}-${request.id.slice(0, 8)}.txt`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700/50
                text-slate-300 text-sm font-medium hover:border-primary/40 hover:text-primary transition-all"
            >
              <ExternalLink size={14} />
              Download
            </a>
          </div>
        </div>
      )}

      {/* Pending state UI */}
      {isPending && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-400/5 border border-amber-400/20">
          <Clock size={16} className="text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-300">
            Request is under review. Usually takes less than 24 hours. Your JWT key will appear here once approved.
          </p>
        </div>
      )}

      {/* Rejected state */}
      {isRejected && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
          <XCircle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-rose-300 font-medium">Request was rejected.</p>
            {request.rejectionReason && (
              <p className="text-xs text-slate-400 mt-0.5">Reason: {request.rejectionReason}</p>
            )}
            <Link to="/license-request" className="text-xs text-primary hover:underline mt-1 block">
              Submit a new request →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── How to activate instructions ─────────────────────────────────────────────
function ActivationGuide() {
  return (
    <div className="rounded-2xl border border-slate-700/40 bg-slate-800/30 p-6">
      <div className="flex items-center gap-2 mb-5">
        <Monitor size={18} className="text-primary" />
        <h3 className="font-bold text-white text-sm">How to Activate in the App</h3>
      </div>
      <ol className="space-y-3">
        {[
          { n: '1', text: 'Copy the JWT Key above using the "Copy JWT Key" button' },
          { n: '2', text: 'Open the Desktop App → click ⚙️ Settings' },
          { n: '3', text: 'Scroll to the License section → paste the JWT key into the input field' },
          { n: '4', text: 'Click "Activate" → wait for the success notification' },
          { n: '5', text: 'App reloads automatically → license is active, profile limit removed' },
        ].map(({ n, text }) => (
          <li key={n} className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
              {n}
            </span>
            <span className="text-sm text-slate-300">{text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MyLicense() {
  const { user } = useAuthStore();
  const { myRequests, myRequestsLoading, fetchMyRequests } = useLicenseStore();

  useEffect(() => {
    if (user?.id) fetchMyRequests(user.id);
  }, [user?.id, fetchMyRequests]);

  const hasApproved = myRequests.some((r) => r.status === 'approved');

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { colorPrimary: '#00bcd4', borderRadius: 8 },
      }}
    >
      <div className="min-h-screen bg-background-dark text-slate-100 font-display">
        {/* Navbar */}
        <header className="border-b border-slate-800/60 px-6 py-4 flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-400 hover:text-primary transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            Home
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-sm text-slate-300">My License</span>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-14">
          {/* Title */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <KeyRound size={20} className="text-primary" />
                <h1 className="text-2xl font-extrabold text-white tracking-tight">My License</h1>
              </div>
              <p className="text-slate-400 text-sm">
                Theo dõi trạng thái yêu cầu và lấy JWT key để kích hoạt app.
              </p>
            </div>
            <button
              onClick={() => fetchMyRequests(user?.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700/50
                text-slate-400 hover:text-primary text-sm transition-all"
            >
              <RefreshCw size={14} className={myRequestsLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Content */}
          {myRequestsLoading ? (
            <div className="text-center py-20">
              <RefreshCw size={22} className="animate-spin mx-auto mb-3 text-primary" />
              <p className="text-slate-500 text-sm">Đang tải...</p>
            </div>
          ) : myRequests.length === 0 ? (
            <div className="text-center py-20">
              <KeyRound size={40} className="mx-auto mb-4 text-slate-700" />
              <p className="text-slate-400 font-semibold mb-1">No license requests yet</p>
              <p className="text-slate-500 text-sm mb-6">Choose a plan and submit a request to receive a JWT license key.</p>
              <Link
                to="/license-request"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-background-dark
                  font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                <KeyRound size={16} />
                Request a License
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {myRequests.map((r) => (
                <LicenseCard key={r.id} request={r} />
              ))}

              {/* New request button */}
              <div className="flex items-center justify-between pt-2">
                <Link
                  to="/license-request"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700/50
                    text-slate-300 text-sm font-medium hover:border-primary/40 hover:text-primary transition-all"
                >
                  <KeyRound size={14} />
                  Yêu cầu thêm
                </Link>
                {hasApproved && (
                  <span className="text-xs text-slate-500">
                    Bạn đã có license đang hoạt động
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Activation guide (if has any approved) */}
          {hasApproved && (
            <div className="mt-10">
              <ActivationGuide />
            </div>
          )}
        </main>
      </div>
    </ConfigProvider>
  );
}
