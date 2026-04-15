/**
 * Manage.jsx — Admin License Request Management
 *
 * Uses @tanstack/react-table for the table, Antd for modals/select,
 * date-fns for formatting, lucide-react for icons.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import { Modal, Select, ConfigProvider, theme, Button, Tag } from 'antd';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  CheckCircle,
  XCircle,
  Copy,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Filter,
  KeyRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { useLicenseStore } from '../../store/licenseStore';
import { TIER_CONFIG } from '../../services/licenseService';

const { Option } = Select;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTs(ts) {
  if (!ts) return '—';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  return format(date, 'dd/MM/yyyy HH:mm');
}

function timeAgo(ts) {
  if (!ts) return '';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  return formatDistanceToNow(date, { addSuffix: true, locale: vi });
}

function StatusBadge({ status }) {
  const map = {
    pending:  { label: 'Pending',  color: 'yellow' },
    approved: { label: 'Approved', color: 'cyan'   },
    rejected: { label: 'Rejected', color: 'red'     },
  };
  const cfg = map[status] || { label: status, color: 'default' };
  return <Tag color={cfg.color} className="font-semibold text-xs">{cfg.label}</Tag>;
}

function TierBadge({ tier }) {
  const colors = { free: 'default', pro: 'cyan' };
  return (
    <Tag color={colors[tier] || 'default'} className="text-xs font-bold uppercase">
      {TIER_CONFIG[tier]?.label || tier}
    </Tag>
  );
}

// ─── Approve Modal ─────────────────────────────────────────────────────────────
function ApproveModal({ open, request, onConfirm, onCancel, loading }) {
  const [tier, setTier] = useState(request?.requestedTier || 'pro');
  const [durationDays, setDurationDays] = useState(
    TIER_CONFIG[request?.requestedTier]?.defaultDuration ?? 30,
  );

  useEffect(() => {
    if (request) {
      setTier(request.requestedTier || 'pro');
      setDurationDays(TIER_CONFIG[request.requestedTier]?.defaultDuration ?? 30);
    }
  }, [request]);

  const durationOptions = TIER_CONFIG[tier]?.durationOptions || [];

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { colorPrimary: '#00bcd4', borderRadius: 8, colorBgElevated: '#1e293b', colorText: '#e2e8f0' },
      }}
    >
      <Modal
        open={open}
        title={
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-primary" />
            <span>Duyệt & Tạo JWT License</span>
          </div>
        }
        onCancel={onCancel}
        footer={null}
        width={480}
      >
        <div className="pt-2 space-y-5">
          {/* User info */}
          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/40">
            <p className="text-xs text-slate-400 mb-0.5">Requested by</p>
            <p className="font-semibold text-white text-sm">{request?.name}</p>
            <p className="text-xs text-slate-400">{request?.email}</p>
            {request?.reason && (
              <p className="mt-2 text-xs text-slate-400 italic">"{request.reason}"</p>
            )}
          </div>

          {/* Tier */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">License plan</label>
            <Select
              value={tier}
              onChange={(v) => {
                setTier(v);
                setDurationDays(TIER_CONFIG[v]?.defaultDuration ?? null);
              }}
              style={{ width: '100%' }}
              size="large"
            >
              {Object.entries(TIER_CONFIG).map(([key, cfg]) => (
                <Option key={key} value={key}>{cfg.label} — {cfg.price}</Option>
              ))}
            </Select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">Duration</label>
            <Select
              value={durationDays}
              onChange={setDurationDays}
              style={{ width: '100%' }}
              size="large"
            >
              {durationOptions.map((opt) => (
                <Option key={String(opt.value)} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="primary"
              loading={loading}
              onClick={() => onConfirm({ tier, durationDays })}
              className="flex-1 font-semibold"
              size="large"
            >
              {loading ? 'Generating JWT...' : 'Approve & Generate JWT'}
            </Button>
            <Button onClick={onCancel} size="large">Cancel</Button>
          </div>
        </div>
      </Modal>
    </ConfigProvider>
  );
}

// ─── JWT Token Modal ────────────────────────────────────────────────────────
function JwtModal({ open, jwt, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jwt);
      setCopied(true);
      toast.success('Đã copy JWT token!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy thất bại, hãy copy thủ công.');
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { colorPrimary: '#00bcd4', borderRadius: 8, colorBgElevated: '#1e293b', colorText: '#e2e8f0' },
      }}
    >
      <Modal
        open={open}
        title={
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-400" />
            <span>JWT License Generated</span>
          </div>
        }
        onCancel={onClose}
        footer={<Button onClick={onClose}>Close</Button>}
        width={540}
      >
        <div className="pt-3 space-y-4">
          <p className="text-sm text-slate-400">
            Send this JWT token to the user. They paste it into the app → Settings → License → Activate.
          </p>
          <div className="relative">
            <textarea
              readOnly
              value={jwt}
              rows={5}
              className="w-full rounded-xl border border-slate-700/50 bg-slate-900/60 text-slate-200
                text-xs font-mono px-4 py-3 resize-none focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className={`absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-slate-700 text-slate-300 hover:bg-primary/20 hover:text-primary'
              }`}
            >
              <Copy size={12} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="text-xs text-slate-500 space-y-1">
            <p>• Token has been saved to Firestore</p>
            <p>• User can view it at: /my-license → copy and activate in the app</p>
          </div>
        </div>
      </Modal>
    </ConfigProvider>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ManageLicenses() {
  const { user } = useAuthStore();
  const { allRequests, allRequestsLoading, fetchAllRequests, approveRequest, rejectRequest } = useLicenseStore();

  const [statusFilter, setStatusFilter] = useState('all');
  const [approveModal, setApproveModal] = useState(null); // request object
  const [approving, setApproving] = useState(false);
  const [jwtModal, setJwtModal] = useState(null); // jwt string

  useEffect(() => {
    fetchAllRequests();
  }, [fetchAllRequests]);

  // Filter data
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return allRequests;
    return allRequests.filter((r) => r.status === statusFilter);
  }, [allRequests, statusFilter]);

  // tanstack/react-table columns
  const columns = useMemo(
    () => [
      {
        header: 'User',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{row.original.name}</p>
            <p className="text-xs text-slate-400 truncate">{row.original.email}</p>
          </div>
        ),
      },
      {
        header: 'Requested plan',
        accessorKey: 'requestedTier',
        cell: ({ getValue }) => <TierBadge tier={getValue()} />,
      },
      {
        header: 'Duration',
        accessorKey: 'durationDays',
        cell: ({ getValue, row }) => {
          const v = getValue();
          if (row.original.status === 'approved' && v === null) return <span className="text-xs text-amber-400">Lifetime</span>;
          if (!v) return <span className="text-xs text-slate-500">—</span>;
          return <span className="text-xs text-slate-300">{v} days</span>;
        },
      },
      {
        header: 'Approved plan',
        accessorKey: 'approvedTier',
        cell: ({ getValue }) => getValue() ? <TierBadge tier={getValue()} /> : <span className="text-slate-600 text-xs">—</span>,
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ getValue }) => <StatusBadge status={getValue()} />,
      },
      {
        header: 'Submitted',
        accessorKey: 'createdAt',
        cell: ({ getValue }) => (
          <span className="text-xs text-slate-400">{timeAgo(getValue())}</span>
        ),
      },
      {
        header: 'Actions',
        id: 'actions',
        cell: ({ row }) => {
          const r = row.original;
          if (r.status === 'approved') {
            return (
              <button
                onClick={() => setJwtModal(r.jwt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/60 text-slate-300
                  hover:bg-primary/20 hover:text-primary text-xs font-medium transition-all cursor-pointer"
              >
                <Copy size={12} /> View JWT
              </button>
            );
          }
          if (r.status === 'pending') {
            return (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setApproveModal(r)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400
                    hover:bg-emerald-500/25 text-xs font-semibold transition-all cursor-pointer"
                >
                  <CheckCircle size={12} /> Approve
                </button>
                <button
                  onClick={() => handleReject(r)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-400
                    hover:bg-rose-500/25 text-xs font-semibold transition-all cursor-pointer"
                >
                  <XCircle size={12} /> Reject
                </button>
              </div>
            );
          }
          return <span className="text-xs text-slate-600">—</span>;
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  const handleApproveConfirm = async ({ tier, durationDays }) => {
    setApproving(true);
    try {
      const jwt = await approveRequest({
        requestId: approveModal.id,
        adminEmail: user.email,
        tier,
        durationDays,
        userId: approveModal.userId,
        email: approveModal.email,
      });
      toast.success(`✅ Approved and generated JWT for ${approveModal.name}!`);
      setApproveModal(null);
      setJwtModal(jwt);
    } catch (err) {
      toast.error('Error generating JWT: ' + err.message);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (r) => {
    if (!confirm(`Reject license request from ${r.name}?`)) return;
    try {
      await rejectRequest({ requestId: r.id, adminEmail: user.email });
      toast.success('Request rejected.');
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  const pendingCount = allRequests.filter((r) => r.status === 'pending').length;

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { colorPrimary: '#00bcd4', borderRadius: 8 },
      }}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <KeyRound size={20} className="text-primary" />
              License Requests
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400 text-xs font-bold">
                  {pendingCount} pending
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">Manage requests and issue JWT license keys</p>
          </div>
          <button
            onClick={fetchAllRequests}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700/50
              text-slate-400 hover:text-primary hover:border-primary/30 text-sm transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={allRequestsLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3">
          <Filter size={14} className="text-slate-500" />
          {['all', 'pending', 'approved', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === s
                  ? 'bg-primary/20 text-primary'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {s === 'all' ? 'All' : s === 'pending' ? 'Pending' : s === 'approved' ? 'Approved' : 'Rejected'}
              <span className="ml-1.5 text-slate-500">
                ({s === 'all' ? allRequests.length : allRequests.filter((r) => r.status === s).length})
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-700/40 bg-slate-800/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-slate-700/40">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer select-none"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' && <ChevronUp size={12} />}
                          {header.column.getIsSorted() === 'desc' && <ChevronDown size={12} />}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {allRequestsLoading ? (
                  <tr>
                    <td colSpan={columns.length} className="text-center py-16 text-slate-500 text-sm">
                      <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-primary" />
                      Loading...
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="text-center py-16 text-slate-500 text-sm">
                      <KeyRound size={32} className="mx-auto mb-3 text-slate-700" />
                      No requests found
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-700/20 hover:bg-slate-700/20 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {table.getPageCount() > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/40">
              <span className="text-xs text-slate-500">
                Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                {' · '}
                {filtered.length} requests
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="px-3 py-1.5 rounded-lg border border-slate-700/50 text-xs text-slate-400
                    hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="px-3 py-1.5 rounded-lg border border-slate-700/50 text-xs text-slate-400
                    hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        <ApproveModal
          open={!!approveModal}
          request={approveModal}
          onConfirm={handleApproveConfirm}
          onCancel={() => setApproveModal(null)}
          loading={approving}
        />
        <JwtModal
          open={!!jwtModal}
          jwt={jwtModal}
          onClose={() => setJwtModal(null)}
        />
      </div>
    </ConfigProvider>
  );
}
