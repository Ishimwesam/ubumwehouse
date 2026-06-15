import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sidebarFooterItem, sidebarItems } from '../data/sidebarData';
import '../styles/sidebar.css';

export const SIDEBAR_WIDTH = '258px';
export const SIDEBAR_COLLAPSED_WIDTH = '88px';

const SidebarIcon = ({ name, active = false }) => {
  const stroke = active ? '#ffffff' : '#f8fafc';
  const fill = active ? '#ffffff' : '#f8fafc';
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.4" />
          <rect x="14" y="3" width="7" height="7" rx="1.4" />
          <rect x="3" y="14" width="7" height="7" rx="1.4" />
          <rect x="14" y="14" width="7" height="7" rx="1.4" />
        </svg>
      );
    case 'tenants':
      return (
        <svg {...common}>
          <circle cx="7" cy="8" r="2.35" fill={fill} stroke="none" />
          <circle cx="17" cy="8" r="2.35" fill={fill} stroke="none" />
          <circle cx="12" cy="11.2" r="2.8" fill={fill} stroke="none" />
          <path d="M4 19.3v-.9a3.8 3.8 0 0 1 3.8-3.8h.3a3.7 3.7 0 0 1 2.3.8" />
          <path d="M13.6 15.4a3.6 3.6 0 0 1 2.3-.8h.3a3.8 3.8 0 0 1 3.8 3.8v.9" />
          <path d="M7.8 19.8v-1.4a4.2 4.2 0 0 1 4.2-4.2h0a4.2 4.2 0 0 1 4.2 4.2v1.4" />
        </svg>
      );
    case 'buildings':
      return (
        <svg {...common}>
          <rect x="4.5" y="3.5" width="9.8" height="17" rx="1.6" />
          <rect x="15.6" y="8" width="3.9" height="12.5" rx="1.1" />
          <path d="M8.1 20.5v-4.3h2.5v4.3" />
          <path d="M7.7 7.6h.01M11.1 7.6h.01M7.7 11.3h.01M11.1 11.3h.01M7.7 15h.01M11.1 15h.01M17.6 11.6h.01M17.6 15h.01" />
        </svg>
      );
    case 'units':
      return (
        <svg {...common}>
          <path d="M6 20h12" />
          <path d="M8 20V6.3A2.3 2.3 0 0 1 10.3 4h5.2v16" />
          <path d="M8 19.2 4.8 18.5" />
          <circle cx="12" cy="12.2" r="0.85" fill={fill} stroke="none" />
          <path d="M16.2 20h2.8" />
        </svg>
      );
    case 'sheet':
      return (
        <svg {...common}>
          <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
          <path d="M4.5 9h15" />
          <path d="M8.1 6.4h7.8" />
          <path d="M8 12.6h2.2M11.4 12.6h2.2M14.8 12.6H17M8 16.3h2.2M11.4 16.3h2.2M14.8 16.3H17" />
        </svg>
      );
    case 'contracts':
      return (
        <svg {...common}>
          <path d="M7 3.5h7l4 4v13A1.5 1.5 0 0 1 16.5 22h-9A1.5 1.5 0 0 1 6 20.5V5A1.5 1.5 0 0 1 7 3.5Z" />
          <path d="M14 3.5V8h4" />
          <path d="M9 12h6M9 15.6h6M9 19.2h4.5" />
        </svg>
      );
    case 'expenses':
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="5.1" />
          <path d="M10 7v6" />
          <path d="M12 8.2a2.4 2.4 0 0 0-2-1.1 2.1 2.1 0 0 0-2.2 2c0 1.2 1 1.8 2.2 2.1 1.3.4 2.4.8 2.4 2.2a2.2 2.2 0 0 1-2.4 2.1 2.7 2.7 0 0 1-2.6-1.8" />
          <path d="M16.8 11.5v5.8" />
          <path d="m14.8 15.4 2 2 2-2" />
        </svg>
      );
    case 'payments':
      return (
        <svg {...common}>
          <path d="M4.6 8.4h11.2a2.3 2.3 0 0 1 2.3 2.3v6.1a2.3 2.3 0 0 1-2.3 2.3H6.9a2.3 2.3 0 0 1-2.3-2.3z" />
          <path d="M6.2 8.4 14.8 5.7c1.3-.4 2.7.5 2.7 1.9v.8" />
          <rect x="14.1" y="11.7" width="5.2" height="3.7" rx="1.6" />
          <circle cx="16.7" cy="13.55" r="0.75" fill={fill} stroke="none" />
        </svg>
      );
    case 'paymentCenter':
      return (
        <svg {...common}>
          <rect x="4.5" y="6.1" width="15" height="11.6" rx="2.3" />
          <path d="M4.5 9.8h15" />
          <path d="M8 13.5h2.6M13 13.5h3.2" />
        </svg>
      );
    case 'reports':
      return (
        <svg {...common}>
          <path d="M5 19.5V14" />
          <path d="M10.3 19.5V10.5" />
          <path d="M15.6 19.5V12.5" />
          <path d="M20 19.5V8" />
          <path d="m4.8 9.8 4.8-4 4.2 3 5-5" />
          <circle cx="4.8" cy="9.8" r="0.85" fill={fill} stroke="none" />
          <circle cx="9.6" cy="5.8" r="0.85" fill={fill} stroke="none" />
          <circle cx="13.8" cy="8.8" r="0.85" fill={fill} stroke="none" />
          <circle cx="18.8" cy="3.8" r="0.85" fill={fill} stroke="none" />
        </svg>
      );
    case 'reportsCenter':
      return (
        <svg {...common}>
          <path d="M7 3.5h7l4 4v13A1.5 1.5 0 0 1 16.5 22h-9A1.5 1.5 0 0 1 6 20.5V5A1.5 1.5 0 0 1 7 3.5Z" />
          <path d="M14 3.5V8h4" />
          <path d="M11.8 12v5" />
          <path d="M11.8 12a4 4 0 0 1 4 4" />
          <path d="M11.8 12a4 4 0 0 0-4 4" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
          <path d="M7.5 14.1h2.5M11 14.1h2.5M14.5 14.1H17M7.5 17.8h2.5M11 17.8h2.5M14.5 17.8H17" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg {...common}>
          <path d="M20.5 11.7a8.3 8.3 0 0 1-12.3 7.3L4 20.3l1.4-4a8.3 8.3 0 1 1 15.1-4.6Z" />
          <path d="M9.2 8.4c.2-.5.4-.6.8-.6h.6c.2 0 .4.1.5.4l.8 1.8c.1.3.1.5-.1.7l-.4.5c-.1.1-.2.3-.1.5.4.8 1.1 1.5 2 2 .2.1.4.1.5-.1l.6-.7c.2-.2.4-.2.7-.1l1.8.8c.3.1.4.3.4.6v.5c0 .4-.2.8-.6 1a3 3 0 0 1-1.7.5c-1.2 0-2.9-.6-4.4-2.1-1.6-1.6-2.4-3.4-2.4-4.6 0-.5.2-.9.4-1.1Z" />
        </svg>
      );
    case 'operations':
      return (
        <svg {...common}>
          <path d="M4 6.5h16" />
          <path d="M4 12h16" />
          <path d="M4 17.5h16" />
          <circle cx="8" cy="6.5" r="1.6" fill={fill} stroke="none" />
          <circle cx="14" cy="12" r="1.6" fill={fill} stroke="none" />
          <circle cx="10.5" cy="17.5" r="1.6" fill={fill} stroke="none" />
        </svg>
      );
    case 'exportCenter':
      return (
        <svg {...common}>
          <path d="M7 3.5h7l4 4v13A1.5 1.5 0 0 1 16.5 22h-9A1.5 1.5 0 0 1 6 20.5V5A1.5 1.5 0 0 1 7 3.5Z" />
          <path d="M14 3.5V8h4" />
          <path d="M12 11v6" />
          <path d="m9.5 14.5 2.5 2.5 2.5-2.5" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
        </svg>
      );
    case 'systemHealth':
      return (
        <svg {...common}>
          <path d="M12 21s7-3.5 7-9V5.8L12 3 5 5.8V12c0 5.5 7 9 7 9Z" />
          <path d="M8.7 12.2h2.1l1.1-2.8 1.7 5 1.1-2.2h2.6" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
    default:
      return null;
  }
};

