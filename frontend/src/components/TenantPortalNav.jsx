import React from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { tenantPortalService } from '../services/api';
import { emitAppToast } from '../context/ToastContext';
import useTenantUnread from '../hooks/useTenantUnread';
import {
  clearUnread,
  incrementUnread,
  registerTenantPushSubscription,
  requestNotificationPermission,
  showBrowserNotification
} from '../utils/tenantNotification';

const seenRealtimeIds = new Set();

const BellGlyph = () => (
  <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </svg>
);

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

const getRealtimeCopy = (payload = {}) => {
  if (payload.sender_type === 'admin') {
    return {
      title: 'UBUMWE HOUSE LTD',
      message: payload.message || 'You have a new message from support.'
    };
  }
  if (payload.event_type === 'tenant_payment_update') {
    return {
      title: payload.title || 'Payment update',
      message: payload.message || 'Your payment status was updated.'
    };
  }
  if (payload.event_type === 'tenant_announcement') {
    return {
      title: payload.title || 'New announcement',
      message: payload.message || 'A new announcement is available.'
    };
  }
  if (payload.event_type === 'tenant_maintenance_update') {
    return {
      title: payload.title || 'Maintenance update',
      message: payload.message || 'Your maintenance request was updated.'
    };
  }
  return null;
};

const TenantPortalRealtimeBridge = () => {
  const navigate = useNavigate();
  const [popup, setPopup] = React.useState(null);
  const dismissTimerRef = React.useRef(null);

  const dismissPopup = React.useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setPopup(null);
  }, []);

  const showPopup = React.useCallback((nextPopup) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setPopup(nextPopup);
    dismissTimerRef.current = setTimeout(() => {
      setPopup(null);
      dismissTimerRef.current = null;
    }, 9000);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      registerTenantPushSubscription(tenantPortalService);
    }
  }, []);

  React.useEffect(() => {
    const streamUrl = tenantPortalService.getStreamUrl();
    if (!streamUrl) return undefined;

    const source = new EventSource(streamUrl);
    const onMessage = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        const eventId = payload?.id || `${payload?.event_type || payload?.sender_type || 'event'}-${payload?.created_at || Date.now()}`;
        if (seenRealtimeIds.has(eventId)) return;
        seenRealtimeIds.add(eventId);
        if (seenRealtimeIds.size > 200) seenRealtimeIds.clear();

        window.dispatchEvent(new CustomEvent('tp:portal-event', { detail: payload }));

        const copy = getRealtimeCopy(payload);
        if (!copy) return;

        if (payload.sender_type === 'admin') {
          incrementUnread();
        }

        emitAppToast(copy.message, 'realtime');
        showPopup({
          id: eventId,
          title: copy.title,
          message: copy.message,
          path: payload.actionPath || (payload.sender_type === 'admin' ? '/tenant-portal/messages' : '/tenant-portal')
        });
        showBrowserNotification(copy.title, copy.message, {
          tag: eventId,
          data: { url: payload.actionPath || '/tenant-portal' }
        });
      } catch (_) {}
    };

    source.addEventListener('message', onMessage);
    source.onerror = () => {};

    return () => {
      source.removeEventListener('message', onMessage);
      source.close();
    };
  }, [showPopup]);

  React.useEffect(() => () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  }, []);

  if (!popup || typeof document === 'undefined') return null;

  return createPortal(
    <div className="tp-realtime-popup" role="status" aria-live="polite">
      <div className="tp-realtime-popup-glow" aria-hidden="true" />
      <div className="tp-realtime-popup-copy">
        <span>Live update</span>
        <strong>{popup.title}</strong>
        <p>{popup.message}</p>
      </div>
      <div className="tp-realtime-popup-actions">
        <button
          type="button"
          className="tp-realtime-popup-open"
          onClick={() => {
            const targetPath = popup.path || '/tenant-portal';
            dismissPopup();
            navigate(targetPath);
          }}
        >
          Open
        </button>
        <button type="button" className="tp-realtime-popup-close" onClick={dismissPopup} aria-label="Dismiss notification">
          x
        </button>
      </div>
    </div>,
    document.body
  );
};

