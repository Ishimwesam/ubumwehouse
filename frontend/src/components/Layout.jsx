import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  chatService,
  contractService,
  paymentService,
  realtimeService,
  resolveUploadUrl,
  tenantPortalAdminService,
  tenantService,
  unitService
} from '../services/api';
import Sidebar, { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from './Sidebar';
import SessionWarning from './SessionWarning';
import ApiRecoveryNotice from './ApiRecoveryNotice';
import NetworkStatusBanner from './NetworkStatusBanner';
import MainSystemInstallPrompt from './MainSystemInstallPrompt';
import { useSpinner } from '../context/SpinnerContext';

// Theme context for light/dark mode
export const ThemeContext = React.createContext({ theme: 'light', toggleTheme: () => {} });

const HeaderIconButton = ({ children, badge, onClick, title }) => (
  <button
    type="button"
    className="header-icon-button"
    onClick={onClick}
    title={title}
    aria-label={title}
    style={{
      width: 48,
      height: 48,
      borderRadius: '999px',
      border: '1.5px solid rgba(149, 175, 222, 0.9)',
      background: 'linear-gradient(180deg, #f0f6ff 0%, #e6f0fd 100%)',
      color: '#16224a',
      position: 'relative',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(37, 71, 127, 0.12)',
      overflow: 'visible',
      transition: 'transform 0.2s ease, box-shadow 0.24s ease, border-color 0.24s ease'
    }}
  >
    <span className="header-icon-button-core" style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{children}</span>
    {badge > 0 ? (
      <span className="header-icon-badge" style={{
        position: 'absolute',
        top: 2,
        right: 0,
        minWidth: 20,
        height: 20,
        borderRadius: '999px',
        padding: '0 6px',
        background: 'linear-gradient(135deg, #fb7185 0%, #ef4444 60%, #dc2626 100%)',
        color: '#ffffff',
        fontSize: 11,
        fontWeight: 800,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 16px rgba(239, 68, 68, 0.36)',
        border: '2px solid rgba(255,255,255,0.9)'
      }}>{badge}</span>
    ) : null}
  </button>
);

const ProfileAvatarImage = ({ src, alt, imageStyle, fallbackStyle, fallbackText }) => {
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return <span style={fallbackStyle}>{fallbackText}</span>;
  }

  return (
    <>
      {!loaded ? <span style={fallbackStyle}>{fallbackText}</span> : null}
      <img
        src={src}
        alt={alt}
        style={{ ...imageStyle, display: loaded ? imageStyle?.display : 'none' }}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </>
  );
};

const BellIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a2d6d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </svg>
);

const PaymentNotificationIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.6 8.4h11.2a2.3 2.3 0 0 1 2.3 2.3v6.1a2.3 2.3 0 0 1-2.3 2.3H6.9a2.3 2.3 0 0 1-2.3-2.3z" />
    <path d="M6.2 8.4 14.8 5.7c1.3-.4 2.7.5 2.7 1.9v.8" />
    <rect x="14.1" y="11.7" width="5.2" height="3.7" rx="1.6" />
  </svg>
);

const ContractNotificationIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 3.5h7l4 4v13A1.5 1.5 0 0 1 16.5 22h-9A1.5 1.5 0 0 1 6 20.5V5A1.5 1.5 0 0 1 7 3.5Z" />
    <path d="M14 3.5V8h4" />
    <path d="M9 12h6M9 15.6h6M9 19.2h4.5" />
  </svg>
);

const TenantNotificationIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="8" r="2.35" />
    <circle cx="17" cy="8" r="2.35" />
    <circle cx="12" cy="11.2" r="2.8" />
    <path d="M4 19.3v-.9a3.8 3.8 0 0 1 3.8-3.8h.3a3.7 3.7 0 0 1 2.3.8" />
    <path d="M13.6 15.4a3.6 3.6 0 0 1 2.3-.8h.3a3.8 3.8 0 0 1 3.8 3.8v.9" />
    <path d="M7.8 19.8v-1.4a4.2 4.2 0 0 1 4.2-4.2h0a4.2 4.2 0 0 1 4.2 4.2v1.4" />
  </svg>
);

const UnitNotificationIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4.5" y="3.5" width="9.8" height="17" rx="1.6" />
    <rect x="15.6" y="8" width="3.9" height="12.5" rx="1.1" />
    <path d="M8.1 20.5v-4.3h2.5v4.3" />
  </svg>
);

const EventNotificationIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 5 5L20 7" />
  </svg>
);

const ChatIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a2d6d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.78-.88L3 21l1.97-5.27A8.5 8.5 0 1 1 21 11.5Z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#42537a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16224a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

const MoonIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a2d6d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 14.4A7.6 7.6 0 0 1 9.6 3 8.2 8.2 0 1 0 21 14.4Z" />
  </svg>
);

const SunIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a2d6d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const ClockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const KeyboardIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a2d6d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 9h.01M11 9h.01M15 9h.01M19 9h.01M7 13h.01M11 13h.01M15 13h.01M8 17h8" />
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21a8 8 0 0 0-16 0" />
    <circle cx="12" cy="8" r="4" />
  </svg>
);

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.09V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87-.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.09-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.09V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.28.29.49.64.6 1 .14.31.21.65.2 1 .01.35-.06.69-.2 1-.11.36-.32.71-.6 1Z" />
  </svg>
);

const DashboardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.4" />
    <rect x="14" y="3" width="7" height="7" rx="1.4" />
    <rect x="3" y="14" width="7" height="7" rx="1.4" />
    <rect x="14" y="14" width="7" height="7" rx="1.4" />
  </svg>
);

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

const RECENT_ACTIVITY_WINDOW_MS = 1000 * 60 * 60 * 24 * 14;
const UPCOMING_WINDOW_MS = 1000 * 60 * 60 * 24 * 7;

const normalizeDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatNotificationTime = (value) => {
  const date = normalizeDate(value);
  if (!date) return 'Just now';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(Math.round(diffMs / (1000 * 60)), 0);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays <= 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
};

