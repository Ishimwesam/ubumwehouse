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

const LANGUAGE_STORAGE_KEY = 'tenantPortalLanguage';

const languages = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Francais' },
  { code: 'rw', label: 'Kinyarwanda' }
];

const navTranslations = {
  en: {
    dashboard: 'Home',
    payments: 'Pay',
    upload: 'Receipt',
    maintenance: 'Repair',
    messages: 'Messages',
    announcements: 'Notices',
    profile: 'Profile',
    password: 'Password',
    alertsOn: 'Alerts On',
    enableAlerts: 'Enable Alerts',
    enabling: 'Enabling...',
    language: 'Language',
    rentPaid: 'Rent paid',
    rentPaidMessage: 'Your rent for {period} is fully paid.',
    rentOverdue: 'Rent overdue',
    rentOverdueMessage: 'Your rent was due on {date}. Please upload your payment receipt.',
    rentDueToday: 'Rent due today',
    rentDueTodayMessage: 'Your rent is due today. Please upload your payment receipt after paying.',
    rentDueReminder: 'Rent due reminder',
    rentDueReminderMessage: 'Your rent is due on {date}.',
    currentPeriod: 'Current period',
    pendingConfirmation: '{amount} is waiting for admin confirmation.',
    dueAmount: 'Due amount',
    dueDate: 'Due date',
    uploadReceipt: 'Upload Receipt',
    monthlyRent: 'Monthly Rent',
    paidAmount: 'Paid Amount',
    outstandingBalance: 'Outstanding Balance',
    paymentHistory: 'Payment History',
    paymentHistorySubtitle: 'All receipts and payment records for your tenant portal account.',
    totalPaid: 'Total Paid',
    lastPaymentDate: 'Last Payment Date',
    pendingPayments: 'Pending Payments',
    backToDashboard: 'Back To Dashboard',
    uploadNewReceipt: 'Upload New Receipt',
    downloadStatement: 'Download Statement',
    contactAdmin: 'Contact Admin',
    paymentsTitle: 'Payments'
  },
  fr: {
    dashboard: 'Accueil',
    payments: 'Payer',
    upload: 'Recu',
    maintenance: 'Reparer',
    messages: 'Messages',
    announcements: 'Avis',
    profile: 'Profil',
    password: 'Mot passe',
    alertsOn: 'Alertes',
    enableAlerts: 'Activer',
    enabling: 'Activation...',
    language: 'Langue',
    rentPaid: 'Loyer paye',
    rentPaidMessage: 'Votre loyer pour {period} est entierement paye.',
    rentOverdue: 'Loyer en retard',
    rentOverdueMessage: 'Votre loyer etait du le {date}. Veuillez televerser le recu de paiement.',
    rentDueToday: 'Loyer du aujourd hui',
    rentDueTodayMessage: 'Votre loyer est du aujourd hui. Veuillez televerser le recu apres paiement.',
    rentDueReminder: 'Rappel de loyer',
    rentDueReminderMessage: 'Votre loyer est du le {date}.',
    currentPeriod: 'Periode actuelle',
    pendingConfirmation: '{amount} attend la confirmation de l admin.',
    dueAmount: 'Montant du',
    dueDate: 'Date due',
    uploadReceipt: 'Televerser recu',
    monthlyRent: 'Loyer mensuel',
    paidAmount: 'Montant paye',
    outstandingBalance: 'Solde restant',
    paymentHistory: 'Historique paiements',
    paymentHistorySubtitle: 'Tous les recus et paiements de votre compte locataire.',
    totalPaid: 'Total paye',
    lastPaymentDate: 'Dernier paiement',
    pendingPayments: 'Paiements en attente',
    backToDashboard: 'Retour',
    uploadNewReceipt: 'Nouveau recu',
    downloadStatement: 'Telecharger releve',
    contactAdmin: 'Contacter admin',
    paymentsTitle: 'Paiements'
  },
  rw: {
    dashboard: 'Ahabanza',
    payments: 'Kwishyura',
    upload: 'Risiti',
    maintenance: 'Gusana',
    messages: 'Ubutumwa',
    announcements: 'Amatangazo',
    profile: 'Umwirondoro',
    password: 'Ijambo',
    alertsOn: 'Birakora',
    enableAlerts: 'Fungura',
    enabling: 'Tegereza...',
    language: 'Ururimi',
    rentPaid: 'Ubukode bwishyuwe',
    rentPaidMessage: 'Ubukode bwa {period} bwishyuwe bwose.',
    rentOverdue: 'Ubukode bwararenze',
    rentOverdueMessage: 'Ubukode bwagombaga kwishyurwa ku wa {date}. Ohereza risiti y ubwishyu.',
    rentDueToday: 'Ubukode ni uyu munsi',
    rentDueTodayMessage: 'Ubukode bugomba kwishyurwa uyu munsi. Ohereza risiti nyuma yo kwishyura.',
    rentDueReminder: 'Kwibutsa ubukode',
    rentDueReminderMessage: 'Ubukode buzishyurwa ku wa {date}.',
    currentPeriod: 'Ukwezi kurebwa',
    pendingConfirmation: '{amount} iri gutegereza kwemezwa na admin.',
    dueAmount: 'Amafaranga asigaye',
    dueDate: 'Itariki yo kwishyura',
    uploadReceipt: 'Ohereza risiti',
    monthlyRent: 'Ubukode bw ukwezi',
    paidAmount: 'Ayishyuwe',
    outstandingBalance: 'Asigaye',
    paymentHistory: 'Amateka y ubwishyu',
    paymentHistorySubtitle: 'Risiti n ubwishyu bwa konti yawe y umupangayi.',
    totalPaid: 'Yose yishyuwe',
    lastPaymentDate: 'Ubwishyu bwa nyuma',
    pendingPayments: 'Ibitegereje',
    backToDashboard: 'Subira',
    uploadNewReceipt: 'Risiti nshya',
    downloadStatement: 'Kuramo raporo',
    contactAdmin: 'Vugana na admin',
    paymentsTitle: 'Ubwishyu'
  }
};

