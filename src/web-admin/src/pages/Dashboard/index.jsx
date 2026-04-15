import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../../components/StatCard';
import PageHeader from '../../components/PageHeader';
import { useLicenseStore } from '../../store/licenseStore';
import { useAuthStore } from '../../store/authStore';
import { Button, ConfigProvider, theme, Tag, Spin } from 'antd';
import { KeyRound, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

const Dashboard = () => {
  const navigate = useNavigate();
  const { allRequests, allRequestsLoading, fetchAllRequests } = useLicenseStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAllRequests();
    }
  }, [user]);

  // Calculate stats from real data
  const totalRequests = allRequests.length;
  const pendingCount = allRequests.filter(r => r.status === 'pending').length;
  const approvedCount = allRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = allRequests.filter(r => r.status === 'rejected').length;

  // Get recent requests (last 5)
  const recentRequests = [...allRequests]
    .sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return dateB - dateA;
    })
    .slice(0, 5);

  const getStatusTag = (status) => {
    const configs = {
      pending: { color: 'gold', icon: <Clock size={12} />, label: 'Pending' },
      approved: { color: 'green', icon: <CheckCircle size={12} />, label: 'Approved' },
      rejected: { color: 'red', icon: <XCircle size={12} />, label: 'Rejected' },
    };
    const config = configs[status] || configs.pending;
    return (
      <Tag color={config.color} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Tag>
    );
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '—';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'MMM dd, yyyy HH:mm');
  };

  const headerExtra = (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#00bcd4', borderRadius: 8, controlHeight: 40 } }}>
      <Button 
        type="primary" 
        onClick={() => navigate('/dashboard/licenses')}
        className="flex items-center justify-center gap-2 font-semibold shadow-lg shadow-primary/20"
      >
        <KeyRound size={18} />
        <span>Manage Licenses</span>
      </Button>
    </ConfigProvider>
  );

  if (allRequestsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Requests" 
          value={totalRequests.toLocaleString()} 
          icon="description" 
        />
        <StatCard 
          title="Pending" 
          value={pendingCount.toLocaleString()} 
          icon="pending" 
          iconClass="text-amber-500" 
        />
        <StatCard 
          title="Approved" 
          value={approvedCount.toLocaleString()} 
          icon="check_circle" 
          iconClass="text-emerald-500" 
        />
        <StatCard 
          title="Rejected" 
          value={rejectedCount.toLocaleString()} 
          icon="cancel" 
          iconClass="text-rose-500" 
        />
      </section>

      <section className="space-y-4">
        <PageHeader 
          title="License Management Dashboard" 
          description="Manage license requests and monitor system status"
          extra={headerExtra}
        />
        
        {/* Recent Requests Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent License Requests</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Latest submissions from users</p>
          </div>
          
          {recentRequests.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <KeyRound size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-slate-500 dark:text-slate-400">No license requests yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Tier</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {recentRequests.map((request) => (
                    <tr 
                      key={request.id}
                      onClick={() => navigate('/dashboard/licenses')}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{request.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{request.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-primary uppercase">
                          {request.approvedTier || request.requestedTier}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {request.durationDays === null ? 'Lifetime' : `${request.durationDays} days`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusTag(request.status)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(request.createdAt)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        {pendingCount > 0 && (
          <div className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                  ⏰ {pendingCount} Pending Request{pendingCount > 1 ? 's' : ''}
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  License requests waiting for approval
                </p>
              </div>
              <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#f59e0b' } }}>
                <Button 
                  type="primary" 
                  size="large"
                  onClick={() => navigate('/dashboard/licenses')}
                  className="font-semibold"
                >
                  Review Now →
                </Button>
              </ConfigProvider>
            </div>
          </div>
        )}
      </section>
    </>
  );
};

export default Dashboard;
