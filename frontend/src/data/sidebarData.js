export const sidebarItems = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: 'dashboard',
    description: 'View your property overview and key activity.'
  },
  {
    key: 'tenants',
    label: 'Tenants',
    path: '/tenants',
    icon: 'tenants',
    description: 'Manage tenant records, occupancy, and contacts.'
  },
  {
    key: 'buildings',
    label: 'Buildings',
    path: '/buildings',
    icon: 'buildings',
    description: 'Review buildings, units, and collection details.'
  },
  {
    key: 'units',
    label: 'Units',
    path: '/units',
    icon: 'units',
    description: 'Track room availability and unit assignments.'
  },
  {
    key: 'rent-sheet',
    label: 'Rent Collection Sheet',
    path: '/monthly-rent-sheet',
    icon: 'sheet',
    description: 'Check monthly collection progress by tenant.'
  },
  {
    key: 'contracts',
    label: 'Contracts',
    path: '/contracts',
    icon: 'contracts',
    description: 'Create, renew, and monitor rental agreements.'
  },
  {
    key: 'expenses',
    label: 'Expenses',
    path: '/expenses',
    icon: 'expenses',
    description: 'Track and review operational spending clearly.'
  },
  {
    key: 'payments',
    label: 'Payments',
    icon: 'payments',
    description: 'Handle collection activity and payment review.',
    children: [
      {
        key: 'payment-center',
        label: 'Payment Center',
        path: '/payments',
        icon: 'paymentCenter',
        description: 'Record, confirm, and organize rent payments.'
      }
    ]
  },
  {
    key: 'reports',
    label: 'Reports & Analytics',
    icon: 'reports',
    description: 'Analyze trends, income, and collection health.',
    children: [
      {
        key: 'reports-center',
        label: 'Reports Center',
        path: '/reports',
        icon: 'reportsCenter',
        description: 'Open exports, charts, and reporting tools.'
      }
    ]
  },
  {
    key: 'calendar',
    label: 'Events Calendar',
    path: '/calendar-events',
    icon: 'calendar',
    description: 'Plan reminders, due dates, and follow-up events.'
  },
  {
    key: 'operations',
    label: 'Operations Center',
    path: '/operations',
    icon: 'operations',
    description: 'Review urgent work and recovery workflows.'
  },
  {
    key: 'tenant-portal-control',
    label: 'Tenant Portal Control',
    path: '/tenant-portal-control',
    icon: 'tenants',
    allowedRoles: ['manager', 'admin'],
    description: 'Control tenant portal access and account security.'
  },
  {
    key: 'export-center',
    label: 'Export Center',
    path: '/export-center',
    icon: 'exportCenter',
    description: 'Download reports, ledgers, and sheets.'
  },
  {
    key: 'system-health',
    label: 'System Health',
    path: '/system-health',
    icon: 'systemHealth',
    description: 'Check uptime, backups, and recovery readiness.'
  },
  {
    key: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: 'settings',
    description: 'Adjust system preferences and account options.'
  }
];

export const sidebarFooterItem = {
  key: 'logout',
  label: 'Logout',
  icon: 'logout',
  action: 'logout',
  description: 'Exit your current session securely.'
};
