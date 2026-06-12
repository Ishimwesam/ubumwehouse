import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, isRecoverableApiError, resolveTenantUploadUrl, tenantPortalService } from '../services/api';
import ReceiptCaptureInput from '../components/ReceiptCaptureInput';
import TenantPortalInstallPrompt from '../components/TenantPortalInstallPrompt';
import TenantPortalNav, { formatTenantText, TenantLanguageSelect, TenantNotificationPermissionButton, useTenantLanguage } from '../components/TenantPortalNav';
import { registerTenantPushSubscription, requestNotificationPermission } from '../utils/tenantNotification';
import '../styles/tenant-portal.css';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;
const currentPeriod = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);
const TENANT_PORTAL_CACHE_KEY = 'tenantPortalData';
const RECONNECTING_PORTAL_MESSAGE = 'Connection is reconnecting. Showing your saved tenant details for now.';

const readCachedPortalData = () => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(TENANT_PORTAL_CACHE_KEY) || localStorage.getItem(TENANT_PORTAL_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (_) {
    return null;
  }
};

const writeCachedPortalData = (data) => {
  if (typeof window === 'undefined') return;
  try {
    const serialized = data ? JSON.stringify(data) : '';
    if (serialized) {
      sessionStorage.setItem(TENANT_PORTAL_CACHE_KEY, serialized);
    } else {
      sessionStorage.removeItem(TENANT_PORTAL_CACHE_KEY);
      localStorage.removeItem(TENANT_PORTAL_CACHE_KEY);
    }
  } catch (_) {}
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

const getTenantName = (tenant) => String(tenant?.full_name || tenant?.tenant_name || '').trim();
const hasTenantDisplayName = (data) => Boolean(getTenantName(data?.tenant));
const isRejectedPayment = (payment) => String(payment?.payment_status || '').toLowerCase() === 'rejected';

const portalBrandText = 'UBUMWE HOUSE LTD TENANT PORTAL';

const PortalGlyph = ({ type }) => {
  const paths = {
    bell: [<path key="a" d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />, <path key="b" d="M10 21a2 2 0 0 0 4 0" />],
    message: [<path key="a" d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-5 4v-4.2A2.5 2.5 0 0 1 5 12.5z" />],
    user: [<path key="a" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0" />],
    wallet: [<path key="a" d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />, <path key="b" d="M15 12h5M4 9h16" />],
    calendar: [<path key="a" d="M7 3v4M17 3v4M4 8h16M5 5h14v16H5z" />],
    home: [<path key="a" d="M3 11 12 3l9 8" />, <path key="b" d="M5 10v11h14V10M9 21v-6h6v6" />],
    card: [<path key="a" d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />, <path key="b" d="M4 10h16" />],
    history: [<path key="a" d="M4 12a8 8 0 1 0 2.34-5.66" />, <path key="b" d="M4 4v5h5M12 8v5l3 2" />],
    wrench: [<path key="a" d="m14.7 6.3 3 3M4 20l4.4-1.1L18.7 8.6a2.1 2.1 0 0 0-3-3L5.4 15.9z" />],
    document: [<path key="a" d="M7 3h7l4 4v14H7z" />, <path key="b" d="M14 3v5h5M9.5 12h5M9.5 16h7" />],
    megaphone: [<path key="a" d="M4 11v2a2 2 0 0 0 2 2h2l7 4V5L8 9H6a2 2 0 0 0-2 2z" />, <path key="b" d="M18 9.5a3.5 3.5 0 0 1 0 5" />],
    lock: [<path key="a" d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" />],
    support: [<path key="a" d="M4 12a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-2" />, <path key="b" d="M4 12v3a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2zM20 12v3a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM12 19h4" />],
    dollar: [<path key="a" d="M12 2v20M16.5 7.5A4.5 4.5 0 0 0 12 5c-2.5 0-4.5 1.3-4.5 3s2 3 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3a5.2 5.2 0 0 1-4.8-2.7" />],
    receipt: [<path key="a" d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1z" />, <path key="b" d="M10 8h4M10 12h4M10 16h3" />],
    folder: [<path key="a" d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />],
    phone: [<path key="a" d="M8 4h3l1.5 4-2 1.2a10 10 0 0 0 4.3 4.3l1.2-2 4 1.5v3a2 2 0 0 1-2 2A14 14 0 0 1 6 6a2 2 0 0 1 2-2z" />],
    question: [<path key="a" d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />, <path key="b" d="M9.5 9a2.6 2.6 0 0 1 5 1c0 2-2.5 2.1-2.5 4M12 18h.01" />],
    settings: [<path key="a" d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5z" />, <path key="b" d="m19 12 2-1-2-3-2 .7a7 7 0 0 0-1.4-.8L15.2 5h-3.4l-.4 2.6a7 7 0 0 0-1.4.8L8 7.7l-2 3 2 1a7 7 0 0 0 0 1.6l-2 1 2 3 2-.7a7 7 0 0 0 1.4.8l.4 2.6h3.4l.4-2.6a7 7 0 0 0 1.4-.8l2 .7 2-3-2-1a7 7 0 0 0 0-1.6z" />],
    shield: [<path key="a" d="M12 3 5 6v5c0 4.4 2.8 8.4 7 10 4.2-1.6 7-5.6 7-10V6z" />, <path key="b" d="m9.5 12 1.6 1.6 3.4-3.6" />],
    logout: [<path key="a" d="M14 8V5a2 2 0 0 0-2-2H6v18h6a2 2 0 0 0 2-2v-3" />, <path key="b" d="M10 12h10M17 9l3 3-3 3" />]
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[type] || paths.home}
    </svg>
  );
};

const getFirstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'Tenant';

const formatShortDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const TenantPortal = () => {
  const navigate = useNavigate();
  const [, text] = useTenantLanguage();
  const [accessForm, setAccessForm] = useState({ identifier: '', accessCode: '' });
  const [mode, setMode] = useState('login');
  const [credentialForm, setCredentialForm] = useState({ username: '', password: '', confirmPassword: '', remember: true });
  const [portalData, setPortalData] = useState(() => readCachedPortalData());
  const [bootLoading, setBootLoading] = useState(() => {
    const cached = readCachedPortalData();
    return Boolean(tenantPortalService.getToken() && (!cached || !hasTenantDisplayName(cached)));
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState('');
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: today(),
    payment_period: currentPeriod(),
    payment_method: 'bank_transfer',
    notes: '',
    receipt: null
  });

  const activeContract = useMemo(() => {
    const contracts = portalData?.contracts || [];
    return contracts.find((contract) => (contract.lifecycle_status || contract.status || 'active') === 'active') || contracts[0] || null;
  }, [portalData]);

  const tenant = portalData?.tenant;
  const payments = portalData?.payments || [];
  const maintenanceRequests = portalData?.maintenance_requests || [];
  const announcements = portalData?.announcements || [];
  const openMaintenanceRequests = maintenanceRequests.filter((request) => !['resolved', 'closed'].includes(String(request.status || '').toLowerCase()));
  const uploadSectionRef = useRef(null);
  const historySectionRef = useRef(null);
  const chatSectionRef = useRef(null);
  const maintenanceSectionRef = useRef(null);
  const announcementsSectionRef = useRef(null);
  const profileSectionRef = useRef(null);
  const portalDataRef = useRef(portalData);

  const statusLabel = (activeContract?.lifecycle_status || activeContract?.status || 'active').replace(/_/g, ' ');
  const latestPayment = payments[0] || null;
  const accountName = 'UBUMWE HOUSE LTD';
  const bankName = tenant?.bank_name || 'UBUMWE HOUSE LTD - Official Collection Account';
  const tenantName = getTenantName(tenant);
  const tenantDisplayName = (tenantName || 'Your Account').toUpperCase();
  const tenantFirstName = getFirstName(tenantName);
  const rentDue = tenant?.rent_due || {};
  const currentBalance = Number(rentDue.remaining_amount ?? tenant?.balance ?? 0);
  const dueDate = rentDue.due_date || '';
  const daysUntilDue = Number(rentDue.days_until_due ?? 0);
  const dueDaysText = Math.max(daysUntilDue, 0);
  const tenantPortalBrandName = 'UBUMWE HOUSE SYSTEM';
  const tenantPortalEmail = 'ubumwehouseltd@gmail.com';
  const propertyName = tenant?.building_name || accountName;
  const currentPeriodLabel = rentDue.period || currentPeriod();
  const recentPayments = payments.slice(0, 3);
  const notificationCount = Math.min(99, announcements.length + openMaintenanceRequests.length + (currentBalance > 0 ? 1 : 0));
  const unreadMessageCount = Math.min(99, messages.filter((message) => message.sender_type === 'admin').length);
  const bannerText = currentBalance <= 0
    ? text.rentPaid
    : daysUntilDue < 0
      ? text.rentOverdueBanner
      : daysUntilDue === 0
        ? text.rentDueTodayBanner
        : formatTenantText(text.rentDueInDays, { days: dueDaysText });

  useEffect(() => {
    writeCachedPortalData(portalData);
    portalDataRef.current = portalData;
  }, [portalData]);

  const scrollTo = (sectionRef) => {
    if (!sectionRef?.current) return;
    sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getReceiptPath = (payment) => resolveTenantUploadUrl(payment?.receipt_path || '') || '';
  const canManagePayment = (payment) => ['pending', 'rejected'].includes(String(payment?.payment_status || '').toLowerCase());

  const applyPortalData = useCallback((data) => {
    setPortalData(data);
    setBootLoading(false);
    setError((currentError) => (currentError === RECONNECTING_PORTAL_MESSAGE ? '' : currentError));
    setPaymentForm((prev) => ({
      ...prev,
      amount: data?.tenant?.balance || data?.tenant?.monthly_rent || prev.amount || ''
    }));
  }, []);

  const resetPaymentForm = () => {
    setEditingPayment(null);
    setPaymentForm({
      amount: tenant?.balance || tenant?.monthly_rent || '',
      payment_date: today(),
      payment_period: currentPeriod(),
      payment_method: 'bank_transfer',
      notes: '',
      receipt: null
    });
  };

  const loadMessages = async () => {
    if (!tenantPortalService.getToken()) return;
    try {
      const response = await tenantPortalService.getMessages();
      setMessages(response.data?.messages || []);
    } catch (_) {}
  };

  useEffect(() => {
    let mounted = true;
    const token = tenantPortalService.getToken();
    if (!token) {
      setBootLoading(false);
      return undefined;
    }

    setLoading(true);
    tenantPortalService.me()
      .then((response) => {
        if (!mounted) return;
        applyPortalData(response.data);
      })
      .catch((err) => {
        if (!mounted) return;
        const cached = readCachedPortalData();
        const currentPortalData = portalDataRef.current;
        if (isRecoverableApiError(err) && (currentPortalData || cached)) {
          setPortalData(currentPortalData || cached);
          setError(RECONNECTING_PORTAL_MESSAGE);
          return;
        }
        tenantPortalService.clearToken();
        setPortalData(null);
        writeCachedPortalData(null);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
          setBootLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [applyPortalData]);

  useEffect(() => {
    if (error !== RECONNECTING_PORTAL_MESSAGE || !tenantPortalService.getToken() || !tenant) return undefined;

    const retryPortalRefresh = () => {
      tenantPortalService.me()
        .then((response) => {
          applyPortalData(response.data);
        })
        .catch(() => {});
    };

    const timer = setInterval(retryPortalRefresh, 10000);
    retryPortalRefresh();

    return () => clearInterval(timer);
  }, [applyPortalData, error, tenant]);

  useEffect(() => {
    if (!tenantPortalService.getToken() || !tenant) return undefined;
    loadMessages();
    const timer = setInterval(loadMessages, 12000);
    return () => clearInterval(timer);
  }, [tenant?.id]);

  useEffect(() => {
    const onPortalEvent = (event) => {
      const payload = event.detail || {};
      if (payload.sender_type) {
        setMessages((prev) => (prev.some((item) => item.id === payload.id) ? prev : [...prev, payload]));
        return;
      }

      if (!['tenant_payment_update', 'tenant_announcement', 'tenant_maintenance_update'].includes(payload.event_type)) return;

      tenantPortalService.me()
        .then((response) => {
          applyPortalData(response.data);
        })
        .catch(() => {});
    };

    window.addEventListener('tp:portal-event', onPortalEvent);

    return () => {
      window.removeEventListener('tp:portal-event', onPortalEvent);
    };
  }, [applyPortalData]);

  const handleAccess = async (event) => {
    event.preventDefault();
    if (!/^\d{4,}$/.test(String(accessForm.accessCode || '').replace(/\D/g, ''))) {
      setError('Access code must contain at least 4 digits.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await tenantPortalService.access(accessForm);
      applyPortalData(response.data);
    } catch (err) {
      setPortalData(null);
      setError(getReadableApiError(err, 'Tenant access failed.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    if (credentialForm.password !== credentialForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(credentialForm.password)) {
      setError('Password must be at least 8 characters and include a letter and a number.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await tenantPortalService.register({
        ...accessForm,
        username: credentialForm.username,
        password: credentialForm.password
      });
      tenantPortalService.setToken(response.data.token, credentialForm.remember);
      applyPortalData(response.data);
      setSuccess('Your tenant portal account has been created and saved.');
    } catch (err) {
      setError(getReadableApiError(err, 'Tenant account registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      requestNotificationPermission();
      registerTenantPushSubscription(tenantPortalService);
      const response = await tenantPortalService.login({
        username: credentialForm.username,
        password: credentialForm.password
      });
      tenantPortalService.setToken(response.data.token, credentialForm.remember);
      applyPortalData(response.data);
      setSuccess('Signed in to tenant portal.');
    } catch (err) {
      setError(getReadableApiError(err, 'Tenant portal login failed.'));
    } finally {
      setLoading(false);
    }
  };

  const refreshPortal = async () => {
    const response = await tenantPortalService.me();
    applyPortalData(response.data);
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!tenantPortalService.getToken()) {
      setError('Login is required before uploading payment proof.');
      return;
    }
    if (!editingPayment && !paymentForm.receipt) {
      setError('Upload a receipt image or PDF before submitting proof.');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');
    try {
      if (editingPayment) {
        await tenantPortalService.updatePaymentProof(editingPayment.id, paymentForm);
        setSuccess('Payment proof updated. It is now pending staff confirmation again.');
      } else {
        await tenantPortalService.uploadPaymentProof(paymentForm);
        setSuccess('Payment proof uploaded. It is now pending staff confirmation.');
      }
      resetPaymentForm();
      setShowUploadForm(false);
      await refreshPortal();
    } catch (err) {
      setError(getReadableApiError(err, editingPayment ? 'Failed to update payment proof.' : 'Failed to upload payment proof.'));
    } finally {
      setUploading(false);
    }
  };

  const handleEditPayment = (payment) => {
    if (!canManagePayment(payment)) return;
    setEditingPayment(payment);
    setShowUploadForm(true);
    setPaymentForm({
      amount: payment.amount || '',
      payment_date: payment.payment_date || today(),
      payment_period: payment.payment_period || currentPeriod(),
      payment_method: payment.payment_method || 'bank_transfer',
      notes: '',
      receipt: null
    });
    setError('');
    setSuccess('');
    setTimeout(() => scrollTo(uploadSectionRef), 0);
  };

  const handleDeletePayment = async (payment) => {
    if (!canManagePayment(payment)) return;
    if (!window.confirm('Delete this payment proof from your tenant portal history?')) return;

    setDeletingPaymentId(payment.id);
    setError('');
    setSuccess('');
    try {
      await tenantPortalService.deletePaymentProof(payment.id);
      if (editingPayment?.id === payment.id) resetPaymentForm();
      setSuccess('Payment proof deleted.');
      await refreshPortal();
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to delete payment proof.'));
    } finally {
      setDeletingPaymentId('');
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!messageDraft.trim()) return;

    setSendingMessage(true);
    setError('');
    try {
      const response = await tenantPortalService.sendMessage(messageDraft.trim());
      setMessages((prev) => [...prev, response.data]);
      setMessageDraft('');
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to send support message.'));
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <main className="tp-page">
      {bootLoading ? (
        <section className="tp-auth-shell">
          <div className="tp-loading-panel" role="status" aria-live="polite">
            <div className="tp-loading-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <strong>{portalBrandText}</strong>
            <p>Opening the tenant portal and loading your account details.</p>
          </div>
        </section>
      ) : !tenant ? (
        <section className="tp-auth-shell">
          <form className="tp-auth-card" onSubmit={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleAccess}>
            <div className="tp-auth-brand">
              <span>{portalBrandText}</span>
            </div>
            <h2>{mode === 'login' ? 'Tenant Login' : mode === 'register' ? 'Create Tenant Account' : 'One-Time Access'}</h2>
            <div className="tp-mode-tabs">
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
              <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Create</button>
              <button type="button" className={mode === 'access' ? 'active' : ''} onClick={() => setMode('access')}>One-time</button>
            </div>

            {error ? <div className="tp-alert error">{error}</div> : null}
            {success ? <div className="tp-alert success">{success}</div> : null}

            {mode !== 'login' ? (
              <>
                <label>
                  Email, phone, or national ID
                  <input
                    value={accessForm.identifier}
                    onChange={(event) => setAccessForm((prev) => ({ ...prev, identifier: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Access code
                  <input
                    value={accessForm.accessCode}
                    onChange={(event) => setAccessForm((prev) => ({ ...prev, accessCode: event.target.value }))}
                    inputMode="numeric"
                    required
                  />
                </label>
              </>
            ) : null}

            {mode !== 'access' ? (
              <>
                <label>
                  Username
                  <input
                    value={credentialForm.username}
                    onChange={(event) => setCredentialForm((prev) => ({ ...prev, username: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={credentialForm.password}
                    onChange={(event) => setCredentialForm((prev) => ({ ...prev, password: event.target.value }))}
                    required
                  />
                </label>
                {mode === 'register' ? (
                  <label>
                    Confirm password
                    <input
                      type="password"
                      value={credentialForm.confirmPassword}
                      onChange={(event) => setCredentialForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                      required
                    />
                  </label>
                ) : null}
                <label className="tp-checkbox">
                  <input
                    type="checkbox"
                    checked={credentialForm.remember}
                    onChange={(event) => setCredentialForm((prev) => ({ ...prev, remember: event.target.checked }))}
                  />
                  Keep me signed in
                </label>
              </>
            ) : null}

            <button className="tp-btn-primary" type="submit" disabled={loading}>
              {loading ? 'Checking...' : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Open Portal'}
            </button>
          </form>
          <TenantPortalInstallPrompt />
        </section>
      ) : (
        <div className="tp-dashboard">
          <aside className="tp-sidebar">
            <div className="tp-brand-block">
              <div className="tp-house-logo" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="tp-brand-title">{tenantPortalBrandName}</div>
              <div className="tp-brand-subtitle">{text.homePriority}</div>
            </div>

            <TenantPortalNav
              current="dashboard"
              onDashboardClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            />

            <div className="tp-help-card">
              <span><PortalGlyph type="support" /></span>
              <strong>{text.needHelp}</strong>
              <p>{text.hereForYou}</p>
              <a href="tel:+250788123456">+250 788 123 456</a>
              <a href={`mailto:${tenantPortalEmail}`}>{tenantPortalEmail}</a>
            </div>

            <div className="tp-sidebar-actions">
              <TenantLanguageSelect />
              <TenantNotificationPermissionButton inline />
              <button
                className="tp-logout"
                type="button"
                onClick={() => {
                  tenantPortalService.clearToken();
                  setPortalData(null);
                  setMessages([]);
                  writeCachedPortalData(null);
                  setBootLoading(false);
                }}
              >
                {text.logout}
              </button>
            </div>
          </aside>

          <section className="tp-main tp-portal-overview">
            <header className="tp-mobile-app-header" aria-label="Tenant portal app header">
              <button type="button" aria-label="Open tenant menu" onClick={() => setMobileMenuOpen((open) => !open)} aria-expanded={mobileMenuOpen}>
                <span />
                <span />
                <span />
              </button>
              <div className="tp-mobile-brand">
                <div className="tp-house-logo" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <strong>{tenantPortalBrandName}</strong>
                <small>{text.homePriority}</small>
              </div>
              <div className="tp-mobile-header-actions">
                <button type="button" aria-label={text.notifications} onClick={() => navigate('/tenant-portal/announcements')}>
                  <PortalGlyph type="bell" />
                  {notificationCount > 0 ? <strong>{notificationCount}</strong> : null}
                </button>
                <button type="button" aria-label={text.messages} onClick={() => navigate('/tenant-portal/messages')}>
                  <PortalGlyph type="message" />
                  {unreadMessageCount > 0 ? <strong>{unreadMessageCount}</strong> : null}
                </button>
              </div>
            </header>

            {mobileMenuOpen ? (
              <div className="tp-mobile-drawer-shell" role="presentation">
                <button className="tp-mobile-drawer-backdrop" type="button" aria-label="Close tenant menu" onClick={() => setMobileMenuOpen(false)} />
                <aside className="tp-mobile-menu-panel" aria-label="Tenant app sidebar">
                  <button className="tp-mobile-menu-close" type="button" aria-label="Close tenant menu" onClick={() => setMobileMenuOpen(false)}>x</button>
                  <div className="tp-mobile-menu-brand">
                    <div className="tp-house-logo" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                    <strong>{tenantPortalBrandName}</strong>
                    <small>{text.homePriority}</small>
                  </div>
                  <div className="tp-mobile-menu-controls">
                    <TenantLanguageSelect />
                    <TenantNotificationPermissionButton inline />
                  </div>
                  <div className="tp-mobile-menu-list">
                    <button className="active" type="button" onClick={() => { setMobileMenuOpen(false); navigate('/tenant-portal'); }}>
                      <span><PortalGlyph type="home" /></span>
                      <b>{text.dashboard}</b>
                    </button>
                    <button type="button" onClick={() => { setMobileMenuOpen(false); navigate('/tenant-portal/upload#receipt'); }}>
                      <span><PortalGlyph type="dollar" /></span>
                      <b>{text.payRent}</b>
                    </button>
                    <button type="button" onClick={() => { setMobileMenuOpen(false); navigate('/tenant-portal/payments#history'); }}>
                      <span><PortalGlyph type="receipt" /></span>
                      <b>{text.paymentHistory}</b>
                    </button>
                    <button type="button" onClick={() => { setMobileMenuOpen(false); navigate('/tenant-portal/payments#receipts'); }}>
                      <span><PortalGlyph type="document" /></span>
                      <b>{text.receipts}</b>
                    </button>
                    <button type="button" onClick={() => { setMobileMenuOpen(false); navigate('/tenant-portal/announcements#notices'); }}>
                      <span><PortalGlyph type="bell" /></span>
                      <b>{text.notifications}</b>
                      {notificationCount > 0 ? <em>{notificationCount}</em> : null}
                    </button>
                    <button type="button" onClick={() => { setMobileMenuOpen(false); navigate('/tenant-portal/messages'); }}>
                      <span><PortalGlyph type="message" /></span>
                      <b>{text.messages}</b>
                      {unreadMessageCount > 0 ? <em>{unreadMessageCount}</em> : null}
                    </button>
                    <button type="button" onClick={() => { setMobileMenuOpen(false); navigate('/tenant-portal/maintenance'); }}>
                      <span><PortalGlyph type="wrench" /></span>
                      <b>{text.maintenanceTitle}</b>
                    </button>
                    <button type="button" onClick={() => { setMobileMenuOpen(false); navigate('/tenant-portal/profile#lease'); }}>
                      <span><PortalGlyph type="document" /></span>
                      <b>{text.lease}</b>
                    </button>
                    <button type="button" onClick={() => { setMobileMenuOpen(false); navigate('/tenant-portal/payments#receipts'); }}>
                      <span><PortalGlyph type="folder" /></span>
                      <b>{text.documents}</b>
                    </button>
                    <button type="button" onClick={() => { setMobileMenuOpen(false); navigate('/tenant-portal/profile'); }}>
                      <span><PortalGlyph type="user" /></span>
                      <b>{text.profile}</b>
                    </button>
                    <hr />
                    <a href={`mailto:${tenantPortalEmail}`}>
                      <span><PortalGlyph type="phone" /></span>
                      <b>{text.contactManagement}</b>
                    </a>
                    <button type="button" onClick={() => { setMobileMenuOpen(false); navigate('/tenant-portal/messages#support'); }}>
                      <span><PortalGlyph type="question" /></span>
                      <b>{text.helpSupport}</b>
                    </button>
                    <button type="button" onClick={() => { setMobileMenuOpen(false); navigate('/tenant-portal/profile#password'); }}>
                      <span><PortalGlyph type="settings" /></span>
                      <b>{text.settings}</b>
                    </button>
                    <button type="button" onClick={() => { setMobileMenuOpen(false); navigate('/tenant-portal/profile#password'); }}>
                      <span><PortalGlyph type="shield" /></span>
                      <b>{text.privacySecurity}</b>
                    </button>
                    <hr />
                    <button
                      className="logout"
                      type="button"
                      onClick={() => {
                        tenantPortalService.clearToken();
                        setPortalData(null);
                        setMessages([]);
                        writeCachedPortalData(null);
                        setMobileMenuOpen(false);
                        setBootLoading(false);
                      }}
                    >
                      <span><PortalGlyph type="logout" /></span>
                      <b>{text.logout}</b>
                    </button>
                  </div>
                  <div className="tp-mobile-menu-secure">
                    <span><PortalGlyph type="shield" /></span>
                    <p>{text.secureProtected}</p>
                  </div>
                </aside>
              </div>
            ) : null}

            <header className="tp-portal-topbar">
              <div>
                <h1>{formatTenantText(text.welcomeBack, { name: tenantFirstName })}</h1>
                <p>{text.tenancySummary}</p>
              </div>
              <div className="tp-portal-top-actions">
                <button type="button" className="tp-top-action" onClick={() => navigate('/tenant-portal/announcements')}>
                  <span className="tp-top-action-icon"><PortalGlyph type="bell" /></span>
                  <span>{text.notifications}</span>
                  {notificationCount > 0 ? <strong>{notificationCount}</strong> : null}
                </button>
                <button type="button" className="tp-top-action" onClick={() => navigate('/tenant-portal/messages')}>
                  <span className="tp-top-action-icon"><PortalGlyph type="message" /></span>
                  <span>{text.messages}</span>
                  {unreadMessageCount > 0 ? <strong>{unreadMessageCount}</strong> : null}
                </button>
                <TenantPortalInstallPrompt compact />
                <div className="tp-user">
                  <span className="tp-user-avatar"><PortalGlyph type="user" /></span>
                  <span>{tenantFirstName}</span>
                </div>
              </div>
            </header>

            {error ? <div className="tp-alert error">{error}</div> : null}
            {success ? <div className="tp-alert success">{success}</div> : null}

            <section className="tp-portal-rent-alert">
              <span className="tp-info-dot">i</span>
              <p><strong>{bannerText}</strong> {currentBalance > 0 ? text.avoidLateFees : ''}</p>
              {currentBalance > 0 ? (
                <button type="button" className="tp-btn-primary" onClick={() => navigate('/tenant-portal/upload#receipt')}>
                  {text.payRentNow}
                </button>
              ) : null}
            </section>

            <section className="tp-portal-summary-grid">
              <article className="tp-portal-summary-card">
                <div className="tp-summary-head">
                  <span>{text.currentBalance}</span>
                  <div className="tp-summary-icon blue"><PortalGlyph type="wallet" /></div>
                </div>
                <strong>{formatCurrency(currentBalance)}</strong>
                <p>{formatTenantText(text.rentDueReminderMessage, { date: formatShortDate(dueDate) })}</p>
                {currentBalance > 0 ? (
                  <button type="button" className="tp-summary-pay-button" onClick={() => navigate('/tenant-portal/upload#receipt')}>
                    {text.payRentNow}
                  </button>
                ) : null}
                <button type="button" onClick={() => navigate('/tenant-portal/payments#history')}>{text.viewDetails}<span>&rsaquo;</span></button>
              </article>
              <article className="tp-portal-summary-card">
                <div className="tp-summary-head">
                  <span>{text.nextPaymentDue}</span>
                  <div className="tp-summary-icon green"><PortalGlyph type="calendar" /></div>
                </div>
                <strong className="green-text">{formatShortDate(dueDate)}</strong>
                <p>{formatTenantText(text.daysRemaining, { days: dueDaysText })}</p>
                <button type="button" onClick={() => navigate('/tenant-portal/upload#receipt')}>{text.makePayment}<span>&rsaquo;</span></button>
              </article>
              <article className="tp-portal-summary-card">
                <div className="tp-summary-head">
                  <span>{text.property}</span>
                  <div className="tp-summary-icon purple"><PortalGlyph type="home" /></div>
                </div>
                <strong>{propertyName}</strong>
                <p>{formatTenantText(text.houseNo, { unit: tenant?.unit_number || 'N/A' })}</p>
                <p>{text.cityCountry}</p>
                <button type="button" onClick={() => navigate('/tenant-portal/profile#lease')}>{text.viewMyLease}<span>&rsaquo;</span></button>
              </article>
            </section>

            <section className="tp-portal-card tp-quick-action-panel">
              <h2>{text.quickActions}</h2>
              <div className="tp-action-grid">
                <button type="button" onClick={() => navigate('/tenant-portal/upload#receipt')}>
                  <span className="blue"><PortalGlyph type="card" /></span>
                  <strong>{text.payRent}</strong>
                  <small>{text.securePayment}</small>
                </button>
                <button type="button" onClick={() => navigate('/tenant-portal/payments#history')}>
                  <span className="green"><PortalGlyph type="history" /></span>
                  <strong>{text.paymentHistory}</strong>
                  <small>{text.viewPayments}</small>
                </button>
                <button type="button" onClick={() => navigate('/tenant-portal/maintenance')}>
                  <span className="amber"><PortalGlyph type="wrench" /></span>
                  <strong>{text.maintenanceRequest}</strong>
                  <small>{text.reportIssue}</small>
                </button>
                <button type="button" onClick={() => navigate('/tenant-portal/payments#receipts')}>
                  <span className="purple"><PortalGlyph type="document" /></span>
                  <strong>{text.documentsReceipts}</strong>
                  <small>{text.viewDownload}</small>
                </button>
                <button type="button" onClick={() => navigate('/tenant-portal/messages#support')}>
                  <span className="blue"><PortalGlyph type="message" /></span>
                  <strong>{text.messages}</strong>
                  <small>{text.sendViewMessages}</small>
                </button>
                <button type="button" onClick={() => navigate('/tenant-portal/profile')}>
                  <span className="blue"><PortalGlyph type="user" /></span>
                  <strong>{text.profile}</strong>
                  <small>{text.profileInfo}</small>
                </button>
              </div>
            </section>

            {showUploadForm ? (
              <section className="tp-portal-card tp-upload-card" ref={uploadSectionRef}>
                <h2>{text.uploadReceipt}</h2>
                <form className="tp-upload-form" onSubmit={handleUpload}>
                  {editingPayment ? (
                    <div className="tp-alert info full">
                      {text.editingReceiptNotice}
                    </div>
                  ) : null}
                  <label>
                    {text.amount}
                    <input type="number" min="1" value={paymentForm.amount} onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                  </label>
                  <label>
                    {text.paymentDate}
                    <input type="date" value={paymentForm.payment_date} onChange={(event) => setPaymentForm((prev) => ({ ...prev, payment_date: event.target.value }))} required />
                  </label>
                  <label>
                    {text.paymentPeriod}
                    <input type="month" value={paymentForm.payment_period} onChange={(event) => setPaymentForm((prev) => ({ ...prev, payment_period: event.target.value }))} required />
                  </label>
                  <label>
                    {text.method}
                    <select value={paymentForm.payment_method} onChange={(event) => setPaymentForm((prev) => ({ ...prev, payment_method: event.target.value }))}>
                      <option value="bank_transfer">{text.bankDeposit}</option>
                      <option value="mobile_money">{text.mobileMoney}</option>
                      <option value="cash">{text.cash}</option>
                      <option value="check">{text.check}</option>
                    </select>
                  </label>
                  <div className="full tp-upload-field">
                    <span>{text.receiptFile}</span>
                    <ReceiptCaptureInput
                      file={paymentForm.receipt}
                      onFileSelected={(file) => setPaymentForm((prev) => ({ ...prev, receipt: file }))}
                    />
                    {editingPayment ? <small>{text.keepCurrentReceipt}</small> : null}
                  </div>
                  <label className="full">
                    {text.notes}
                    <textarea value={paymentForm.notes} onChange={(event) => setPaymentForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} />
                  </label>
                  <button className="tp-btn-primary" type="submit" disabled={uploading}>
                    {uploading ? (editingPayment ? text.updating : text.uploading) : editingPayment ? text.updateProof : text.submitProof}
                  </button>
                  {editingPayment ? (
                    <button className="tp-btn-secondary" type="button" onClick={resetPaymentForm}>
                      {text.cancelEdit}
                    </button>
                  ) : null}
                </form>
              </section>
            ) : null}

            <section className="tp-portal-bottom-grid">
              <article className="tp-portal-card" ref={announcementsSectionRef}>
                <h2><PortalGlyph type="megaphone" /> {text.announcementsTitle}</h2>
                {announcements.length ? (
                  <div className="tp-announcement-feed">
                    {announcements.slice(0, 2).map((announcement) => (
                      <div key={announcement.id} className="tp-feed-item">
                        <span />
                        <div>
                          <strong>{announcement.title}</strong>
                          <p>{announcement.body}</p>
                        </div>
                        <small>{formatShortDate(announcement.published_at || announcement.created_at)}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="tp-empty">{text.noAnnouncements}</p>
                )}
                <button type="button" className="tp-card-link" onClick={() => navigate('/tenant-portal/announcements#notices')}>{text.viewAll}<span>&rsaquo;</span></button>
              </article>
              <article className="tp-portal-card tp-upcoming-card">
                <h2><PortalGlyph type="calendar" /> {text.upcomingPayment}</h2>
                <p>{formatTenantText(text.rentForPeriod, { period: currentPeriodLabel })}</p>
                <strong>{formatCurrency(currentBalance)}</strong>
                <div>
                  <span>{text.dueDate}</span>
                  <b>{formatShortDate(dueDate)}</b>
                </div>
                <button type="button" className="tp-btn-primary" onClick={() => navigate('/tenant-portal/upload#receipt')}>{text.payRentNow}</button>
              </article>
              <article className="tp-portal-card" ref={historySectionRef}>
                <h2><PortalGlyph type="document" /> {text.recentPayments}</h2>
                {recentPayments.length ? (
                  <div className="tp-recent-payment-list">
                    {recentPayments.map((payment) => (
                      <div key={payment.id}>
                        <span>
                          <strong>{formatTenantText(text.rentForPeriod, { period: payment.payment_period || '-' })}</strong>
                          <small>{formatShortDate(payment.payment_date || payment.created_at)}</small>
                        </span>
                        <b>{formatCurrency(payment.amount)}</b>
                        <em>{String(payment.payment_status || 'confirmed').toLowerCase() === 'confirmed' ? text.paid : payment.payment_status}</em>
                      </div>
                    ))}
                  </div>
                ) : <p className="tp-empty">{text.noRecentPayments}</p>}
                <button type="button" className="tp-card-link" onClick={() => navigate('/tenant-portal/payments#history')}>{text.viewAllPayments}<span>&rsaquo;</span></button>
              </article>
            </section>

            <section className="tp-portal-profile-line" ref={profileSectionRef}>
              <span><PortalGlyph type="lock" /></span>
              <p>{text.secureProtected}</p>
              <div>{tenantDisplayName} &middot; {tenant?.email || tenant?.phone || propertyName}</div>
            </section>

            {showChat ? (
              <section className="tp-card tp-chat-card" ref={chatSectionRef}>
                <h2>{text.messagesTitle}</h2>
                <div className="tp-chat-log">
                  {messages.length ? messages.map((message) => (
                    <div key={message.id} className={`tp-chat-bubble ${message.sender_type === 'tenant' ? 'tenant' : 'admin'}`}>
                      <span>{message.sender_type === 'tenant' ? text.you : (message.sender_name || text.admin)}</span>
                      <p>{message.message}</p>
                    </div>
                  )) : <div className="tp-empty">{text.noMessagesYet}</div>}
                </div>
                <form className="tp-chat-compose" onSubmit={handleSendMessage}>
                  <textarea
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    placeholder={text.messagePlaceholder}
                    rows={3}
                  />
                  <button className="tp-btn-primary" type="submit" disabled={sendingMessage}>
                    {sendingMessage ? text.sending : text.sendMessage}
                  </button>
                </form>
              </section>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
};

export default TenantPortal;
