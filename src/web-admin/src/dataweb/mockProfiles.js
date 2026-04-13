export const mockProfilesData = Array.from({ length: 1284 }).map((_, i) => {
  const statuses = ['Running', 'Stopped'];
  const groups = [
    { name: 'Marketing', color: 'primary' },
    { name: 'Main Team', color: 'slate' },
    { name: 'Social', color: 'amber' },
  ];
  return {
    id: i + 1,
    name: `Social_Audit_FR_${i + 1}`,
    modified: `Modified ${Math.floor(Math.random() * 10) + 1}h ago`,
    icon: 'alternate_email',
    status: statuses[Math.floor(Math.random() * statuses.length)],
    proxy: `103.4.${Math.floor(Math.random() * 255)}.2 (France)`,
    group: groups[Math.floor(Math.random() * groups.length)],
  };
});

mockProfilesData[0] = {
  id: 1,
  name: 'Ads_Manager_USA_01',
  modified: 'Modified 2h ago',
  icon: 'language',
  status: 'Running',
  proxy: '192.168.1.1 (United States)',
  group: { name: 'Marketing', color: 'primary' },
};
mockProfilesData[1] = {
  id: 2,
  name: 'Stealth_UK_Main',
  modified: 'Modified 5h ago',
  icon: 'security',
  status: 'Stopped',
  proxy: '45.12.33.1 (United Kingdom)',
  group: { name: 'Main Team', color: 'slate' },
};