export const TenantNotificationPermissionButton = ({ inline = false, floating = false }) => {
  const [permission, setPermission] = React.useState(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const syncPermission = () => {
      if (!('Notification' in window)) {
        setPermission('unsupported');
        return;
      }
      setPermission(Notification.permission);
    };
    window.addEventListener('focus', syncPermission);
    return () => window.removeEventListener('focus', syncPermission);
  }, []);

  if (permission === 'unsupported') return null;

  const enabled = permission === 'granted';

  const handleEnable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const nextPermission = enabled ? 'granted' : await requestNotificationPermission();
      setPermission(nextPermission);
      if (nextPermission === 'granted') {
        await registerTenantPushSubscription(tenantPortalService);
        emitAppToast(enabled ? 'Phone alerts are working' : 'Phone notifications enabled', 'success');
        await showBrowserNotification(
          'UBUMWE HOUSE LTD',
          enabled ? 'Alerts are active on this phone.' : 'Phone notifications are now enabled.',
          {
            tag: 'tenant-alerts-test',
            data: { url: '/tenant-portal' }
          }
        );
      } else if (nextPermission === 'denied') {
        emitAppToast('Notifications are blocked in phone settings', 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={[
        'tp-phone-notification-button',
        inline ? 'inline' : '',
        floating ? 'floating' : ''
      ].filter(Boolean).join(' ')}
      onClick={handleEnable}
      disabled={busy}
      aria-label={enabled ? 'Test phone notifications' : 'Enable phone notifications'}
      title={enabled ? 'Test phone notifications' : 'Enable phone notifications'}
    >
      <span className="tp-phone-notification-icon"><BellGlyph /></span>
      <span>{busy ? 'Enabling...' : enabled ? 'Alerts On' : 'Enable Alerts'}</span>
    </button>
  );
};

const getCurrentFromPath = (pathname = '') => {
  const exactMatch = navItems.find((item) => item.path === pathname);
  if (exactMatch) return exactMatch.id;

  const nestedMatch = navItems
    .filter((item) => item.path !== '/tenant-portal' && pathname.startsWith(item.path))
    .sort((a, b) => b.path.length - a.path.length)[0];

  if (nestedMatch) return nestedMatch.id;
  if (pathname.startsWith('/tenant-portal')) return 'dashboard';
  return '';
};

const TenantPortalNav = ({ current = '', mobileOnly = false, onDashboardClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const unreadMessages = useTenantUnread();
  const activeItem = current || getCurrentFromPath(location.pathname);

  const handleClick = (item) => {
    if (item.id === 'messages') {
      clearUnread();
    }

    if (item.id === 'dashboard' && onDashboardClick) {
      onDashboardClick();
      return;
    }

    if (location.pathname === item.path) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    navigate(item.path);
  };

  return (
    <>
      <TenantPortalRealtimeBridge />
      {mobileOnly ? <TenantNotificationPermissionButton floating /> : null}
      <nav className={`tp-nav${mobileOnly ? ' tp-mobile-nav' : ''}`} aria-label="Tenant portal navigation">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={[
              activeItem === item.id ? 'active' : '',
              item.id === 'messages' ? 'tp-nav-msg-btn' : '',
              item.extra ? 'tp-nav-extra' : ''
            ].filter(Boolean).join(' ')}
            onClick={() => handleClick(item)}
            aria-label={item.label}
            aria-current={activeItem === item.id ? 'page' : undefined}
            title={item.label}
          >
            {icons[item.id]}
            {!mobileOnly ? <span className="tp-nav-label">{item.shortLabel || item.label}</span> : null}
            {item.id === 'messages' && unreadMessages > 0 ? (
              <span className="tp-nav-badge">{unreadMessages > 99 ? '99+' : unreadMessages}</span>
            ) : null}
          </button>
        ))}
      </nav>
    </>
  );
};

export default TenantPortalNav;