const ChevronIcon = ({ open = false }) => (
  <svg
    className={`app-sidebar-chevron ${open ? 'open' : ''}`}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const CollapsedExpandBadge = ({ open = false }) => (
  <span className={`app-sidebar-collapsed-indicator ${open ? 'open' : ''}`} aria-hidden="true">
    {open ? '−' : '+'}
  </span>
);

const CompanyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="8.5" width="6.5" height="11.5" rx="1.2" />
    <rect x="10.8" y="4" width="5.8" height="16" rx="1.2" />
    <path d="M19.2 20v-7.4a1.6 1.6 0 0 0-1.6-1.6h-1.8V20" />
    <path d="M6.5 12.2h.01M6.5 15.5h.01M13.7 8.1h.01M13.7 11.4h.01M13.7 14.7h.01" />
  </svg>
);

const CollapseToggleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="4" y="6" width="16" height="2.4" rx="1.2" fill="currentColor" />
    <rect x="4" y="10.8" width="16" height="2.4" rx="1.2" fill="currentColor" />
    <rect x="4" y="15.6" width="16" height="2.4" rx="1.2" fill="currentColor" />
  </svg>
);

const SidebarItem = ({ item, active, nested = false, collapsed = false }) => (
  <>
    <span className="app-sidebar-link-main">
      <span className="app-sidebar-icon">
        <SidebarIcon name={item.icon} active={active} />
      </span>
      {!collapsed ? (
        <span className="app-sidebar-text">
          <span className={nested ? 'app-sidebar-sublabel' : 'app-sidebar-label'}>{item.label}</span>
          {active && item.description ? (
            <span className={nested ? 'app-sidebar-subdescription' : 'app-sidebar-description'}>{item.description}</span>
          ) : null}
        </span>
      ) : null}
    </span>
    {!collapsed && item.badge ? <span className="app-sidebar-badge">{item.badge}</span> : null}
  </>
);

