import React from 'react';
import { useNavigate } from 'react-router-dom';
import useTenantUnread from '../hooks/useTenantUnread';
import { clearUnread } from '../utils/tenantNotification';

const NavIcon = ({ children }) => (
  <span className="tp-nav-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" focusable="false">
      {children}
    </svg>
  </span>
);

const icons = {
  dashboard: (
    <NavIcon>
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
    </NavIcon>
  ),
  payments: (
    <NavIcon>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
      <path d="M4 9h16M7 15h4" />
    </NavIcon>
  ),
  upload: (
    <NavIcon>
      <path d="M6 20h12a2 2 0 0 0 2-2v-3M12 4v11M8 8l4-4 4 4" />
    </NavIcon>
  ),
  maintenance: (
    <NavIcon>
      <path d="m14.7 6.3 3 3M4 20l4.4-1.1L18.7 8.6a2.1 2.1 0 0 0-3-3L5.4 15.9z" />
      <path d="M12.5 7.5 16.5 11.5" />
    </NavIcon>
  ),
  messages: (
    <NavIcon>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-5 4v-4.2A2.5 2.5 0 0 1 5 12.5z" />
    </NavIcon>
  ),
  announcements: (
    <NavIcon>
      <path d="M4 11v2a2 2 0 0 0 2 2h2l7 4V5L8 9H6a2 2 0 0 0-2 2z" />
      <path d="M18 9.5a3.5 3.5 0 0 1 0 5" />
    </NavIcon>
  ),
  profile: (
    <NavIcon>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0" />
    </NavIcon>
  ),
  password: (
    <NavIcon>
      <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" />
    </NavIcon>
  )
};

const navItems = [
  { id: 'dashboard', label: 'Dashboard', path: '/tenant-portal' },
  { id: 'payments', label: 'Payments', path: '/tenant-portal/payments' },
  { id: 'upload', label: 'Upload Receipt', shortLabel: 'Upload', path: '/tenant-portal/upload' },
  { id: 'maintenance', label: 'Maintenance', path: '/tenant-portal/maintenance' },
  { id: 'messages', label: 'Messages', path: '/tenant-portal/messages' },
  { id: 'announcements', label: 'Announcements', shortLabel: 'Notices', path: '/tenant-portal/announcements' },
  { id: 'profile', label: 'Profile', path: '/tenant-portal/profile', extra: true },
  { id: 'password', label: 'Change Password', shortLabel: 'Password', path: '/forgot-password', extra: true }
];

const TenantPortalNav = ({ current = '', mobileOnly = false, onDashboardClick }) => {
  const navigate = useNavigate();
  const unreadMessages = useTenantUnread();

  const handleClick = (item) => {
    if (item.id === 'messages') {
      clearUnread();
    }

    if (item.id === 'dashboard' && onDashboardClick) {
      onDashboardClick();
      return;
    }

    navigate(item.path);
  };

  return (
    <nav className={`tp-nav${mobileOnly ? ' tp-mobile-nav' : ''}`} aria-label="Tenant portal navigation">
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className={[
            current === item.id ? 'active' : '',
            item.id === 'messages' ? 'tp-nav-msg-btn' : '',
            item.extra ? 'tp-nav-extra' : ''
          ].filter(Boolean).join(' ')}
          onClick={() => handleClick(item)}
          aria-label={item.label}
          title={item.label}
        >
          {icons[item.id]}
          <span className="tp-nav-label">{item.shortLabel || item.label}</span>
          {item.id === 'messages' && unreadMessages > 0 ? (
            <span className="tp-nav-badge">{unreadMessages > 99 ? '99+' : unreadMessages}</span>
          ) : null}
        </button>
      ))}
    </nav>
  );
};

export default TenantPortalNav;
