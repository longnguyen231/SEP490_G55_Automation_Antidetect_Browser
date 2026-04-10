export const mockGroupsData = [
  {
    id: 1,
    name: 'Facebook Ads',
    profilesCount: 12,
    lastActive: '2h ago',
    status: 'Running',
    gradient: 'from-primary/20 to-purple-500/20',
    tags: ['FB', 'AD', '+10'],
    tagColors: ['bg-slate-700', 'bg-slate-600', 'bg-primary']
  },
  {
    id: 2,
    name: 'Crypto Multi-acc',
    profilesCount: 45,
    lastActive: 'Created May 12',
    status: 'Idle',
    gradient: 'from-orange-500/20 to-yellow-500/20',
    tags: ['BTC', 'ETH', '+43'],
    tagColors: ['bg-orange-600', 'bg-yellow-600', 'bg-primary']
  },
  {
    id: 3,
    name: 'Amazon Stealth',
    profilesCount: 8,
    lastActive: 'High Anonymity',
    status: 'Paused',
    gradient: 'from-slate-500/20 to-slate-800/20',
    tags: ['AM', 'ZN', '+6'],
    tagColors: ['bg-slate-500', 'bg-slate-400', 'bg-primary']
  }
];

export const recentActivities = [
  {
    id: 1,
    title: "Batch start 'Facebook Ads' successful",
    description: "12 profiles initialized in 1.4s",
    time: "2 min ago",
    type: "success"
  },
  {
    id: 2,
    title: "Group 'Crypto Multi-acc' created",
    description: "By user admin_1",
    time: "1 hour ago",
    type: "info"
  }
];