const Sidebar = ({ collapsed = false, onToggleCollapse = () => {}, isMobile = false }) => {
  const location = useLocation();
  const { logoutWithFarewell, user } = useAuth();
  const [openSections, setOpenSections] = useState({
    payments: true,
    reports: true
  });

  let pendingPaymentsCount = 0;
  try {
    pendingPaymentsCount = parseInt(localStorage.getItem('pendingPaymentsCount') || '0', 10);
  } catch (_) {}

  const canAccessItem = (item) => {
    if (!item?.allowedRoles?.length) return true;
    return item.allowedRoles.includes(user?.role);
  };

  const items = sidebarItems
    .map((item) => {
      const normalizedItem = item.key === 'payments'
        ? {
            ...item,
            children: item.children.map((child) => ({
              ...child,
              badge: pendingPaymentsCount > 0 ? pendingPaymentsCount : null
            }))
          }
        : item;

      if (!normalizedItem.children?.length) {
        return canAccessItem(normalizedItem) ? normalizedItem : null;
      }

      const visibleChildren = normalizedItem.children.filter(canAccessItem);
      if (!visibleChildren.length && !canAccessItem(normalizedItem)) {
        return null;
      }

      return {
        ...normalizedItem,
        children: visibleChildren
      };
    })
    .filter(Boolean);

  const isActive = (path) => location.pathname === path;
  const isGroupActive = (children = []) => children.some((item) => isActive(item.path));

  return (
    <aside className={`app-sidebar ${collapsed ? 'app-sidebar--collapsed' : ''} ${isMobile ? 'app-sidebar--mobile' : ''}`}>
      <div className="app-sidebar-brand">
        <div className="app-sidebar-brand-top">
          <div className="app-sidebar-brand-mark" aria-hidden="true">
            <CompanyIcon />
          </div>
          <button
            type="button"
            className={`app-sidebar-collapse-button ${collapsed ? 'is-active' : ''}`}
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <CollapseToggleIcon />
          </button>
        </div>
        {!collapsed ? (
          <div className="app-sidebar-brand-copy">
            <div className="app-sidebar-brand-title">UBUMWE</div>
            <div className="app-sidebar-brand-title">SYSTEM COMPANY</div>
            <div className="app-sidebar-brand-subtitle">UBUMWE SYSTEM COMPANY</div>
          </div>
        ) : null}
      </div>

      <nav className="app-sidebar-nav">
        {items.map((item) => {
          if (!item.children?.length) {
            const active = isActive(item.path);

            return (
              <Link key={item.key} to={item.path} title={item.label} className={`app-sidebar-link ${active ? 'active' : ''}`}>
                <SidebarItem item={item} active={active} collapsed={collapsed} />
              </Link>
            );
          }

          const active = isGroupActive(item.children);
          const open = openSections[item.key] || active;

          return (
            <div key={item.key} className="app-sidebar-group">
              <button
                type="button"
                onClick={() => {
                  if (collapsed && !isMobile) {
                    onToggleCollapse();
                    setOpenSections((prev) => ({ ...prev, [item.key]: true }));
                    return;
                  }

                  setOpenSections((prev) => ({ ...prev, [item.key]: !prev[item.key] }));
                }}
                className={`app-sidebar-group-toggle ${active ? 'active' : ''}`}
                title={item.label}
              >
                <SidebarItem item={item} active={active} collapsed={collapsed} />
                {collapsed ? <CollapsedExpandBadge open={open} /> : <ChevronIcon open={open} />}
              </button>

              {open && !collapsed ? (
                <div className="app-sidebar-children">
                  {item.children.map((child) => {
                    const childActive = isActive(child.path);

                    return (
                      <Link
                        key={child.key}
                        to={child.path}
                        title={child.label}
                        className={`app-sidebar-sublink ${childActive ? 'active' : ''}`}
                      >
                        <SidebarItem item={child} active={childActive} nested collapsed={collapsed} />
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="app-sidebar-footer">
        <button type="button" onClick={logoutWithFarewell} title={sidebarFooterItem.label} className="app-sidebar-link app-sidebar-logout">
          <SidebarItem item={sidebarFooterItem} active collapsed={collapsed} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