const formatChatTime = (value) => {
  const date = normalizeDate(value);
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getInitials = (value = 'User') => {
  const parts = String(value || 'User').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
};

const formatFooterDateTime = (date) => ({
  time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  date: date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
});

const isRecentDate = (value, windowMs = RECENT_ACTIVITY_WINDOW_MS) => {
  const date = normalizeDate(value);
  if (!date) return false;
  return Math.abs(Date.now() - date.getTime()) <= windowMs;
};

const isUpcomingDate = (value, windowMs = UPCOMING_WINDOW_MS) => {
  const date = normalizeDate(value);
  if (!date) return false;
  const diff = date.getTime() - Date.now();
  return diff >= 0 && diff <= windowMs;
};

const getDaysUntil = (value) => {
  const date = normalizeDate(value);
  if (!date) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
};

const getNotificationTone = (type) => {
  if (type === 'payment' || type === 'tenant') return 'info';
  if (type === 'contract' || type === 'event') return 'warning';
  if (type === 'unit') return 'success';
  return 'neutral';
};

const getNotificationIcon = (type) => {
  if (type === 'payment') return <PaymentNotificationIcon />;
  if (type === 'contract') return <ContractNotificationIcon />;
  if (type === 'tenant') return <TenantNotificationIcon />;
  if (type === 'unit') return <UnitNotificationIcon />;
  if (type === 'event') return <EventNotificationIcon />;
  return <BellIcon />;
};

const chatQuickMessages = [
  'Please review this when you get a moment.',
  'Rent follow-up completed.',
  'Can you confirm this payment?',
  'I need a quick update on this tenant.'
];

const keyboardShortcuts = [
  { keys: ['Ctrl/⌘', 'K'], label: 'Focus global search' },
  { keys: ['/'], label: 'Focus global search' },
  { keys: ['?'], label: 'Open keyboard help' },
  { keys: ['Esc'], label: 'Close popups and dialogs' },
  { keys: ['Alt', '1'], label: 'Dashboard' },
  { keys: ['Alt', '2'], label: 'Tenants' },
  { keys: ['Alt', '3'], label: 'Buildings' },
  { keys: ['Alt', '4'], label: 'Units' },
  { keys: ['Alt', '5'], label: 'Rent Collection Sheet' },
  { keys: ['Alt', '6'], label: 'Payments' },
  { keys: ['Alt', '7'], label: 'Reports' },
  { keys: ['Alt', '8'], label: 'Events Calendar' },
  { keys: ['Alt', '9'], label: 'Settings' },
  { keys: ['Alt', '0'], label: 'Focus page content' },
  { keys: ['Ctrl/⌘', 'B'], label: 'Collapse or open sidebar' },
  { keys: ['Ctrl/⌘', 'J'], label: 'Open chat room' },
  { keys: ['Ctrl/⌘', 'N'], label: 'Open notifications' },
  { keys: ['Ctrl/⌘', 'M'], label: 'Toggle dark mode' },
  { keys: ['Double Click Header'], label: 'Focus global search' },
  { keys: ['Double Click Footer'], label: 'Toggle dark mode' },
  { keys: ['Double Click Empty Page'], label: 'Focus page content' }
];

const shortcutRoutes = {
  '1': '/dashboard',
  '2': '/tenants',
  '3': '/buildings',
  '4': '/units',
  '5': '/monthly-rent-sheet',
  '6': '/payments',
  '7': '/reports',
  '8': '/calendar-events',
  '9': '/settings'
};

const routeMeta = (pathname) => {
  if (pathname.startsWith('/dashboard')) return { title: 'Dashboard', subtitle: 'Property performance and quick actions' };
  if (pathname.startsWith('/tenants')) return { title: 'Tenants', subtitle: 'Resident records, balances, and status' };
  if (pathname.startsWith('/buildings/')) return { title: 'Building Details', subtitle: 'Property information, units, and occupancy' };
  if (pathname.startsWith('/buildings')) return { title: 'Buildings', subtitle: 'Registered properties and portfolio overview' };
  if (pathname.startsWith('/units')) return { title: 'Units', subtitle: 'Availability, rent, and assignment management' };
  if (pathname.startsWith('/contracts')) return { title: 'Contracts', subtitle: 'Lease agreements and contract history' };
  if (pathname.startsWith('/expenses')) return { title: 'Expenses', subtitle: 'Operational spending and cost tracking' };
  if (pathname.startsWith('/payments')) return { title: 'Payments', subtitle: 'Collections, receipts, and confirmation flow' };
  if (pathname.startsWith('/payment-history')) return { title: 'Payment History', subtitle: 'Tenant-by-tenant payment records' };
  if (pathname.startsWith('/manual-confirmation')) return { title: 'Manual Confirmation', subtitle: 'Review and approve pending receipts' };
  if (pathname.startsWith('/daily-income')) return { title: 'Daily Income', subtitle: 'Today’s collection summary and trends' };
  if (pathname.startsWith('/monthly-rent-sheet')) return { title: 'Rent Collection Sheet', subtitle: 'Monthly rent sheet and collection status' };
  if (pathname.startsWith('/calendar-events')) return { title: 'Events Calendar', subtitle: 'Schedules, reminders, and important dates' };
  if (pathname.startsWith('/operations')) return { title: 'Operations Center', subtitle: 'Urgent work, reminders, and recovery workflows' };
  if (pathname.startsWith('/export-center')) return { title: 'Export Center', subtitle: 'Reports, ledgers, sheets, and PDF downloads' };
  if (pathname.startsWith('/reports')) return { title: 'Reports Center', subtitle: 'Analytics, exports, and business insights' };
  if (pathname.startsWith('/advanced-reports')) return { title: 'Advanced Reports', subtitle: 'Deeper reporting and custom breakdowns' };
  if (pathname.startsWith('/system-health')) return { title: 'System Health', subtitle: 'Uptime, backups, messaging, and recovery status' };
  if (pathname.startsWith('/settings')) return { title: 'Settings', subtitle: 'Profile, access, and system preferences' };
  return { title: 'Workspace', subtitle: 'UBUMWE System Company management console' };
};

const Layout = ({ children }) => {
  const { show, showSpinner, hideSpinner } = useSpinner();
    // Theme state
    const [theme, setTheme] = useState(() => {
      try {
        return localStorage.getItem('theme') || 'light';
      } catch (_) {
        return 'light';
      }
    });
    const themeTransitionMountedRef = useRef(false);
    useEffect(() => {
      const root = document.documentElement;
      let transitionTimer;

      root.setAttribute('data-theme', theme);

      if (themeTransitionMountedRef.current) {
        root.classList.remove('theme-transitioning', 'theme-transitioning-light', 'theme-transitioning-dark');
        void root.offsetWidth;
        root.classList.add('theme-transitioning', `theme-transitioning-${theme}`);
        transitionTimer = window.setTimeout(() => {
          root.classList.remove('theme-transitioning', 'theme-transitioning-light', 'theme-transitioning-dark');
        }, 980);
      } else {
        themeTransitionMountedRef.current = true;
      }

      try {
        localStorage.setItem('theme', theme);
      } catch (_) {}

      return () => {
        if (transitionTimer) window.clearTimeout(transitionTimer);
      };
    }, [theme]);
    const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  const { user, logoutWithFarewell } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notificationStoreKey = user?.id ? `rms-notification-read-map-${user.id}` : 'rms-notification-read-map';
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('rms-sidebar-collapsed') === 'true';
    } catch (_) {
      return false;
    }
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChatRoom, setShowChatRoom] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const notificationPanelRef = useRef(null);
  const chatRoomPanelRef = useRef(null);
  const chatListRef = useRef(null);
  const profileMenuRef = useRef(null);
  const globalSearchInputRef = useRef(null);
  const mainContentRef = useRef(null);
  const contextMenuRef = useRef(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatUsers, setChatUsers] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatLastSeenAt, setChatLastSeenAt] = useState('');
  const [selectedChatTarget, setSelectedChatTarget] = useState('ROOM_GLOBAL');
  const [chatPriority, setChatPriority] = useState('normal');
  const [chatSearch, setChatSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalSearchActiveIndex, setGlobalSearchActiveIndex] = useState(0);
  const [globalSearchData, setGlobalSearchData] = useState({ tenants: [], payments: [], units: [], contracts: [] });
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, selectionText: '' });
  const [notifications, setNotifications] = useState([]);
  const [realtimeNotifications, setRealtimeNotifications] = useState([]);
  const [notificationRefreshTick, setNotificationRefreshTick] = useState(0);
  const [notificationStatus, setNotificationStatus] = useState({ state: 'connecting', label: 'Connecting live updates' });
  const [liveToast, setLiveToast] = useState(null); // { message, actionPath, id }
  const [bellPulsing, setBellPulsing] = useState(false);
  const prevUnreadRef = React.useRef(0);
  const [readNotifications, setReadNotifications] = useState(() => {
    try {
      const raw = localStorage.getItem(notificationStoreKey);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  });
  const profileImageUrl = React.useMemo(() => {
    if (!user?.profile_image) return null;
    const resolvedUrl = resolveUploadUrl(user.profile_image);
    if (!resolvedUrl) return null;
    const separator = resolvedUrl.includes('?') ? '&' : '?';
    const cacheBuster = encodeURIComponent(user?.updated_at || user?.profile_image);
    return `${resolvedUrl}${separator}v=${cacheBuster}`;
  }, [user?.profile_image, user?.updated_at]);
  const profileAvatarText = (user?.full_name || user?.username || 'A').charAt(0).toUpperCase();
  const chatSeenStoreKey = user?.id ? `rms-chat-last-seen-${user.id}-${selectedChatTarget}` : null;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(notificationStoreKey);
      setReadNotifications(raw ? JSON.parse(raw) : {});
    } catch (_) {
      setReadNotifications({});
    }
  }, [notificationStoreKey]);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('rms-sidebar-collapsed', String(sidebarCollapsed));
    } catch (_) {}
  }, [sidebarCollapsed]);

  const mergeNotificationItems = (items = []) => items
    .filter(Boolean)
    .filter((item, index, allItems) => allItems.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((first, second) => {
      const firstDate = normalizeDate(first.createdAt)?.getTime() || 0;
      const secondDate = normalizeDate(second.createdAt)?.getTime() || 0;
      return secondDate - firstDate;
    })
    .slice(0, 18)
    .map((item) => ({
      ...item,
      tone: item.tone || getNotificationTone(item.type),
      read: !!readNotifications[item.id]
    }));

  const getSettledData = (result, fallback = []) => (
    result.status === 'fulfilled' ? (result.value?.data || fallback) : fallback
  );

  const createRealtimeNotification = (eventData = {}) => {
    const method = String(eventData.method || '').toUpperCase();
    const path = String(eventData.path || '').toLowerCase();
    const createdAt = eventData.at || new Date().toISOString();
    const id = `realtime-${method || 'event'}-${path.replace(/[^a-z0-9]+/g, '-') || 'system'}-${createdAt}`;

    if (path.includes('/payments') && method === 'POST') {
      return { id, type: 'payment', title: 'Payment recorded', message: 'A new payment or receipt was added to the system.', createdAt, actionPath: '/payments' };
    }
    if (path.includes('/payments') && method === 'PUT') {
      return { id, type: 'payment', title: 'Payment updated', message: 'A payment record changed. Review the latest payment status.', createdAt, actionPath: '/payments' };
    }
    if (path.includes('/tenants') && method === 'POST') {
      return { id, type: 'tenant', title: 'Tenant added', message: 'A new tenant was registered in the system.', createdAt, actionPath: '/tenants' };
    }
    if (path.includes('/tenants') && method === 'PUT') {
      return { id, type: 'tenant', title: 'Tenant updated', message: 'A tenant record was updated.', createdAt, actionPath: '/tenants' };
    }
    if (path.includes('/contracts') && method === 'POST') {
      return { id, type: 'contract', title: 'Contract created', message: 'A new contract was created.', createdAt, actionPath: '/contracts' };
    }
    if (path.includes('/contracts') && method === 'PUT') {
      return { id, type: 'contract', title: 'Contract updated', message: 'A contract record was updated.', createdAt, actionPath: '/contracts' };
    }
    if (path.includes('/units') && method === 'POST') {
      return { id, type: 'unit', title: 'Unit added', message: 'A new unit was added.', createdAt, actionPath: '/units' };
    }
    if (path.includes('/units') && method === 'PUT') {
      return { id, type: 'unit', title: 'Unit updated', message: 'A unit record was updated.', createdAt, actionPath: '/units' };
    }
    if (path.includes('/buildings') && method === 'POST') {
      return { id, type: 'unit', title: 'Building added', message: 'A new building was added.', createdAt, actionPath: '/buildings' };
    }
    if (path.includes('/expenses') && method === 'POST') {
      return { id, type: 'payment', title: 'Expense recorded', message: 'A new expense was recorded.', createdAt, actionPath: '/expenses' };
    }
    if (path.includes('/calendar') || path.includes('/events')) {
      return { id, type: 'event', title: 'Calendar updated', message: 'A calendar event or reminder changed.', createdAt, actionPath: '/calendar-events' };
    }
    if (path.includes('/tenant-portal')) {
      return { id, type: 'tenant', title: 'Tenant portal activity', message: 'Tenant portal information changed.', createdAt, actionPath: '/tenant-portal-control' };
    }
    if (method === 'DELETE') {
      return { id, type: 'event', title: 'Record deleted', message: 'A system record was deleted.', createdAt, actionPath: null };
    }

    return null;
  };

  const createTenantMessageNotification = (message = {}) => {
    if (message.sender_type !== 'tenant') return null;
    const createdAt = message.created_at || new Date().toISOString();
    return {
      id: `tenant-message-${message.id || createdAt}`,
      type: 'tenant',
      title: 'Tenant portal message',
      message: `${message.tenant_name || 'A tenant'} sent a new message.`,
      createdAt,
      actionPath: '/tenant-portal-control',
      tone: 'info'
    };
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setRealtimeNotifications([]);
      return;
    }

    const loadNotifications = async () => {
      const settledResults = await Promise.allSettled([
        paymentService.getAll(),
        tenantService.getAll(),
        contractService.getAll(),
        unitService.getAll(),
        tenantService.getReminderEvents(),
        tenantPortalAdminService.listAccounts()
      ]);
      const [paymentsRes, tenantsRes, contractsRes, unitsRes, remindersRes, tenantPortalAccountsRes] = settledResults;
      const failedCount = settledResults.filter((result) => result.status === 'rejected').length;

      setNotificationStatus((current) => {
        if (current.state === 'live' && failedCount < settledResults.length) return current;
        if (failedCount === 0) return { state: 'synced', label: 'Synced just now' };
        if (failedCount < settledResults.length) return { state: 'partial', label: 'Live with retrying sources' };
        return { state: 'offline', label: 'Retrying notification services' };
      });

        const payments = getSettledData(paymentsRes);
        const tenants = getSettledData(tenantsRes);
        const contracts = getSettledData(contractsRes);
        const units = getSettledData(unitsRes);
        const reminderEvents = getSettledData(remindersRes);
        const tenantPortalAccountsData = getSettledData(tenantPortalAccountsRes, {});
        const tenantPortalAccounts = Array.isArray(tenantPortalAccountsData)
          ? tenantPortalAccountsData
          : (tenantPortalAccountsData.accounts || []);
        setGlobalSearchData({ tenants, payments, contracts, units });

        const nextNotifications = [];

        payments
          .filter((payment) => (payment.payment_status || 'confirmed') === 'confirmed' && isRecentDate(payment.created_at || payment.payment_date))
          .slice(0, 4)
          .forEach((payment) => {
            nextNotifications.push({
              id: `payment-received-${payment.id}`,
              type: 'payment',
              title: 'Payment received',
              message: `Payment received from ${payment.tenant_name || 'a tenant'}.`,
              createdAt: payment.created_at || payment.payment_date,
              actionPath: '/payments'
            });
          });

        payments
          .filter((payment) => payment.payment_status === 'pending')
          .slice(0, 4)
          .forEach((payment) => {
            nextNotifications.push({
              id: `payment-pending-${payment.id}`,
              type: 'payment',
              title: 'Payment pending',
              message: `Payment pending from ${payment.tenant_name || 'a tenant'}.`,
              createdAt: payment.created_at || payment.payment_date,
              actionPath: '/manual-confirmation'
            });
          });

        tenants
          .filter((tenant) => parseFloat(tenant.balance || 0) > 0)
          .slice(0, 4)
          .forEach((tenant) => {
            nextNotifications.push({
              id: `late-payment-${tenant.id}`,
              type: 'payment',
              title: 'Late payment',
              message: `${tenant.full_name || 'A tenant'} still has ${parseFloat(tenant.balance || 0).toLocaleString()} RWF unpaid.`,
              createdAt: tenant.updated_at || tenant.move_in_date || new Date().toISOString(),
              actionPath: '/tenants'
            });
          });

        contracts
          .filter((contract) => contract.lifecycle_status === 'active' && getDaysUntil(contract.contract_end) !== null && getDaysUntil(contract.contract_end) <= 30 && getDaysUntil(contract.contract_end) >= 0)
          .slice(0, 4)
          .forEach((contract) => {
            const daysUntil = getDaysUntil(contract.contract_end);
            nextNotifications.push({
              id: `contract-expiring-${contract.id}`,
              type: 'contract',
              title: 'Contract expiring soon',
              message: `${contract.tenant_name || 'A tenant'} contract expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}.`,
              createdAt: contract.contract_end,
              actionPath: '/contracts'
            });
          });

        contracts
          .filter((contract) => isRecentDate(contract.created_at || contract.contract_start))
          .slice(0, 3)
          .forEach((contract) => {
            nextNotifications.push({
              id: `contract-created-${contract.id}`,
              type: 'contract',
              title: 'Contract created',
              message: `New contract created for ${contract.tenant_name || 'a tenant'}.`,
              createdAt: contract.created_at || contract.contract_start,
              actionPath: '/contracts'
            });
          });

        tenants
          .filter((tenant) => isRecentDate(tenant.created_at || tenant.move_in_date))
          .slice(0, 4)
          .forEach((tenant) => {
            nextNotifications.push({
              id: `tenant-added-${tenant.id}`,
              type: 'tenant',
              title: 'New tenant added',
              message: `${tenant.full_name || 'A tenant'} was registered in the system.`,
              createdAt: tenant.created_at || tenant.move_in_date,
              actionPath: '/tenants'
            });
          });

        units
          .filter((unit) => isRecentDate(unit.created_at))
          .slice(0, 3)
          .forEach((unit) => {
            nextNotifications.push({
              id: `unit-added-${unit.id}`,
              type: 'unit',
              title: 'New unit added',
              message: `Unit ${unit.unit_number || 'N/A'} was added${unit.building_name ? ` in ${unit.building_name}` : ''}.`,
              createdAt: unit.created_at,
              actionPath: '/units'
            });
          });

        units
          .filter((unit) => unit.status === 'available')
          .slice(0, 4)
          .forEach((unit) => {
            nextNotifications.push({
              id: `unit-available-${unit.id}`,
              type: 'unit',
              title: 'Unit available',
              message: `Unit ${unit.unit_number || 'N/A'} is available for occupancy.`,
              createdAt: unit.updated_at || unit.created_at || new Date().toISOString(),
              actionPath: '/units'
            });
          });

        reminderEvents
          .filter((event) => isUpcomingDate(event.start))
          .slice(0, 4)
          .forEach((event) => {
            nextNotifications.push({
              id: `event-${event.id}`,
              type: 'event',
              title: 'Upcoming deadline',
              message: event.title || 'Scheduled event is coming up soon.',
              createdAt: event.start,
              actionPath: event.actionPath || '/calendar-events'
            });
          });

        const unreadTenantPortalMessages = tenantPortalAccounts.reduce(
          (sum, account) => sum + Number(account.unread_tenant_messages || 0),
          0
        );

        if (unreadTenantPortalMessages > 0) {
          nextNotifications.push({
            id: 'tenant-portal-unread',
            type: 'tenant',
            title: 'Tenant portal messages',
            message: `${unreadTenantPortalMessages} unread tenant message${unreadTenantPortalMessages === 1 ? '' : 's'} in the portal inbox.`,
            createdAt: new Date().toISOString(),
            actionPath: '/tenant-portal-control'
          });
        }

      setNotifications(mergeNotificationItems([...realtimeNotifications, ...nextNotifications]));
    };

    loadNotifications();
    const intervalId = setInterval(loadNotifications, 60000);
    return () => clearInterval(intervalId);
  }, [user, readNotifications, notificationRefreshTick, realtimeNotifications]);

  useEffect(() => {
    if (!user) return undefined;

    const streamUrl = realtimeService.getNotificationStreamUrl();
    if (!streamUrl) {
      setNotificationStatus({ state: 'polling', label: 'Polling updates' });
      return undefined;
    }

    const pathToToast = (method, path) => {
      const p = String(path || '').toLowerCase();
      if (p.includes('/payments') && method === 'POST') return { message: 'New payment recorded', actionPath: '/payments' };
      if (p.includes('/payments') && method === 'PUT') return { message: 'Payment updated', actionPath: '/payments' };
      if (p.includes('/tenants') && method === 'POST') return { message: 'New tenant added', actionPath: '/tenants' };
      if (p.includes('/tenants') && method === 'PUT') return { message: 'Tenant record updated', actionPath: '/tenants' };
      if (p.includes('/contracts') && method === 'POST') return { message: 'New contract created', actionPath: '/contracts' };
      if (p.includes('/contracts') && method === 'PUT') return { message: 'Contract updated', actionPath: '/contracts' };
      if (p.includes('/units') && method === 'POST') return { message: 'New unit added', actionPath: '/units' };
      if (p.includes('/units') && method === 'PUT') return { message: 'Unit updated', actionPath: '/units' };
      if (p.includes('/buildings') && method === 'POST') return { message: 'New building added', actionPath: '/buildings' };
      if (p.includes('/expenses') && method === 'POST') return { message: 'Expense recorded', actionPath: '/expenses' };
      if (p.includes('/calendar') || p.includes('/events')) return { message: 'Calendar updated', actionPath: '/calendar-events' };
      if (p.includes('/tenant-portal') && method === 'POST') return { message: 'Tenant portal activity', actionPath: '/tenant-portal-control' };
      if (method === 'DELETE') return { message: 'Record deleted', actionPath: null };
      return null;
    };

    const source = new EventSource(streamUrl);
    source.onopen = () => {
      setNotificationStatus({ state: 'live', label: 'Live now' });
    };
    const handleRefresh = (evt) => {
      try {
        const data = JSON.parse(evt.data || '{}');
        const realtimeNotification = createRealtimeNotification(data);
        if (realtimeNotification) {
          setRealtimeNotifications((prev) => mergeNotificationItems([realtimeNotification, ...prev]));
          setNotifications((prev) => mergeNotificationItems([realtimeNotification, ...prev]));
        }

        const toast = pathToToast(data.method, data.path);
        if (toast) {
          const toastId = `toast-${Date.now()}`;
          setLiveToast({ ...toast, id: toastId });
          setBellPulsing(true);
          setTimeout(() => setLiveToast(null), 5000);
          setTimeout(() => setBellPulsing(false), 2000);
        }
      } catch (_) { /* ignore */ }
      setNotificationRefreshTick((current) => current + 1);
    };

    source.addEventListener('refresh', handleRefresh);
    source.onerror = () => {
      setNotificationStatus({ state: 'reconnecting', label: 'Reconnecting live updates' });
    };

    return () => {
      source.removeEventListener('refresh', handleRefresh);
      source.close();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return undefined;

    const streamUrl = tenantPortalAdminService.getStreamUrl();
    if (!streamUrl) return undefined;

    const source = new EventSource(streamUrl);
    source.onopen = () => {
      setNotificationStatus({ state: 'live', label: 'Live now' });
    };
    const handleMessage = (evt) => {
      try {
        const data = JSON.parse(evt.data || '{}');
        const realtimeNotification = createTenantMessageNotification(data);
        if (!realtimeNotification) return;

        setRealtimeNotifications((prev) => mergeNotificationItems([realtimeNotification, ...prev]));
        setNotifications((prev) => mergeNotificationItems([realtimeNotification, ...prev]));
        setLiveToast({
          id: realtimeNotification.id,
          message: realtimeNotification.message,
          actionPath: realtimeNotification.actionPath
        });
        setBellPulsing(true);
        setTimeout(() => setLiveToast(null), 5000);
        setTimeout(() => setBellPulsing(false), 2000);
        setNotificationRefreshTick((current) => current + 1);
      } catch (_) { /* ignore malformed stream messages */ }
    };

    source.addEventListener('message', handleMessage);
    source.onerror = () => {
      setNotificationStatus({ state: 'reconnecting', label: 'Reconnecting live updates' });
    };

    return () => {
      source.removeEventListener('message', handleMessage);
      source.close();
    };
  }, [user?.id]);

  useEffect(() => {
    localStorage.setItem(notificationStoreKey, JSON.stringify(readNotifications));
  }, [notificationStoreKey, readNotifications]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        contextMenuRef.current &&
        contextMenuRef.current.contains(event.target)
      ) return;
      if (
        notificationPanelRef.current &&
        notificationPanelRef.current.contains(event.target)
      ) return;
      if (
        chatRoomPanelRef.current &&
        chatRoomPanelRef.current.contains(event.target)
      ) return;
      if (
        profileMenuRef.current &&
        profileMenuRef.current.contains(event.target)
      ) return;
      setShowNotifications(false);
      setShowChatRoom(false);
      setShowProfileMenu(false);
      setContextMenu((prev) => ({ ...prev, open: false }));
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setChatMessages([]);
      setChatUsers([]);
      return;
    }

    const loadChatMessages = async () => {
      try {
        const response = await chatService.getMessages({
          limit: 120,
          receiver_id: selectedChatTarget
        });
        setChatMessages(response.data || []);
      } catch (_) {
        // Keep UI responsive even if chat endpoint is unavailable.
      }
    };

    loadChatMessages();
    const intervalId = setInterval(loadChatMessages, 5000);
    return () => clearInterval(intervalId);
  }, [user, selectedChatTarget]);

  useEffect(() => {
    if (!user) {
      setChatUsers([]);
      return;
    }

    const loadChatUsers = async () => {
      try {
        const response = await chatService.getUsers();
        setChatUsers(response.data || []);
      } catch (_) {
        setChatUsers([]);
      }
    };

    loadChatUsers();
  }, [user]);

  useEffect(() => {
    if (!chatSeenStoreKey) {
      setChatLastSeenAt('');
      return;
    }

    const lastSeen = localStorage.getItem(chatSeenStoreKey) || '';
    setChatLastSeenAt(lastSeen);
  }, [chatSeenStoreKey]);

  const markChatAsRead = () => {
    if (!chatSeenStoreKey || !user?.id || chatMessages.length === 0) return;

    const latestIncomingStamp = chatMessages
      .filter((message) => message.user_id !== user.id)
      .map((message) => message.created_at || '')
      .sort()
      .pop();

    if (!latestIncomingStamp) return;
    localStorage.setItem(chatSeenStoreKey, latestIncomingStamp);
    setChatLastSeenAt(latestIncomingStamp);
  };

  useEffect(() => {
    if (showChatRoom) {
      markChatAsRead();
    }
  }, [showChatRoom, chatMessages]);

  const unreadChatCount = chatMessages.reduce((count, message) => {
    if (message.user_id === user?.id) return count;
    if (!chatLastSeenAt) return count + 1;
    return (message.created_at || '') > chatLastSeenAt ? count + 1 : count;
  }, 0);

  const unreadNotificationCount = notifications.filter((item) => !item.read).length;

  // Pulse bell when unread count grows (new item arrived while panel closed)
  React.useEffect(() => {
    if (!showNotifications && unreadNotificationCount > prevUnreadRef.current) {
      setBellPulsing(true);
      setTimeout(() => setBellPulsing(false), 2000);
    }
    prevUnreadRef.current = unreadNotificationCount;
  }, [unreadNotificationCount, showNotifications]);
  const chatTargets = [
    { id: 'ROOM_GLOBAL', full_name: 'Team Room', username: 'Everyone', role: 'shared' },
    ...chatUsers.filter((chatUser) => chatUser.id !== user?.id)
  ];
  const activeChatTarget = chatTargets.find((target) => target.id === selectedChatTarget) || chatTargets[0];
  const filteredChatMessages = chatSearch.trim()
    ? chatMessages.filter((message) => {
      const query = chatSearch.trim().toLowerCase();
      return [
        message.message,
        message.sender_name,
        message.sender_username,
        message.receiver_name,
        message.priority
      ].some((value) => String(value || '').toLowerCase().includes(query));
    })
    : chatMessages;
  useEffect(() => {
    if (!showChatRoom || !chatListRef.current) return;
    chatListRef.current.scrollTo({
      top: chatListRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, [showChatRoom, filteredChatMessages.length, selectedChatTarget]);
  const isTablet = viewportWidth < 1080;
  const isTabletHeader = viewportWidth < 1180;
  const isCompactHeader = viewportWidth < 920;
  const isTinyHeader = viewportWidth < 640;
  const headerDigitalClock = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const [clockHours = '00', clockMinutes = '00', clockSeconds = '00'] = headerDigitalClock.split(':');
  const currentRoute = routeMeta(location.pathname);
  const footerDateTime = formatFooterDateTime(currentTime);
  const closeTransientPanels = () => {
    setShowNotifications(false);
    setShowChatRoom(false);
    setShowProfileMenu(false);
    setShowKeyboardHelp(false);
    setContextMenu((prev) => ({ ...prev, open: false }));
  };

  const focusGlobalSearch = () => {
    setShowNotifications(false);
    setShowChatRoom(false);
    setShowProfileMenu(false);
    setTimeout(() => {
      globalSearchInputRef.current?.focus();
      globalSearchInputRef.current?.select();
    }, 0);
  };

  const focusMainContent = () => {
    closeTransientPanels();
    setTimeout(() => mainContentRef.current?.focus(), 0);
  };

  const closeContextMenu = () => setContextMenu((prev) => ({ ...prev, open: false }));

  const isNativeEditingTarget = (target) => {
    const tagName = target?.tagName?.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable;
  };

  const isDoubleClickSafeTarget = (target) => {
    if (isNativeEditingTarget(target)) return false;
    if (String(window.getSelection?.().toString() || '').trim()) return false;
    return !target?.closest?.('button, a, table, form, [role="button"], [role="menu"], [role="dialog"], [data-disable-double-click="true"], .system-context-menu');
  };

  const handleContextMenu = (event) => {
    if (isNativeEditingTarget(event.target) || event.target?.closest?.('[data-native-context-menu="true"]')) {
      return;
    }

    event.preventDefault();
    const menuWidth = 260;
    const menuHeight = 390;
    const x = Math.min(event.clientX, Math.max(window.innerWidth - menuWidth - 10, 10));
    const y = Math.min(event.clientY, Math.max(window.innerHeight - menuHeight - 10, 10));
    const selectionText = String(window.getSelection?.().toString() || '').trim();

    setShowNotifications(false);
    setShowChatRoom(false);
    setShowProfileMenu(false);
    setContextMenu({ open: true, x, y, selectionText });
  };

  const handleDoubleClick = (event) => {
    if (!isDoubleClickSafeTarget(event.target)) return;

    closeContextMenu();

    if (event.target.closest('.app-top-header')) {
      focusGlobalSearch();
      return;
    }

    if (event.target.closest('.app-footer-clock')) {
      toggleTheme();
      return;
    }

    if (event.target === mainContentRef.current || event.target.closest('.app-content-shell')) {
      focusMainContent();
    }
  };

  const runContextAction = async (action) => {
    closeContextMenu();

    if (action === 'search') {
      focusGlobalSearch();
      return;
    }
    if (action === 'refresh') {
      window.location.reload();
      return;
    }
    if (action === 'copy-selection') {
      try {
        if (contextMenu.selectionText) await navigator.clipboard.writeText(contextMenu.selectionText);
      } catch (_) {}
      return;
    }
    if (action === 'print') {
      window.print();
      return;
    }
    if (action === 'back') {
      navigate(-1);
      return;
    }
    if (action === 'chat') {
      setShowChatRoom(true);
      setShowNotifications(false);
      setShowProfileMenu(false);
      return;
    }
    if (action === 'notifications') {
      setShowNotifications(true);
      setShowChatRoom(false);
      setShowProfileMenu(false);
      return;
    }
    if (action === 'theme') {
      toggleTheme();
      return;
    }
    if (action === 'keyboard') {
      setShowKeyboardHelp(true);
      return;
    }

    if (action.startsWith('nav:')) {
      navigate(action.replace('nav:', ''));
    }
  };
  const markNotificationAsRead = (notificationId) => {
    setReadNotifications((prev) => ({
      ...prev,
      [notificationId]: true
    }));
    setNotifications((prev) => prev.map((notification) => (
      notification.id === notificationId ? { ...notification, read: true } : notification
    )));
  };

  const handleNotificationClick = async (item) => {
    markNotificationAsRead(item.id);
    setShowNotifications(false);
    if (item?.actionPath) {
      showSpinner();
      setTimeout(() => {
        navigate(item.actionPath);
        hideSpinner();
      }, 400);
    }
  };

  const handleMarkAllNotificationsRead = () => {
    const nextReadMap = notifications.reduce((acc, item) => {
      acc[item.id] = true;
      return acc;
    }, {});

    setReadNotifications((prev) => ({
      ...prev,
      ...nextReadMap
    }));
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  const handleSendChatMessage = async () => {
    const message = chatInput.trim();
    if (!message || chatLoading) return;

    setChatLoading(true);
    try {
      const response = await chatService.sendMessage(message, {
        receiver_id: selectedChatTarget,
        priority: chatPriority
      });
      setChatMessages((prev) => [...prev, response.data]);
      setChatInput('');
      setChatPriority('normal');
    } catch (_) {
      // Ignore UI interruption and allow retry.
    } finally {
      setChatLoading(false);
    }
  };

  const globalSearchResults = globalSearch.trim().length < 2 ? [] : (() => {
    const query = globalSearch.trim().toLowerCase();
    const tenantResults = globalSearchData.tenants
      .filter((tenant) => [tenant.full_name, tenant.phone, tenant.email, tenant.national_id, tenant.unit_number, tenant.building_name].some((value) => String(value || '').toLowerCase().includes(query)))
      .slice(0, 4)
      .map((tenant) => ({ id: `tenant-${tenant.id}`, title: tenant.full_name || 'Tenant', subtitle: `${tenant.building_name || 'Building'} / ${tenant.unit_number || 'Unit'} / ${tenant.phone || ''}`, path: `/tenants/${tenant.id}/ledger`, type: 'Tenant' }));
    const paymentResults = globalSearchData.payments
      .filter((payment) => [payment.id, payment.verification_code, payment.tenant_name, payment.payment_period, payment.unit_number, payment.building_name].some((value) => String(value || '').toLowerCase().includes(query)))
      .slice(0, 4)
      .map((payment) => ({ id: `payment-${payment.id}`, title: payment.tenant_name || 'Payment', subtitle: `${payment.payment_period || '-'} / ${payment.amount || 0} RWF / ${payment.payment_status || 'confirmed'}`, path: '/payments', type: 'Payment' }));
    const unitResults = globalSearchData.units
      .filter((unit) => [unit.unit_number, unit.building_name, unit.status, unit.floor].some((value) => String(value || '').toLowerCase().includes(query)))
      .slice(0, 3)
      .map((unit) => ({ id: `unit-${unit.id}`, title: unit.unit_number || 'Unit', subtitle: `${unit.building_name || 'Building'} / ${unit.status || ''}`, path: '/units', type: 'Unit' }));
    return [...tenantResults, ...paymentResults, ...unitResults].slice(0, 8);
  })();

  useEffect(() => {
    setGlobalSearchActiveIndex(0);
  }, [globalSearch]);

  const openGlobalSearchResult = (result) => {
    setGlobalSearch('');
    setShowNotifications(false);
    setShowChatRoom(false);
    setShowProfileMenu(false);
    navigate(result.path);
  };

  const contextMenuItems = [
    { id: 'search', label: 'Search System', hint: 'Ctrl/⌘ K', action: 'search' },
    { id: 'refresh', label: 'Refresh Page Data', hint: 'Reload', action: 'refresh' },
    ...(contextMenu.selectionText ? [{ id: 'copy-selection', label: 'Copy Selected Text', hint: 'Clipboard', action: 'copy-selection' }] : []),
    { id: 'dashboard', label: 'Go to Dashboard', hint: 'Alt 1', action: 'nav:/dashboard' },
    { id: 'rent-sheet', label: 'Rent Collection Sheet', hint: 'Alt 5', action: 'nav:/monthly-rent-sheet' },
    { id: 'payments', label: 'Payment Center', hint: 'Alt 6', action: 'nav:/payments' },
    { id: 'chat', label: 'Open Chat Room', hint: 'Ctrl/⌘ J', action: 'chat' },
    { id: 'notifications', label: 'Check Notifications', hint: 'Ctrl/⌘ N', action: 'notifications' },
    { id: 'theme', label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode', hint: 'Ctrl/⌘ M', action: 'theme' },
    { id: 'print', label: 'Print Current Page', hint: 'Print', action: 'print' },
    { id: 'keyboard', label: 'Keyboard Shortcuts', hint: '?', action: 'keyboard' },
    { id: 'double-click', label: 'Double-Click Roles', hint: 'Help', action: 'keyboard' },
    { id: 'back', label: 'Go Back', hint: 'History', action: 'back' }
  ];

  const handleGlobalSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setGlobalSearchActiveIndex((index) => Math.min(index + 1, Math.max(globalSearchResults.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setGlobalSearchActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'Enter' && globalSearchResults[globalSearchActiveIndex]) {
      event.preventDefault();
      openGlobalSearchResult(globalSearchResults[globalSearchActiveIndex]);
    }
  };

  useEffect(() => {
    const isEditableTarget = (target) => {
      const tagName = target?.tagName?.toLowerCase();
      return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable;
    };

    const handleGlobalKeyboard = (event) => {
      const key = String(event.key || '').toLowerCase();
      const modifier = event.metaKey || event.ctrlKey;

      if (event.key === 'Escape') {
        closeTransientPanels();
        setGlobalSearch('');
        return;
      }

      if (event.key === '?' && !isEditableTarget(event.target)) {
        event.preventDefault();
        setShowKeyboardHelp(true);
        setShowNotifications(false);
        setShowChatRoom(false);
        setShowProfileMenu(false);
        return;
      }

      if ((modifier && key === 'k') || (event.key === '/' && !isEditableTarget(event.target))) {
        event.preventDefault();
        focusGlobalSearch();
        return;
      }

      if (modifier && key === 'b') {
        event.preventDefault();
        if (isMobile) setSidebarOpen((prev) => !prev);
        else setSidebarCollapsed((prev) => !prev);
        return;
      }

      if (modifier && key === 'j') {
        event.preventDefault();
        setShowChatRoom((prev) => !prev);
        setShowNotifications(false);
        setShowProfileMenu(false);
        return;
      }

      if (modifier && key === 'n') {
        event.preventDefault();
        setShowNotifications((prev) => !prev);
        setShowChatRoom(false);
        setShowProfileMenu(false);
        return;
      }

      if (modifier && key === 'm') {
        event.preventDefault();
        toggleTheme();
        return;
      }

      if (event.altKey && key === '0') {
        event.preventDefault();
        focusMainContent();
        return;
      }

      if (event.altKey && shortcutRoutes[key]) {
        event.preventDefault();
        closeTransientPanels();
        navigate(shortcutRoutes[key]);
      }
    };

    document.addEventListener('keydown', handleGlobalKeyboard);
    return () => document.removeEventListener('keydown', handleGlobalKeyboard);
  }, [isMobile, navigate, toggleTheme]);

  const handleProfileAction = async (action) => {
    if (action === 'dashboard') {
      setShowProfileMenu(false);
      navigate('/dashboard');
      return;
    }

    if (action === 'settings') {
      setShowProfileMenu(false);
      navigate('/settings');
      return;
    }

    if (action === 'copy-email') {
      try {
        if (user?.email) {
          await navigator.clipboard.writeText(user.email);
        }
      } catch (_) {}
      setShowProfileMenu(false);
      return;
    }

    if (action === 'logout') {
      setShowProfileMenu(false);
      logoutWithFarewell();
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {show && <div style={{ zIndex: 99999, position: 'fixed', inset: 0 }} />}
      <div className="app-shell" style={styles.container} onContextMenu={handleContextMenu} onDoubleClick={handleDoubleClick}>
        {/* Sidebar for desktop */}
        {!isMobile && <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)} isMobile={false} />}
        {/* Sidebar for mobile (slide-in) */}
        {isMobile && sidebarOpen && (
          <>
            <div style={styles.overlay} onClick={() => setSidebarOpen(false)} />
            <Sidebar collapsed={false} onToggleCollapse={() => setSidebarOpen(false)} isMobile />
          </>
        )}
        <div className="app-main-shell" style={{ ...styles.mainContent, marginLeft: isMobile ? 0 : (sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH) }}>
          <div
            className="app-top-header"
            style={{
              ...styles.headerBar,
              padding: isMobile ? '10px 14px' : isTabletHeader ? '8px 14px 10px' : styles.headerBar.padding,
              minHeight: isMobile ? '64px' : isTabletHeader ? '70px' : styles.headerBar.minHeight,
              flexWrap: isTinyHeader || isTabletHeader ? 'wrap' : 'nowrap',
              rowGap: isTabletHeader ? '8px' : undefined
            }}
          >
            <div style={{ ...styles.headerLeft, width: isTabletHeader ? '100%' : 'auto' }}>
              {isMobile ? (
                <button type="button" style={styles.mobileMenuButton} onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
                  <MenuIcon />
                </button>
              ) : null}
              <div style={styles.brandPanel}>
                <div style={styles.brandMark}>
                  <img src="/samm.svg" alt="UBUMWE SYSTEM COMPANY" style={styles.brandLogo} />
                </div>
                <div style={styles.brandCopy}>
                  {!isCompactHeader ? (
                    <div className="brand-live-row" style={styles.brandTickerRow}>
                      <div className="workspace-offline-marquee" style={styles.brandTickerWrap} aria-label="UBUMWE SYSTEM COMPANY ticker">
                        <div className="workspace-offline-track" style={styles.brandTickerTrack}>
                          <span className="ticker-chip ticker-chip-primary" style={styles.brandTickerPrimary}>UBUMWE</span>
                          <span className="ticker-divider" style={styles.brandTickerDivider}>|</span>
                          <span className="ticker-chip ticker-chip-secondary" style={styles.brandTickerSecondary}>SYSTEM COMPANY</span>
                          <span className="ticker-divider" style={styles.brandTickerDivider}>|</span>
                          <span className="ticker-chip ticker-chip-primary" style={styles.brandTickerPrimary}>UBUMWE</span>
                          <span className="ticker-divider" style={styles.brandTickerDivider}>|</span>
                          <span className="ticker-chip ticker-chip-secondary" style={styles.brandTickerSecondary}>SYSTEM COMPANY</span>
                        </div>
                      </div>
                      <div className="header-digital-clock" style={styles.headerDigitalClock} title="Live digital clock">
                        <span className="header-digital-clock-icon" style={styles.headerDigitalClockIcon}><ClockIcon /></span>
                        <span className="header-digital-clock-text" style={styles.headerDigitalClockText}>
                          <span className="clock-segment clock-segment-hours" style={styles.headerDigitalClockSegment}>{clockHours}</span>
                          <span className="clock-colon" style={styles.headerDigitalClockColon}>:</span>
                          <span className="clock-segment clock-segment-minutes" style={styles.headerDigitalClockSegment}>{clockMinutes}</span>
                          <span className="clock-colon" style={styles.headerDigitalClockColon}>:</span>
                          <span className="clock-segment clock-segment-seconds" style={styles.headerDigitalClockSegment}>
                            <span className="clock-seconds-tens">{clockSeconds.charAt(0)}</span>
                            <span className="clock-seconds-ones">{clockSeconds.charAt(1)}</span>
                          </span>
                        </span>
                      </div>
                    </div>
                  ) : null}
                  <div style={{ ...styles.headerTitle, fontSize: isMobile ? '14px' : isCompactHeader ? '15px' : styles.headerTitle.fontSize }}>
                    {currentRoute.title}
                  </div>
                  {!isCompactHeader ? <div style={styles.headerSubtitle}>{currentRoute.subtitle}</div> : null}
                </div>
              </div>
            </div>

            <div className="main-header-right" style={{ ...styles.headerRight, gap: isMobile ? '2px' : styles.headerRight.gap, width: isTinyHeader || isTabletHeader ? '100%' : 'auto', justifyContent: isTinyHeader ? 'space-between' : 'flex-end', flexWrap: isTabletHeader ? 'wrap' : 'nowrap' }}>
              {!isCompactHeader ? (
                <div className="main-global-search-wrap" style={styles.globalSearchWrap}>
                  <SearchIcon />
                  <input
                    id="global-search-input"
                    name="global_search"
                    ref={globalSearchInputRef}
                    value={globalSearch}
                    onChange={(event) => setGlobalSearch(event.target.value)}
                    onKeyDown={handleGlobalSearchKeyDown}
                    placeholder="Search tenant, room, receipt..."
                    style={styles.globalSearchInput}
                    aria-label="Global search"
                    aria-controls="global-search-results"
                    aria-expanded={globalSearch.trim().length >= 2}
                  />
                  {globalSearch.trim().length >= 2 ? (
                    <div id="global-search-results" className="animated-dropdown" style={{ ...styles.headerDropdown, ...styles.globalSearchDropdown }} role="listbox">
                      {globalSearchResults.length ? globalSearchResults.map((result, index) => (
                        <button
                          key={result.id}
                          type="button"
                          role="option"
                          aria-selected={index === globalSearchActiveIndex}
                          style={{
                            ...styles.globalSearchResult,
                            ...(index === globalSearchActiveIndex ? styles.globalSearchResultActive : {})
                          }}
                          onMouseEnter={() => setGlobalSearchActiveIndex(index)}
                          onClick={() => openGlobalSearchResult(result)}
                        >
                          <span style={styles.globalSearchType}>{result.type}</span>
                          <span style={styles.globalSearchTitle}>{result.title}</span>
                          <span style={styles.globalSearchSubtitle}>{result.subtitle}</span>
                        </button>
                      )) : <div style={styles.emptyDropdown}>No matching records.</div>}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="main-header-action-panel" aria-label="Quick header actions">
                {!isCompactHeader ? <MainSystemInstallPrompt /> : null}

              <HeaderIconButton
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={toggleTheme}
              >
                <span style={styles.themeIcon}>{theme === 'dark' ? <SunIcon /> : <MoonIcon />}</span>
              </HeaderIconButton>

              <HeaderIconButton
                title="Keyboard shortcuts"
                onClick={() => {
                  setShowKeyboardHelp(true);
                  setShowNotifications(false);
                  setShowChatRoom(false);
                  setShowProfileMenu(false);
                }}
              >
                <KeyboardIcon />
              </HeaderIconButton>

              <div style={{ position: 'relative' }}>
                <HeaderIconButton
                  badge={unreadNotificationCount}
                  title="System Notifications"
                  onClick={() => {
                    setShowNotifications((prev) => {
                      const next = !prev;
                      if (next) setShowChatRoom(false);
                      return next;
                    });
                    setBellPulsing(false);
                    setLiveToast(null);
                  }}
                >
                  <span className={bellPulsing ? 'bell-icon-pulsing' : undefined} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BellIcon />
                  </span>
                </HeaderIconButton>

                {/* Live real-time toast popup */}
                {liveToast ? (
                  <div
                    className="live-notif-toast"
                    role="alert"
                    style={styles.liveToast}
                  >
                    <span style={styles.liveToastDot} />
                    <span style={styles.liveToastMessage}>{liveToast.message}</span>
                    {liveToast.actionPath ? (
                      <button
                        type="button"
                        style={styles.liveToastAction}
                        onClick={() => {
                          setLiveToast(null);
                          showSpinner();
                          setTimeout(() => { navigate(liveToast.actionPath); hideSpinner(); }, 300);
                        }}
                      >
                        View →
                      </button>
                    ) : null}
                    <button type="button" style={styles.liveToastClose} onClick={() => setLiveToast(null)} aria-label="Dismiss">✕</button>
                  </div>
                ) : null}

                {showNotifications ? (
                  <div className="animated-dropdown notification-dropdown-shell" style={{ ...styles.headerDropdown, width: isMobile ? 'min(92vw, 320px)' : styles.headerDropdown.width }} ref={notificationPanelRef}>
                    <div className="notification-dropdown-topbar" style={styles.notificationDropdownHeader}>
                      <div>
                        <div className="notification-dropdown-title" style={styles.dropdownTitle}>Notifications</div>
                        <div style={styles.notificationHeaderMeta}>
                          <div className="notification-dropdown-summary" style={styles.notificationSummary}>{unreadNotificationCount} unread of {notifications.length}</div>
                          <span className={`notification-live-pill ${notificationStatus.state}`} style={styles.notificationStatusPill}>
                            <span className="notification-live-dot" />
                            {notificationStatus.label}
                          </span>
                        </div>
                      </div>
                      {notifications.length > 0 ? (
                        <button type="button" className="mark-all-read-button" onClick={handleMarkAllNotificationsRead} style={styles.markAllReadButton}>
                          Mark all read
                        </button>
                      ) : null}
                    </div>
                    <div className="notification-scroll-area" style={styles.notificationScrollArea}>
                      {notifications.length > 0 ? notifications.map((item) => (
                        <div
                          key={item.id}
                          className={`notification-item-shell ${item.read ? 'read' : 'unread'}`}
                          style={{
                            ...styles.notificationItem,
                            ...(item.read ? styles.notificationRead : styles.notificationUnread),
                            ...(item.tone === 'warning' ? styles.notificationWarning : item.tone === 'success' ? styles.notificationSuccess : item.tone === 'danger' ? styles.notificationDanger : styles.notificationInfo)
                          }}
                        >
                          <button
                            type="button"
                            className="notification-main-button"
                            onClick={() => handleNotificationClick(item)}
                            style={styles.notificationMainButton}
                          >
                            <span
                              style={{
                                ...styles.notificationIconWrap,
                                ...(item.tone === 'warning' ? styles.notificationIconWarning : item.tone === 'success' ? styles.notificationIconSuccess : item.tone === 'danger' ? styles.notificationIconDanger : styles.notificationIconInfo)
                              }}
                            >
                              {getNotificationIcon(item.type)}
                            </span>
                            <span style={styles.notificationCopy}>
                              <span style={styles.notificationRowTop}>
                                <span className="notification-title-text" style={styles.notificationTitleText}>{item.title}</span>
                                {!item.read ? <span style={styles.notificationUnreadDot} /> : null}
                              </span>
                              <span style={styles.notificationMessage}>{item.message}</span>
                              <span style={styles.notificationRowBottom}>
                                <span style={styles.notificationTime}>{formatNotificationTime(item.createdAt)}</span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={styles.notificationTypePill}>{item.type}</span>
                                  {item.actionPath ? (
                                    <span style={styles.notificationGoHint}>Tap to view →</span>
                                  ) : null}
                                </span>
                              </span>
                            </span>
                          </button>
                          {!item.read ? (
                            <button type="button" onClick={() => markNotificationAsRead(item.id)} style={styles.notificationReadButton} title="Mark as read">
                              <span className="notification-read-button-core">
                              <CheckIcon />
                              </span>
                            </button>
                          ) : null}
                        </div>
                      )) : <div style={styles.emptyDropdown}>No notifications.</div>}
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={{ position: 'relative' }}>
                <HeaderIconButton
                  badge={unreadChatCount}
                  title="Chat Room"
                  onClick={() => {
                    setShowChatRoom((prev) => {
                      const next = !prev;
                      if (next) setShowNotifications(false);
                      if (next) setShowProfileMenu(false);
                      return next;
                    });
                  }}
                >
                  <ChatIcon />
                </HeaderIconButton>

                {showChatRoom ? (
                  <div className="animated-dropdown chat-dropdown-shell" style={{ ...styles.headerDropdown, ...styles.chatDropdown, width: isMobile ? 'min(94vw, 390px)' : 480 }} ref={chatRoomPanelRef}>
                    <div style={styles.chatRoomHeader}>
                      <div>
                        <div style={styles.dropdownTitle}>Chat Room</div>
                        <div style={styles.chatRoomSubtext}>Team updates, quick questions, and live collaboration.</div>
                      </div>
                      <div style={styles.chatLivePill}>
                        <span className="chat-live-dot" />
                        Live
                      </div>
                    </div>

                    <div style={styles.chatToolbar}>
                      <label style={styles.chatField}>
                        <span style={styles.chatFieldLabel}>To</span>
                        <select
                          id="chat-target-select"
                          name="chat_target"
                          value={selectedChatTarget}
                          onChange={(event) => setSelectedChatTarget(event.target.value)}
                          style={styles.chatSelect}
                        >
                          {chatTargets.map((target) => (
                            <option key={target.id} value={target.id}>
                              {target.id === 'ROOM_GLOBAL'
                                ? 'Team Room'
                                : `${target.full_name || target.username || 'User'} (${target.role || 'user'})`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={styles.chatField}>
                        <span style={styles.chatFieldLabel}>Priority</span>
                        <select id="chat-priority-select" name="chat_priority" value={chatPriority} onChange={(event) => setChatPriority(event.target.value)} style={styles.chatSelect}>
                          <option value="normal">Normal</option>
                          <option value="important">Important</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </label>
                    </div>

                    <div style={styles.chatActiveTarget}>
                      <div style={styles.chatTargetAvatar}>{getInitials(activeChatTarget?.full_name || activeChatTarget?.username)}</div>
                      <div style={styles.chatTargetMeta}>
                        <div style={styles.chatTargetName}>{activeChatTarget?.full_name || activeChatTarget?.username || 'Team Room'}</div>
                        <div style={styles.chatTargetSubtext}>
                          {selectedChatTarget === 'ROOM_GLOBAL' ? 'Shared room for everyone' : `Direct message - ${activeChatTarget?.role || 'user'}`}
                        </div>
                      </div>
                    </div>

                    <input
                      id="chat-search-input"
                      name="chat_search"
                      value={chatSearch}
                      onChange={(event) => setChatSearch(event.target.value)}
                      placeholder="Search this chat..."
                      style={styles.chatSearchInput}
                    />

                    <div className="chat-scroll-area" style={styles.chatList} ref={chatListRef}>
                      {filteredChatMessages.length > 0 ? filteredChatMessages.map((message) => {
                        const mine = message.user_id === user?.id;
                        const isUnread = !mine && (!chatLastSeenAt || (message.created_at || '') > chatLastSeenAt);
                        const senderName = mine ? 'You' : (message.sender_name || message.sender_username || 'User');
                        const priority = message.priority || 'normal';

                        return (
                          <div
                            key={message.id}
                            className={`chat-message-shell ${mine ? 'mine' : 'theirs'} ${isUnread ? 'unread' : ''} priority-${priority}`}
                            style={{
                              ...styles.chatMessage,
                              ...(mine ? styles.chatMessageMine : {}),
                              ...(isUnread ? styles.chatMessageUnread : {}),
                              ...(priority === 'important' ? styles.chatMessageImportant : {}),
                              ...(priority === 'urgent' ? styles.chatMessageUrgent : {})
                            }}
                          >
                            <div style={styles.chatMessageTopline}>
                              <span style={styles.chatMessageSender}>{senderName}</span>
                              <span style={styles.chatMessageTime}>{formatChatTime(message.created_at)}</span>
                            </div>
                            <div style={styles.chatMessageText}>{message.message}</div>
                            {priority !== 'normal' ? (
                              <div style={styles.chatPriorityTag}>{priority}</div>
                            ) : null}
                          </div>
                        );
                      }) : <div style={styles.emptyDropdown}>{chatSearch ? 'No matching messages.' : 'No messages yet.'}</div>}
                    </div>

                    <div style={styles.chatQuickRow}>
                      {chatQuickMessages.map((quickMessage) => (
                        <button
                          key={quickMessage}
                          type="button"
                          className="chat-quick-chip"
                          style={styles.chatQuickChip}
                          onClick={() => setChatInput(quickMessage)}
                        >
                          {quickMessage}
                        </button>
                      ))}
                    </div>

                    <div style={styles.chatComposer}>
                      <textarea
                        className="chat-composer-input"
                        value={chatInput}
                        onChange={(event) => setChatInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            handleSendChatMessage();
                          }
                        }}
                        placeholder={selectedChatTarget === 'ROOM_GLOBAL' ? 'Share an update with the team...' : 'Write a direct message...'}
                        style={styles.chatInput}
                      />
                      <button type="button" className="chat-send-button" onClick={handleSendChatMessage} style={styles.sendButton} disabled={chatLoading}>
                        {chatLoading ? '...' : 'Send'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {!isTinyHeader ? <div style={styles.headerSeparator} /> : null}

              <div style={{ position: 'relative' }} ref={profileMenuRef}>
                <button
                  className="account-menu-button"
                  type="button"
                  aria-label="Open user menu"
                  onClick={() => {
                    setShowProfileMenu((prev) => {
                      const next = !prev;
                      if (next) {
                        setShowNotifications(false);
                        setShowChatRoom(false);
                      }
                      return next;
                    });
                  }}
                  style={styles.accountButton}
                >
                  <ProfileAvatarImage
                    src={profileImageUrl}
                    alt={user?.full_name || user?.username || 'User'}
                    imageStyle={styles.accountAvatarImage}
                    fallbackStyle={styles.accountAvatar}
                    fallbackText={profileAvatarText}
                  />
                </button>

                {showProfileMenu ? (
                  <div className="animated-dropdown profile-dropdown-shell" style={{ ...styles.headerDropdown, ...styles.profileDropdown, width: isMobile ? 'min(92vw, 320px)' : 320 }}>
                    <div style={styles.dropdownTitle}>Current User</div>
                    <div style={styles.profileMenuHeader}>
                      <ProfileAvatarImage
                        src={profileImageUrl}
                        alt={user?.full_name || user?.username || 'User'}
                        imageStyle={styles.profileMenuAvatarImage}
                        fallbackStyle={styles.profileMenuAvatar}
                        fallbackText={profileAvatarText}
                      />
                      <div style={styles.profileMenuIdentity}>
                        <div style={styles.profileMenuName}>{user?.full_name || user?.username || 'Administrator'}</div>
                        <div style={styles.profileMenuEmail}>{user?.email || 'administrator@ubumwe.com'}</div>
                      </div>
                    </div>
                    <div style={styles.profileInfoList}>
                      <div style={styles.profileInfoRow}>
                        <span style={styles.profileInfoIcon}><UserIcon /></span>
                        <span style={styles.profileInfoText}><strong>Username:</strong> {user?.username || '-'}</span>
                      </div>
                      <div style={styles.profileInfoRow}>
                        <span style={styles.profileInfoIcon}><MailIcon /></span>
                        <span style={styles.profileInfoText}><strong>Email:</strong> {user?.email || '-'}</span>
                      </div>
                      <div style={styles.profileInfoRow}>
                        <span style={styles.profileInfoIcon}><ShieldIcon /></span>
                        <span style={styles.profileInfoText}><strong>Role:</strong> {user?.role || 'admin'}</span>
                      </div>
                    </div>
                    <div style={styles.profileMenuActions}>
                      <button type="button" style={styles.profileActionButton} onClick={() => handleProfileAction('dashboard')}>
                        <span style={styles.profileActionIcon}><DashboardIcon /></span>
                        <span>Dashboard</span>
                      </button>
                      <button type="button" style={styles.profileActionButton} onClick={() => handleProfileAction('settings')}>
                        <span style={styles.profileActionIcon}><SettingsIcon /></span>
                        <span>Settings</span>
                      </button>
                      <button type="button" style={styles.profileActionButton} onClick={() => handleProfileAction('copy-email')}>
                        <span style={styles.profileActionIcon}><CopyIcon /></span>
                        <span>Copy Email</span>
                      </button>
                      <button type="button" style={{ ...styles.profileActionButton, ...styles.profileActionDanger }} onClick={() => handleProfileAction('logout')}>
                        <span style={styles.profileActionIcon}><LogoutIcon /></span>
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              </div>
            </div>
          </div>
          <div
            id="main-content"
            className="app-content-shell"
            ref={mainContentRef}
            tabIndex={-1}
            style={{ ...styles.content, padding: isMobile ? '16px 14px 24px' : isTablet ? '20px 18px 28px' : styles.content.padding }}
          >
            {children}
          </div>
          <footer className="app-footer-clock" style={{ ...styles.footerBar, padding: isMobile ? '10px 14px' : styles.footerBar.padding }}>
            <div style={styles.footerClock}>
              <ClockIcon />
              <span style={styles.footerTime}>{footerDateTime.time}</span>
              <span style={styles.footerDate}>{footerDateTime.date}</span>
            </div>
            <div style={styles.footerMeta}>Africa/Kigali</div>
          </footer>
        </div>
        <SessionWarning />
        <ApiRecoveryNotice />
        <NetworkStatusBanner />
        {contextMenu.open ? (
          <div
            ref={contextMenuRef}
            className="system-context-menu"
            style={{
              ...styles.contextMenu,
              left: contextMenu.x,
              top: contextMenu.y
            }}
            role="menu"
            aria-label="System context menu"
          >
            <div style={styles.contextMenuHeader}>
              <span style={styles.contextMenuTitle}>Quick Actions</span>
              <span style={styles.contextMenuRoute}>{currentRoute.title}</span>
            </div>
            <div style={styles.contextMenuList}>
              {contextMenuItems.map((item, index) => (
                <React.Fragment key={item.id}>
                  {['dashboard', 'chat', 'theme'].includes(item.id) ? <div style={styles.contextMenuDivider} /> : null}
                  <button
                    type="button"
                    role="menuitem"
                    style={styles.contextMenuItem}
                    onClick={() => runContextAction(item.action)}
                  >
                    <span style={styles.contextMenuItemLabel}>{item.label}</span>
                    <span style={styles.contextMenuHint}>{item.hint}</span>
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : null}
        {showKeyboardHelp ? (
          <div
            style={styles.keyboardOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="keyboard-shortcuts-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setShowKeyboardHelp(false);
            }}
          >
            <div style={styles.keyboardPanel}>
              <div style={styles.keyboardHeader}>
                <div>
                  <div style={styles.keyboardEyebrow}>Whole System</div>
                  <h2 id="keyboard-shortcuts-title" style={styles.keyboardTitle}>Keyboard Navigation</h2>
                </div>
                <button type="button" style={styles.keyboardCloseButton} onClick={() => setShowKeyboardHelp(false)}>Close</button>
              </div>
              <div style={styles.keyboardGrid}>
                {keyboardShortcuts.map((shortcut) => (
                  <div key={`${shortcut.keys.join('-')}-${shortcut.label}`} style={styles.keyboardRow}>
                    <div style={styles.keyGroup}>
                      {shortcut.keys.map((key) => <kbd key={key} style={styles.keyCap}>{key}</kbd>)}
                    </div>
                    <div style={styles.keyLabel}>{shortcut.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ThemeContext.Provider>
  );
};

const styles = {
  container: {
    display: 'flex',
    width: '100%',
    height: '100vh',
    minHeight: '100dvh',
    position: 'relative',
    background: '#f6f8fc',
    overflow: 'hidden'
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 40
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    transition: 'margin-left 0.3s ease',
    minWidth: 0,
    maxWidth: '100%'
  },
  headerBar: {
    minHeight: '72px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '0 26px',
    background: '#ffffff',
    borderBottom: '1px solid #dfe7f3',
    position: 'sticky',
    top: 0,
    zIndex: 35
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    minWidth: 0
  },
  brandPanel: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    minWidth: 0
  },
  brandMark: {
    width: '46px',
    height: '46px',
    borderRadius: '14px',
    background: 'linear-gradient(145deg, #eff4ff 0%, #dfe9ff 100%)',
    border: '1px solid #d7e4fb',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75)'
  },
  brandLogo: {
    width: '26px',
    height: '26px',
    objectFit: 'contain',
    display: 'block'
  },
  brandCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0
  },
  brandTickerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
    marginTop: 0
  },
  brandTickerWrap: {
    width: '238px',
    maxWidth: '46vw',
    minWidth: 0,
    overflow: 'hidden',
    borderRadius: '999px',
    border: '1px solid #dbe7ff',
    background: 'linear-gradient(180deg, #f7faff 0%, #eef4ff 100%)',
    padding: '2px 0'
  },
  brandTickerTrack: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    paddingLeft: '10px',
    willChange: 'transform'
  },
  brandTickerPrimary: {
    height: '16px',
    padding: '0 7px',
    borderRadius: '999px',
    border: '1px solid #8fb4ff',
    background: 'linear-gradient(180deg, #ffffff 0%, #e9f1ff 100%)',
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.09em',
    color: '#1e40af',
    textTransform: 'uppercase'
  },
  brandTickerSecondary: {
    height: '16px',
    padding: '0 7px',
    borderRadius: '999px',
    border: '1px solid #c6d9ff',
    background: 'linear-gradient(180deg, #f8fbff 0%, #edf3ff 100%)',
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    color: '#1d4ed8',
    textTransform: 'uppercase'
  },
  brandTickerDivider: {
    color: '#3b82f6',
    fontSize: '11px',
    fontWeight: 900,
    opacity: 0.95
  },
  headerDigitalClock: {
    height: '28px',
    borderRadius: '12px',
    border: '1px solid #b9d0ff',
    background: 'linear-gradient(180deg, #f8fbff 0%, #e8f0ff 100%)',
    padding: '0 10px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0
  },
  headerDigitalClockIcon: {
    color: '#1d4ed8',
    display: 'inline-flex',
    alignItems: 'center'
  },
  headerDigitalClockText: {
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.03em',
    color: '#172554',
    fontVariantNumeric: 'tabular-nums',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  },
  headerDigitalClockSegment: {
    minWidth: '18px',
    textAlign: 'center',
    lineHeight: 1
  },
  headerDigitalClockColon: {
    opacity: 0.85,
    marginTop: '-1px'
  },
  brandEyebrow: {
    color: '#2563eb',
    fontSize: '11px',
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  mobileMenuButton: {
    width: 40,
    height: 40,
    borderRadius: '10px',
    border: '1px solid #dbe4f1',
    background: '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  headerTitle: {
    color: '#172554',
    fontSize: '17px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  headerSubtitle: {
    color: '#5b6f92',
    fontSize: '12px',
    lineHeight: 1.35,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0
  },
  globalSearchWrap: {
    position: 'relative',
    minWidth: '260px',
    height: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 12px',
    borderRadius: '999px',
    border: '1px solid #dbe4f0',
    background: '#ffffff',
    color: '#64748b',
    boxShadow: '0 12px 24px rgba(37, 71, 127, 0.06)'
  },
  globalSearchInput: {
    width: '100%',
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: '#0f172a',
    fontSize: '0.86rem',
    fontWeight: 700
  },
  globalSearchDropdown: {
    right: 0,
    width: 360,
    padding: '10px',
    borderRadius: '16px'
  },
  globalSearchResult: {
    width: '100%',
    border: '1px solid transparent',
    background: 'transparent',
    color: '#0f172a',
    borderRadius: '12px',
    padding: '0.65rem 0.75rem',
    textAlign: 'left',
    display: 'grid',
    gap: '0.16rem'
  },
  globalSearchResultActive: {
    background: '#eff6ff',
    borderColor: '#bfdbfe',
    boxShadow: '0 10px 20px rgba(37, 99, 235, 0.08)'
  },
  globalSearchType: {
    color: '#2563eb',
    fontSize: '0.68rem',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
  },
  globalSearchTitle: {
    color: '#0f172a',
    fontWeight: 900
  },
  globalSearchSubtitle: {
    color: '#64748b',
    fontSize: '0.78rem',
    lineHeight: 1.35
  },
  keyboardOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    background: 'rgba(15, 23, 42, 0.62)',
    backdropFilter: 'blur(6px)'
  },
  keyboardPanel: {
    width: 'min(720px, 100%)',
    maxHeight: '86vh',
    overflow: 'auto',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    border: '1px solid #dbe4f0',
    borderRadius: '18px',
    boxShadow: '0 30px 70px rgba(15, 23, 42, 0.28)',
    padding: '1.1rem'
  },
  keyboardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    alignItems: 'flex-start',
    marginBottom: '1rem'
  },
  keyboardEyebrow: {
    color: '#2563eb',
    fontSize: '0.72rem',
    fontWeight: 900,
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  keyboardTitle: {
    margin: '0.15rem 0 0',
    color: '#0f172a',
    fontSize: '1.35rem',
    lineHeight: 1.2
  },
  keyboardCloseButton: {
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#334155',
    borderRadius: '999px',
    padding: '0.48rem 0.82rem'
  },
  keyboardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '0.65rem'
  },
  keyboardRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.8rem',
    alignItems: 'center',
    padding: '0.7rem',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    background: '#ffffff'
  },
  keyGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.28rem',
    flexWrap: 'wrap'
  },
  keyCap: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '30px',
    height: '28px',
    padding: '0 0.45rem',
    borderRadius: '7px',
    border: '1px solid #cbd5e1',
    background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
    color: '#0f172a',
    fontSize: '0.76rem',
    fontWeight: 900,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)'
  },
  keyLabel: {
    color: '#334155',
    fontSize: '0.86rem',
    fontWeight: 800,
    textAlign: 'right'
  },
  contextMenu: {
    position: 'fixed',
    zIndex: 120,
    width: '260px',
    maxWidth: 'calc(100vw - 20px)',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    border: '1px solid #dbe4f0',
    borderRadius: '14px',
    boxShadow: '0 24px 54px rgba(15, 23, 42, 0.24), 0 8px 18px rgba(37, 71, 127, 0.1)',
    padding: '0.55rem',
    backdropFilter: 'blur(16px)'
  },
  contextMenuHeader: {
    padding: '0.55rem 0.65rem 0.45rem',
    display: 'grid',
    gap: '0.12rem'
  },
  contextMenuTitle: {
    color: '#0f172a',
    fontSize: '0.86rem',
    fontWeight: 900
  },
  contextMenuRoute: {
    color: '#64748b',
    fontSize: '0.72rem',
    fontWeight: 800
  },
  contextMenuList: {
    display: 'grid',
    gap: '0.12rem'
  },
  contextMenuItem: {
    width: '100%',
    border: '1px solid transparent',
    background: 'transparent',
    borderRadius: '10px',
    padding: '0.56rem 0.62rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    color: '#0f172a',
    textAlign: 'left'
  },
  contextMenuItemLabel: {
    fontSize: '0.84rem',
    fontWeight: 850,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  contextMenuHint: {
    flexShrink: 0,
    color: '#64748b',
    fontSize: '0.68rem',
    fontWeight: 900,
    border: '1px solid #dbe4f0',
    background: '#f8fafc',
    borderRadius: '7px',
    padding: '0.14rem 0.32rem'
  },
  contextMenuDivider: {
    height: '1px',
    background: '#e2e8f0',
    margin: '0.25rem 0.2rem'
  },
  themeIcon: {
    color: 'currentColor',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerSeparator: {
    width: '1px',
    alignSelf: 'stretch',
    background: '#e5eaf3',
    margin: '0 8px'
  },
  accountButton: {
    border: '1px solid #e1e9f5',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    display: 'inline-flex',
    alignItems: 'center',
    color: '#16224a',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '999px',
    boxShadow: '0 14px 28px rgba(37, 71, 127, 0.06)'
  },
  accountAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '999px',
    background: '#5b5ce9',
    color: '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '23px',
    fontWeight: 700,
    flexShrink: 0
  },
  accountAvatarImage: {
    width: '40px',
    height: '40px',
    borderRadius: '999px',
    objectFit: 'cover',
    flexShrink: 0
  },
  accountInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '2px',
    minWidth: 0
  },
  accountName: {
    color: '#172554',
    fontSize: '15px',
    fontWeight: 700,
    lineHeight: 1.2,
    whiteSpace: 'nowrap'
  },
  accountMeta: {
    color: '#526581',
    fontSize: '13px',
    whiteSpace: 'nowrap'
  },
  accountMetaRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0
  },
  roleBadge: {
    minHeight: '22px',
    padding: '0 8px',
    borderRadius: '999px',
    background: '#eff4ff',
    color: '#355fbe',
    fontSize: '11px',
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    textTransform: 'capitalize',
    border: '1px solid #dce7fa',
    flexShrink: 0
  },
  profileDropdown: {
    top: 'calc(100% + 12px)',
    right: 0
  },
  profileMenuHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid #e8eef7'
  },
  profileMenuAvatar: {
    width: '52px',
    height: '52px',
    borderRadius: '999px',
    background: '#5b5ce9',
    color: '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: 700,
    flexShrink: 0
  },
  profileMenuAvatarImage: {
    width: '52px',
    height: '52px',
    borderRadius: '999px',
    objectFit: 'cover',
    flexShrink: 0
  },
  profileMenuIdentity: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0
  },
  profileMenuName: {
    color: '#172554',
    fontSize: '15px',
    fontWeight: 800,
    lineHeight: 1.25
  },
  profileMenuEmail: {
    color: '#526581',
    fontSize: '13px',
    lineHeight: 1.4,
    overflowWrap: 'anywhere'
  },
  profileInfoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingTop: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid #e8eef7'
  },
  profileInfoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#405273',
    fontSize: '13px',
    lineHeight: 1.4
  },
  profileInfoIcon: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    background: '#eff4ff',
    color: '#355fbe',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  profileInfoText: {
    overflowWrap: 'anywhere'
  },
  profileMenuActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingTop: '12px'
  },
  profileActionButton: {
    width: '100%',
    border: '1px solid #e4ebf7',
    background: '#ffffff',
    color: '#172554',
    borderRadius: '12px',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 700,
    textAlign: 'left'
  },
  profileActionIcon: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    background: '#eff4ff',
    color: '#355fbe',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  profileActionDanger: {
    color: '#b91c1c',
    borderColor: '#fecaca',
    background: '#fffaf9'
  },
  headerDropdown: {
    position: 'absolute',
    top: 'calc(100% + 10px)',
    right: 0,
    width: 320,
    maxWidth: '85vw',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,250,255,0.98) 100%)',
    border: '1px solid rgba(210, 223, 243, 0.96)',
    borderRadius: '22px',
    boxShadow: '0 28px 60px rgba(15, 32, 74, 0.18), 0 8px 24px rgba(37, 71, 127, 0.08)',
    padding: '16px',
    backdropFilter: 'blur(18px)',
    zIndex: 80
  },
  dropdownTitle: {
    color: '#172554',
    fontSize: '15px',
    fontWeight: 800,
    marginBottom: '2px'
  },
  notificationDropdownHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '14px'
  },
  notificationSummary: {
    color: '#64748b',
    fontSize: '12px',
    fontWeight: 700
  },
  notificationHeaderMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '3px'
  },
  notificationStatusPill: {
    minHeight: '22px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    borderRadius: '999px',
    padding: '0 8px',
    background: 'rgba(255, 255, 255, 0.14)',
    color: '#dffbff',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    fontSize: '10px',
    fontWeight: 900,
    lineHeight: 1,
    whiteSpace: 'nowrap'
  },
  notificationScrollArea: {
    maxHeight: 'min(62vh, 430px)',
    overflowY: 'auto',
    paddingRight: '4px',
    marginRight: '-4px'
  },
  markAllReadButton: {
    border: '1px solid rgba(191, 219, 254, 0.9)',
    background: 'linear-gradient(180deg, #ffffff 0%, #eff6ff 100%)',
    color: '#1d4ed8',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    padding: '8px 11px',
    whiteSpace: 'nowrap',
    borderRadius: '999px',
    boxShadow: '0 10px 18px rgba(37, 99, 235, 0.08)'
  },
  notificationItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    borderRadius: '18px',
    border: '1px solid transparent',
    padding: '12px',
    marginBottom: '10px',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease'
  },
  notificationMainButton: {
    flex: 1,
    minWidth: 0,
    border: 'none',
    background: 'transparent',
    padding: 0,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    textAlign: 'left',
    cursor: 'pointer'
  },
  notificationCopy: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  notificationRowTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px'
  },
  notificationTitleText: {
    color: '#172554',
    fontSize: '13px',
    fontWeight: 800,
    lineHeight: 1.35
  },
  notificationMessage: {
    color: '#41536f',
    fontSize: '12px',
    lineHeight: 1.58,
    fontWeight: 600
  },
  notificationRowBottom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    flexWrap: 'wrap'
  },
  notificationTime: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 800
  },
  notificationTypePill: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '20px',
    padding: '0 8px',
    borderRadius: '999px',
    background: 'linear-gradient(180deg, #eef4ff 0%, #dfeaff 100%)',
    color: '#355fbe',
    fontSize: '10px',
    fontWeight: 800,
    textTransform: 'capitalize',
    letterSpacing: '0.03em',
    border: '1px solid rgba(191, 219, 254, 0.85)'
  },
  notificationGoHint: {
    fontSize: '10px',
    fontWeight: 800,
    color: '#2563eb',
    letterSpacing: '0.02em'
  },
  liveToast: {
    position: 'absolute',
    top: 'calc(100% + 10px)',
    right: 0,
    minWidth: '240px',
    maxWidth: '320px',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
    color: '#ffffff',
    borderRadius: '18px',
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    boxShadow: '0 24px 48px rgba(15, 23, 42, 0.32)',
    zIndex: 9999,
    animation: 'liveToastIn 0.32s cubic-bezier(.22,.84,.26,1)',
    border: '1px solid rgba(96, 165, 250, 0.3)'
  },
  liveToastDot: {
    width: '9px',
    height: '9px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #60a5fa 0%, #22d3ee 100%)',
    flexShrink: 0,
    boxShadow: '0 0 0 4px rgba(96, 165, 250, 0.25)',
    animation: 'liveToastDotBlink 1s ease-in-out infinite'
  },
  liveToastMessage: {
    flex: 1,
    fontSize: '13px',
    fontWeight: 700,
    color: '#e2e8f0',
    lineHeight: 1.3
  },
  liveToastAction: {
    background: 'linear-gradient(135deg, #2563eb 0%, #0891b2 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '999px',
    padding: '5px 12px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
    flexShrink: 0
  },
  liveToastClose: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '999px',
    color: '#94a3b8',
    width: '22px',
    height: '22px',
    fontSize: '10px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0
  },
  notificationUnreadDot: {
    width: '9px',
    height: '9px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
    flexShrink: 0,
    boxShadow: '0 0 0 5px rgba(96, 165, 250, 0.16)'
  },
  notificationIconWrap: {
    width: '40px',
    height: '40px',
    borderRadius: '14px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75), 0 12px 20px rgba(37, 71, 127, 0.08)'
  },
  notificationIconInfo: {
    background: '#eff6ff',
    color: '#1d4ed8'
  },
  notificationIconWarning: {
    background: '#fff7ed',
    color: '#c2410c'
  },
  notificationIconSuccess: {
    background: '#ecfdf5',
    color: '#047857'
  },
  notificationIconDanger: {
    background: '#fef2f2',
    color: '#dc2626'
  },
  notificationReadButton: {
    width: '32px',
    height: '32px',
    borderRadius: '12px',
    border: '1px solid #dbe4f1',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    color: '#2563eb',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    boxShadow: '0 10px 18px rgba(37, 99, 235, 0.08)'
  },
  notificationUnread: {
    boxShadow: '0 16px 28px rgba(37, 71, 127, 0.08)'
  },
  notificationRead: {
    opacity: 0.86
  },
  emptyDropdown: {
    color: '#64748b',
    fontSize: '13px',
    padding: '18px 8px',
    borderRadius: '16px',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    border: '1px dashed #dbe4f1',
    textAlign: 'center',
    fontWeight: 600
  },
  chatRoomHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '14px'
  },
  chatDropdown: {
    overflow: 'hidden'
  },
  chatRoomSubtext: {
    color: '#64748b',
    fontSize: '12px',
    fontWeight: 600,
    lineHeight: 1.5,
    marginTop: '2px'
  },
  chatLivePill: {
    minHeight: '28px',
    padding: '0 10px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
    color: '#047857',
    border: '1px solid rgba(110, 231, 183, 0.95)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    boxShadow: '0 10px 18px rgba(16, 185, 129, 0.12)'
  },
  chatToolbar: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.5fr) minmax(112px, 0.85fr)',
    gap: '10px',
    marginBottom: '10px'
  },
  chatField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    minWidth: 0
  },
  chatFieldLabel: {
    color: '#526581',
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  chatSelect: {
    width: '100%',
    minHeight: '40px',
    borderRadius: '14px',
    border: '1px solid #d6e0ee',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    color: '#172554',
    fontSize: '12px',
    fontWeight: 800,
    padding: '0 12px',
    outline: 'none',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)'
  },
  chatActiveTarget: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #eef6ff 0%, #f8fbff 100%)',
    border: '1px solid #dbeafe',
    marginBottom: '10px'
  },
  chatTargetAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #2563eb 0%, #0f766e 100%)',
    color: '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 900,
    boxShadow: '0 12px 22px rgba(37, 99, 235, 0.2)',
    flexShrink: 0
  },
  chatTargetMeta: {
    minWidth: 0
  },
  chatTargetName: {
    color: '#172554',
    fontSize: '13px',
    fontWeight: 900,
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  chatTargetSubtext: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 700,
    marginTop: '3px'
  },
  chatSearchInput: {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: '38px',
    borderRadius: '14px',
    border: '1px solid #dbe4f1',
    background: '#ffffff',
    color: '#172554',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 700,
    outline: 'none',
    marginBottom: '10px'
  },
  chatList: {
    maxHeight: '310px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingRight: '4px',
    marginBottom: '12px'
  },
  chatMessage: {
    borderRadius: '18px',
    padding: '12px 14px',
    background: 'linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)',
    border: '1px solid #dfe7f3',
    color: '#1f2937',
    fontSize: '13px',
    lineHeight: 1.55,
    boxShadow: '0 12px 24px rgba(37, 71, 127, 0.06)',
    overflowWrap: 'anywhere'
  },
  chatMessageMine: {
    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    borderColor: '#bfd6ff'
  },
  chatMessageUnread: {
    borderColor: '#9ad8af',
    boxShadow: '0 16px 28px rgba(34, 197, 94, 0.12)'
  },
  chatMessageImportant: {
    borderColor: '#fbbf24',
    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
  },
  chatMessageUrgent: {
    borderColor: '#fb7185',
    background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)'
  },
  chatMessageTopline: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '5px'
  },
  chatMessageSender: {
    color: '#1d4ed8',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase'
  },
  chatMessageTime: {
    color: '#7a8aa5',
    fontSize: '10px',
    fontWeight: 800,
    whiteSpace: 'nowrap'
  },
  chatMessageText: {
    color: 'inherit',
    whiteSpace: 'pre-wrap'
  },
  chatPriorityTag: {
    display: 'inline-flex',
    marginTop: '8px',
    padding: '3px 8px',
    borderRadius: '999px',
    background: 'rgba(15, 23, 42, 0.08)',
    color: '#172554',
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '0.06em',
    textTransform: 'uppercase'
  },
  chatQuickRow: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    padding: '2px 2px 10px'
  },
  chatQuickChip: {
    border: '1px solid #dbeafe',
    borderRadius: '999px',
    background: 'linear-gradient(180deg, #ffffff 0%, #eff6ff 100%)',
    color: '#1d4ed8',
    fontSize: '11px',
    fontWeight: 800,
    padding: '8px 10px',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    boxShadow: '0 10px 16px rgba(37, 99, 235, 0.08)'
  },
  chatComposer: {
    display: 'flex',
    gap: '10px',
    paddingTop: '4px',
    alignItems: 'stretch'
  },
  chatInput: {
    flex: 1,
    minWidth: 0,
    minHeight: '48px',
    maxHeight: '96px',
    resize: 'vertical',
    borderRadius: '14px',
    border: '1px solid #d6e0ee',
    padding: '12px 14px',
    fontSize: '13px',
    lineHeight: 1.35,
    outline: 'none',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)'
  },
  sendButton: {
    border: 'none',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 60%, #1e40af 100%)',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 800,
    padding: '0 16px',
    cursor: 'pointer',
    boxShadow: '0 16px 28px rgba(37, 99, 235, 0.24)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
  },
  topBar: {
    backgroundColor: 'white',
    padding: '1rem',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    gap: '1rem'
  },
  menuBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: '#1f2937',
    padding: '0.5rem'
  },
  topLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flex: 1,
    minWidth: 0
  },
  topIcon: {
    width: '36px',
    height: '36px',
    flexShrink: 0
  },
  title: {
    fontSize: 'clamp(1rem, 3vw, 1.5rem)',
    fontWeight: '600',
    color: '#1f2937',
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexShrink: 0
  },
  chatRoomWrap: {
    position: 'relative'
  },
  chatRoomButton: {
    width: '38px',
    height: '38px',
    borderRadius: '999px',
    border: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  chatUnreadCount: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    minWidth: '18px',
    height: '18px',
    borderRadius: '999px',
    backgroundColor: '#dc2626',
    color: 'white',
    fontSize: '0.68rem',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px'
  },
  notificationWarning: {
    backgroundColor: '#fffaf0',
    borderColor: '#fde68a'
  },
  notificationDanger: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca'
  },
  notificationSuccess: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0'
  },
  notificationInfo: {
    backgroundColor: '#f8fbff',
    borderColor: '#dbe4f1'
  },
  userName: {
    fontSize: '0.875rem',
    color: '#6b7280'
  },
  avatarBtn: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#2563eb',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    fontSize: '1.125rem',
    flexShrink: 0
  },
  avatarImg: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid #e5e7eb'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '24px 28px 32px',
    background: '#f6f8fc',
    minWidth: 0
  },
  footerBar: {
    minHeight: '42px',
    padding: '9px 26px',
    borderTop: '1px solid #dfe7f3',
    background: '#ffffff',
    color: '#526581',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    fontSize: '12px',
    fontWeight: 700
  },
  footerClock: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0
  },
  footerTime: {
    color: '#172554',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 900
  },
  footerDate: {
    color: '#64748b'
  },
  footerMeta: {
    color: '#64748b',
    fontWeight: 800
  }
};

