import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, isRecoverableApiError, resolveTenantUploadUrl, tenantPortalService } from '../services/api';
import TenantPortalInstallPrompt from '../components/TenantPortalInstallPrompt';
import TenantPortalNav, { TenantNotificationPermissionButton } from '../components/TenantPortalNav';
import { StatIconCheck, StatIconFile, StatIconWallet } from '../components/TenantPortalStatIcons';
import { registerTenantPushSubscription, requestNotificationPermission } from '../utils/tenantNotification';
import '../styles/tenant-portal.css';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;
const currentPeriod = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);
const TENANT_PORTAL_CACHE_KEY = 'tenantPortalData';

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

const TenantPortal = () => {
  const navigate = useNavigate();
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

  const statusLabel = (activeContract?.lifecycle_status || activeContract?.status || 'active').replace(/_/g, ' ');
  const latestPayment = payments[0] || null;
  const accountName = 'UBUMWE HOUSE LTD';
  const bankName = tenant?.bank_name || 'UBUMWE HOUSE LTD - Official Collection Account';
  const tenantName = getTenantName(tenant);
  const tenantDisplayName = (tenantName || 'Your Account').toUpperCase();

  useEffect(() => {
    writeCachedPortalData(portalData);
  }, [portalData]);

  const scrollTo = (sectionRef) => {
    if (!sectionRef?.current) return;
    sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getReceiptPath = (payment) => resolveTenantUploadUrl(payment?.receipt_path || '') || '';
  const canManagePayment = (payment) => ['pending', 'rejected'].includes(String(payment?.payment_status || '').toLowerCase());

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
        setPortalData(response.data);
        setBootLoading(false);
        setPaymentForm((prev) => ({
          ...prev,
          amount: response.data?.tenant?.balance || response.data?.tenant?.monthly_rent || ''
        }));
      })
      .catch((err) => {
        if (!mounted) return;
        const cached = readCachedPortalData();
        if (isRecoverableApiError(err) && (portalData || cached)) {
          setPortalData(portalData || cached);
          setError('Connection is reconnecting. Showing your saved tenant details for now.');
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
  }, []);

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
          setPortalData(response.data);
          setPaymentForm((prev) => ({
            ...prev,
            amount: response.data?.tenant?.balance || response.data?.tenant?.monthly_rent || prev.amount
          }));
        })
        .catch(() => {});
    };

    window.addEventListener('tp:portal-event', onPortalEvent);

    return () => {
      window.removeEventListener('tp:portal-event', onPortalEvent);
    };
  }, []);

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
      setPortalData(response.data);
      setBootLoading(false);
      setPaymentForm((prev) => ({
        ...prev,
        amount: response.data?.tenant?.balance || response.data?.tenant?.monthly_rent || ''
      }));
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
      setPortalData(response.data);
      setBootLoading(false);
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
      setPortalData(response.data);
      setBootLoading(false);
      setSuccess('Signed in to tenant portal.');
    } catch (err) {
      setError(getReadableApiError(err, 'Tenant portal login failed.'));
    } finally {
      setLoading(false);
    }
  };

  const refreshPortal = async () => {
    const response = await tenantPortalService.me();
    setPortalData(response.data);
    setBootLoading(false);
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
          <TenantNotificationPermissionButton inline />
        </section>
      ) : (
        <div className="tp-dashboard">
          <aside className="tp-sidebar">
            <div className="tp-brand-block">
              <div className="tp-brand-title">UBUMWE HOUSE LTD</div>
              <div className="tp-brand-subtitle">Tenant Portal</div>
            </div>

            <TenantPortalNav
              current="dashboard"
              onDashboardClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            />

            <div className="tp-sidebar-actions">
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
                Logout
              </button>
            </div>
          </aside>

          <section className="tp-main">
            <header className="tp-header">
              <div>
                <h1>Welcome, {tenantDisplayName}</h1>
                <p>
                  Room / Office: {tenant.unit_number || 'N/A'}
                  <span> | </span>
                  Status: <strong>{statusLabel}</strong>
                </p>
              </div>
              <div className="tp-header-actions">
                <TenantPortalInstallPrompt compact />
                <div className="tp-user">{accountName}</div>
              </div>
            </header>

            {error ? <div className="tp-alert error">{error}</div> : null}
            {success ? <div className="tp-alert success">{success}</div> : null}

            <section className="tp-stats-row">
              <article className="tp-stat-card">
                <div className="tp-stat-icon rent"><StatIconWallet /></div>
                <div>
                  <span>Monthly Rent</span>
                  <strong>{formatCurrency(tenant.monthly_rent)}</strong>
                </div>
              </article>
              <article className="tp-stat-card">
                <div className="tp-stat-icon paid"><StatIconCheck /></div>
                <div>
                  <span>Paid Amount</span>
                  <strong className="paid">{formatCurrency(tenant.current_period_paid)}</strong>
                </div>
              </article>
              <article className="tp-stat-card">
                <div className="tp-stat-icon outstanding"><StatIconFile /></div>
                <div>
                  <span>Outstanding Balance</span>
                  <strong className="outstanding">{formatCurrency(tenant.balance)}</strong>
                </div>
              </article>
            </section>

            <section className="tp-main-grid">
              <article className="tp-card tp-payment-info" ref={uploadSectionRef}>
                <h2>Payment Information</h2>
                <div className="tp-payment-list">
                  <div><span>Account Name</span><strong>{accountName}</strong></div>
                  <div><span>Bank Name</span><strong>{bankName}</strong></div>
                  <div><span>Payment Reference</span><strong>{`${tenantName || 'Your Account'} / Unit ${tenant?.unit_number || 'N/A'}`}</strong></div>
                  <div><span>Last Payment Date</span><strong>{latestPayment ? formatDateTime(latestPayment.created_at || latestPayment.payment_date) : '-'}</strong></div>
                </div>
                <div className="tp-payment-actions">
                  <button className="tp-btn-primary" type="button" onClick={() => setShowUploadForm((prev) => !prev)}>Upload Payment Receipt</button>
                  <button className="tp-btn-secondary" type="button" onClick={() => navigate('/tenant-portal/payments')}>View Payment History</button>
                  {latestPayment && getReceiptPath(latestPayment) ? (
                    <a className="tp-btn-secondary" href={getReceiptPath(latestPayment)} target="_blank" rel="noreferrer">Download Receipt</a>
                  ) : (
                    <button className="tp-btn-secondary" type="button" disabled>Download Receipt</button>
                  )}
                </div>

                {showUploadForm ? (
                  <form className="tp-upload-form" onSubmit={handleUpload}>
                    {editingPayment ? (
                      <div className="tp-alert info full">
                        Editing rejected/pending receipt. Saving will resend it for staff confirmation.
                      </div>
                    ) : null}
                    <label>
                      Amount
                      <input type="number" min="1" value={paymentForm.amount} onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                    </label>
                    <label>
                      Payment date
                      <input type="date" value={paymentForm.payment_date} onChange={(event) => setPaymentForm((prev) => ({ ...prev, payment_date: event.target.value }))} required />
                    </label>
                    <label>
                      Payment period
                      <input type="month" value={paymentForm.payment_period} onChange={(event) => setPaymentForm((prev) => ({ ...prev, payment_period: event.target.value }))} required />
                    </label>
                    <label>
                      Method
                      <select value={paymentForm.payment_method} onChange={(event) => setPaymentForm((prev) => ({ ...prev, payment_method: event.target.value }))}>
                        <option value="bank_transfer">Bank transfer</option>
                        <option value="mobile_money">Mobile money</option>
                        <option value="cash">Cash</option>
                        <option value="check">Check</option>
                      </select>
                    </label>
                    <label className="full">
                      Receipt image or PDF
                      <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setPaymentForm((prev) => ({ ...prev, receipt: event.target.files?.[0] || null }))} required={!editingPayment} />
                      {editingPayment ? <small>Leave empty to keep the current receipt file.</small> : null}
                    </label>
                    <label className="full">
                      Notes
                      <textarea value={paymentForm.notes} onChange={(event) => setPaymentForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} />
                    </label>
                    <button className="tp-btn-primary" type="submit" disabled={uploading}>
                      {uploading ? (editingPayment ? 'Updating...' : 'Uploading...') : editingPayment ? 'Update Proof' : 'Submit Proof'}
                    </button>
                    {editingPayment ? (
                      <button className="tp-btn-secondary" type="button" onClick={resetPaymentForm}>
                        Cancel Edit
                      </button>
                    ) : null}
                  </form>
                ) : null}
              </article>

              <article className="tp-card tp-quick-actions">
                <h2>Quick Actions</h2>
                <button type="button" onClick={() => navigate('/tenant-portal/maintenance')}>Request Maintenance</button>
                <button type="button" onClick={() => navigate('/tenant-portal/messages')}>Send Message to Admin</button>
                <button type="button" onClick={() => navigate('/tenant-portal/announcements')}>View Announcements</button>
              </article>
            </section>

            <section className="tp-main-grid second-row">
              <article className="tp-card" ref={historySectionRef}>
                <h2>Recent Payment History</h2>
                <div className="tp-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Receipt</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length ? payments.slice(0, 8).map((payment) => (
                        <tr key={payment.id}>
                          <td>{payment.payment_date || '-'}</td>
                          <td>RENT - {payment.payment_period || '-'}</td>
                          <td>{formatCurrency(payment.amount)}</td>
                          <td>
                            <span className={`tp-status-pill ${String(payment.payment_status || '').toLowerCase()}`}>{payment.payment_status || 'confirmed'}</span>
                            {isRejectedPayment(payment) ? (
                              <div className="tp-rejection-note">
                                <strong>Reason:</strong> {payment.rejection_reason || 'No reason was recorded. Please contact admin.'}
                                {payment.rejected_at ? <small>Rejected {formatDateTime(payment.rejected_at)}</small> : null}
                              </div>
                            ) : null}
                          </td>
                          <td>
                            {getReceiptPath(payment) ? (
                              <a href={getReceiptPath(payment)} target="_blank" rel="noreferrer">Download</a>
                            ) : (
                              <span>-</span>
                            )}
                          </td>
                          <td>
                            {canManagePayment(payment) ? (
                              <div className="tp-row-actions">
                                <button type="button" className="tp-btn-secondary" onClick={() => handleEditPayment(payment)}>
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="tp-btn-danger"
                                  onClick={() => handleDeletePayment(payment)}
                                  disabled={deletingPaymentId === payment.id}
                                >
                                  {deletingPaymentId === payment.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            ) : (
                              <span className="tp-locked-note">Locked</span>
                            )}
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan="6">No payment history yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="tp-card tp-maintenance-card" ref={maintenanceSectionRef}>
                <h2>Maintenance Requests</h2>
                <div className="tp-maintenance-state">
                  <strong>{openMaintenanceRequests.length ? `${openMaintenanceRequests.length} open request${openMaintenanceRequests.length === 1 ? '' : 's'}` : 'No open requests'}</strong>
                  <p>
                    {openMaintenanceRequests[0]
                      ? `${openMaintenanceRequests[0].title} is ${String(openMaintenanceRequests[0].status || 'open').replace(/_/g, ' ')}.`
                      : 'You have no maintenance requests at the moment.'}
                  </p>
                  <button type="button" className="tp-btn-primary" onClick={() => navigate('/tenant-portal/maintenance')}>Request Maintenance</button>
                </div>
              </article>
            </section>

            <section className="tp-main-grid second-row">
              <article className="tp-card" ref={announcementsSectionRef}>
                <h2>Announcements</h2>
                {announcements.length ? (
                  <div className="tp-announcement-list compact">
                    {announcements.slice(0, 3).map((announcement) => (
                      <article key={announcement.id} className="tp-announcement-item">
                        <strong>{announcement.title}</strong>
                        <p>{announcement.body}</p>
                        <small>{announcement.published_at ? formatDateTime(announcement.published_at) : formatDateTime(announcement.created_at)}</small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="tp-empty">No new announcements at the moment. Updates from UBUMWE HOUSE LTD will appear here.</p>
                )}
              </article>
              <article className="tp-card" ref={profileSectionRef}>
                <h2>Profile</h2>
                <div className="tp-payment-list">
                  <div><span>Tenant Name</span><strong>{tenantDisplayName}</strong></div>
                  <div><span>Company</span><strong>{accountName}</strong></div>
                  <div><span>Email</span><strong>{tenant?.email || '-'}</strong></div>
                  <div><span>Phone</span><strong>{tenant?.phone || '-'}</strong></div>
                </div>
              </article>
            </section>

            {showChat ? (
              <section className="tp-card tp-chat-card" ref={chatSectionRef}>
                <h2>Messages</h2>
                <div className="tp-chat-log">
                  {messages.length ? messages.map((message) => (
                    <div key={message.id} className={`tp-chat-bubble ${message.sender_type === 'tenant' ? 'tenant' : 'admin'}`}>
                      <span>{message.sender_type === 'tenant' ? 'You' : (message.sender_name || 'Admin')}</span>
                      <p>{message.message}</p>
                    </div>
                  )) : <div className="tp-empty">No messages yet. Start a conversation.</div>}
                </div>
                <form className="tp-chat-compose" onSubmit={handleSendMessage}>
                  <textarea
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    placeholder="Type your message to admin support..."
                    rows={3}
                  />
                  <button className="tp-btn-primary" type="submit" disabled={sendingMessage}>
                    {sendingMessage ? 'Sending...' : 'Send Message'}
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