const getStoredLanguage = () => {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return languages.some((language) => language.code === stored) ? stored : 'en';
  } catch (_) {
    return 'en';
  }
};

const setStoredLanguage = (languageCode) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
    window.dispatchEvent(new CustomEvent('tp:language-changed', { detail: { language: languageCode } }));
  } catch (_) {}
};

const useTenantLanguage = () => {
  const [language, setLanguage] = React.useState(getStoredLanguage);

  React.useEffect(() => {
    const handleChange = (event) => {
      setLanguage(event.detail?.language || getStoredLanguage());
    };
    window.addEventListener('tp:language-changed', handleChange);
    window.addEventListener('storage', handleChange);
    return () => {
      window.removeEventListener('tp:language-changed', handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, []);

  return [language, navTranslations[language] || navTranslations.en];
};

const formatTenantText = (template = '', values = {}) => (
  String(template).replace(/\{(\w+)\}/g, (_match, key) => values[key] ?? '')
);

const TenantLanguageSelect = ({ compact = false }) => {
  const [language, copy] = useTenantLanguage();

  const handleChange = (event) => {
    setStoredLanguage(event.target.value);
  };

  return (
    <label className={`tp-language-select${compact ? ' compact' : ''}`}>
      <span>{copy.language}</span>
      <select value={language} onChange={handleChange} aria-label="Tenant portal language">
        {languages.map((item) => (
          <option key={item.code} value={item.code}>{item.label}</option>
        ))}
      </select>
    </label>
  );
};

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
  if (payload.event_type === 'tenant_rent_due') {
    return {
      title: payload.title || 'Rent payment reminder',
      message: payload.message || 'Your rent payment is due soon.'
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
  const [, copy] = useTenantLanguage();
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
      <span>{busy ? copy.enabling : enabled ? copy.alertsOn : copy.enableAlerts}</span>
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
  const [, copy] = useTenantLanguage();
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
      {mobileOnly ? <TenantLanguageSelect compact /> : null}
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
            <span className="tp-nav-label">{copy[item.id] || item.shortLabel || item.label}</span>
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
export { formatTenantText, TenantLanguageSelect, useTenantLanguage };