// Add dropdown animation CSS to the document head once
if (typeof window !== 'undefined' && !document.getElementById('dropdown-anim-style')) {
  const style = document.createElement('style');
  style.id = 'dropdown-anim-style';
  style.innerHTML = `
    @keyframes dropdownIn {
      from { opacity: 0; transform: scale(0.96) translateY(-12px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes headerIconPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    @keyframes bellShake {
      0%, 100% { transform: rotate(0deg); }
      15% { transform: rotate(-18deg); }
      30% { transform: rotate(16deg); }
      45% { transform: rotate(-12deg); }
      60% { transform: rotate(10deg); }
      75% { transform: rotate(-6deg); }
      88% { transform: rotate(4deg); }
    }
    @keyframes liveToastIn {
      from { opacity: 0; transform: translateY(-10px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes liveToastDotBlink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    .bell-icon-pulsing {
      animation: bellShake 0.7s ease-in-out;
    }
    .live-notif-toast {
      animation: liveToastIn 0.32s cubic-bezier(.22,.84,.26,1);
    }
    .animated-dropdown {
      animation: dropdownIn 0.34s cubic-bezier(.22,.84,.26,1);
      animation-fill-mode: forwards;
      will-change: transform, opacity;
      transform-origin: top right;
      opacity: 1;
    }
    .header-icon-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 34px rgba(37, 71, 127, 0.14), inset 0 1px 0 rgba(255,255,255,0.95);
      border-color: rgba(147, 197, 253, 0.95);
    }
    .header-icon-button:active {
      transform: translateY(0);
    }
    .header-icon-button-glow {
      position: absolute;
      inset: 1px;
      border-radius: inherit;
      background: radial-gradient(circle at top, rgba(191, 219, 254, 0.6), rgba(191, 219, 254, 0.02) 60%);
      opacity: 0.65;
      pointer-events: none;
    }
    .header-icon-button-core {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      animation: headerIconPulse 3.8s ease-in-out infinite;
    }
    .header-icon-badge {
      z-index: 2;
    }
    .notification-dropdown-shell::before,
    .chat-dropdown-shell::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 24%);
      pointer-events: none;
    }
    .notification-scroll-area {
      scrollbar-width: thin;
      scrollbar-color: #c3d4f3 transparent;
    }
    .notification-scroll-area::-webkit-scrollbar {
      width: 8px;
    }
    .notification-scroll-area::-webkit-scrollbar-track {
      background: transparent;
    }
    .notification-scroll-area::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, #dbeafe 0%, #93c5fd 100%);
      border-radius: 999px;
      border: 2px solid transparent;
      background-clip: padding-box;
    }
    .notification-item-shell:hover {
      transform: translateY(-2px);
      box-shadow: 0 18px 32px rgba(37, 71, 127, 0.1);
    }
    .notification-main-button:hover .notification-title-text {
      color: #1d4ed8;
    }
    .notification-live-pill {
      position: relative;
      z-index: 1;
    }
    .notification-live-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: #22c55e;
      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18);
      flex-shrink: 0;
    }
    .notification-live-pill.reconnecting .notification-live-dot,
    .notification-live-pill.partial .notification-live-dot,
    .notification-live-pill.polling .notification-live-dot {
      background: #f59e0b;
      box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.18);
      animation: notificationLivePulse 1.2s ease-in-out infinite;
    }
    .notification-live-pill.offline .notification-live-dot {
      background: #ef4444;
      box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.18);
    }
    .notification-live-pill.live .notification-live-dot,
    .notification-live-pill.synced .notification-live-dot {
      animation: notificationLivePulse 1.8s ease-in-out infinite;
    }
    @keyframes notificationLivePulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(0.72); opacity: 0.72; }
    }
    .mark-all-read-button:hover {
      box-shadow: 0 14px 24px rgba(37, 99, 235, 0.12);
      border-color: rgba(96, 165, 250, 0.95);
    }
    .notification-item-shell.unread {
      position: relative;
    }
    .notification-item-shell.unread::after {
      content: "";
      position: absolute;
      left: 0;
      top: 12px;
      bottom: 12px;
      width: 4px;
      border-radius: 999px;
      background: linear-gradient(180deg, #60a5fa 0%, #2563eb 100%);
      opacity: 0.9;
    }
    .chat-message-shell {
      position: relative;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      animation: chatBubbleIn 0.28s ease both;
    }
    .chat-message-shell:hover {
      transform: translateY(-1px);
    }
    .chat-message-shell.mine {
      margin-left: 18px;
    }
    .chat-message-shell.theirs {
      margin-right: 18px;
    }
    .chat-message-shell.unread::after {
      content: "";
      position: absolute;
      top: 12px;
      right: 12px;
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: linear-gradient(135deg, #4ade80 0%, #16a34a 100%);
      box-shadow: 0 0 0 5px rgba(74, 222, 128, 0.18);
    }
    .chat-live-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: #10b981;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.48);
      animation: chatLivePulse 1.6s ease-out infinite;
    }
    .chat-scroll-area {
      scrollbar-width: thin;
      scrollbar-color: #b7cdf1 transparent;
    }
    .chat-scroll-area::-webkit-scrollbar,
    .chat-quick-chip::-webkit-scrollbar {
      height: 8px;
      width: 8px;
    }
    .chat-scroll-area::-webkit-scrollbar-track {
      background: transparent;
    }
    .chat-scroll-area::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, #dbeafe 0%, #93c5fd 100%);
      border-radius: 999px;
      border: 2px solid transparent;
      background-clip: padding-box;
    }
    .chat-quick-chip:hover {
      transform: translateY(-1px);
      border-color: #93c5fd;
      box-shadow: 0 14px 22px rgba(37, 99, 235, 0.12);
    }
    .chat-composer-input:focus {
      border-color: #93c5fd;
      box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.16);
    }
    .chat-send-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 20px 30px rgba(37, 99, 235, 0.3);
    }
    .chat-send-button:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    @keyframes chatBubbleIn {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.985);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    @keyframes chatLivePulse {
      0% {
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.48);
      }
      70% {
        box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
      }
    }
  `;
  document.head.appendChild(style);
}

export default Layout;
