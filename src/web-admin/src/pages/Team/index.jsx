import React, { useState } from 'react';
import { Button, ConfigProvider, theme, Tag } from 'antd';
import { UserPlus, Mail, Shield, UserCheck } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import DataTable from '../../components/DataTable';
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { mockTeamMembers } from '../../dataweb/mockTeam';
import toast from 'react-hot-toast';

const columnHelper = createColumnHelper();

const columns = [
  columnHelper.accessor('name', {
    header: 'Member',
    cell: info => (
      <div className="flex items-center gap-3">
        <div className={`size-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${info.row.original.avatarColor}`}>
          {info.row.original.avatar}
        </div>
        <div>
          <p className="font-semibold text-sm">{info.getValue()}</p>
          <p className="text-xs text-slate-500">{info.row.original.email}</p>
        </div>
      </div>
    ),
  }),
  columnHelper.accessor('role', {
    header: 'Role',
    cell: info => (
      <Tag color={info.getValue() === 'Owner' ? 'gold' : info.getValue() === 'Admin' ? 'blue' : 'default'} className="rounded-full px-3 border-none font-bold text-[10px] uppercase">
        {info.getValue()}
      </Tag>
    ),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: info => (
      <div className="flex items-center gap-2">
        <span className={`size-1.5 rounded-full ${info.getValue() === 'Active' ? 'bg-primary shadow-[0_0_8px_rgba(0,194,203,0.5)]' : 'bg-slate-400'}`}></span>
        <span className={`text-xs font-semibold ${info.getValue() === 'Active' ? 'text-primary' : 'text-slate-500'}`}>{info.getValue()}</span>
      </div>
    ),
  }),
  columnHelper.accessor('lastActive', {
    header: 'Last Active',
    cell: info => <span className="text-xs text-slate-500">{info.getValue()}</span>,
  }),
];

const Team = () => {
  const [data] = useState(() => mockTeamMembers);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const headerExtra = (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#00bcd4', borderRadius: 8, controlHeight: 40 } }}>
      <Button 
        type="primary" 
        onClick={() => toast.success('Mở modal mời thành viên mới...')}
        className="flex items-center justify-center gap-2 font-semibold shadow-lg shadow-primary/20"
      >
        <UserPlus size={18} />
        <span>Invite Member</span>
      </Button>
    </ConfigProvider>
  );

  const totalMembers = mockTeamMembers.length;
  const activeMembers = mockTeamMembers.filter(m => m.status === 'Active').length;
  const pendingMembers = mockTeamMembers.filter(m => m.status === 'Pending').length;

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Team Management" 
        description="Collaborate with your team and manage roles & permissions."
        extra={headerExtra}
      />

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Members" value={totalMembers.toLocaleString()} icon="mail" />
        <StatCard title="Active Members" value={activeMembers.toLocaleString()} titleClass="text-emerald-500" icon="person_check" />
        <StatCard title="Pending Invite" value={pendingMembers.toLocaleString()} titleClass="text-slate-500" icon="security" />
      </section>

      <section>
        <DataTable table={table} />
      </section>
    </div>
  );
};

export default Team;
