import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, resolveUploadUrl, tenantPortalService } from '../services/api';
import { emitAppToast } from '../context/ToastContext';
import TenantPortalInstallPrompt from '../components/TenantPortalInstallPrompt';
import '../styles/tenant-portal.css';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;
const currentPeriod = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);
const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

const IconGrid = () => <span aria-hidden="true">▦</span>;
const IconWallet = () => <span aria-hidden="true">◫</span>;
const IconCheck = () => <span aria-hidden="true">◉</span>;
const IconFile = () => <span aria-hidden="true">◧</span>;

const TenantPortal = () => {
  const navigate = useNavigate();
  const [accessForm, setAccessForm] = useState({ identifier: '', accessCode: '' });
  const [mode, setMode] = useState('login');
  const [credentialForm, setCredentialForm] = useState({ username: '', password: '', confirmPassword: '', remember: true });
  const [portalData, setPortalData] = useState(null);
  const [bootLoading, setBootLoading] = useState(() => Boolean(tenantPortalService.getToken()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showChat, setShowChat] = useState(false);
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
  const accountNumber = tenant?.account_number || '402*******784';
  const accountName = 'UBUMWE HOUSE LTD';
  const receiptHints = `${latestPayment?.notes || ''} ${latestPayment?.payment_method || ''}`.toLowerCase();
  const bankName = receiptHints.includes('bank') || receiptHints.includes('bk') || latestPayment?.payment_method === 'bank_transfer'
    ? 'BK - Bank Deposit (UBUMWE HOUSE LTD)'
    : (latestPayment?.payment_method === 'mobile_money'
      ? 'Mobile Money Deposit (UBUMWE HOUSE LTD)'
      : (tenant?.bank_name || 'UBUMWE HOUSE LTD Collection Account'));
  const tenantDisplayName = (tenant?.full_name || tenant?.tenant_name || 'Tenant').toUpperCase();

  const scrollTo = (sectionRef) => {
    if (!sectionRef?.current) return;
    sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getReceiptPath = (payment) => resolveUploadUrl(payment?.receipt_path || '') || '';

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
        setPaymentForm((prev) => ({
          ...prev,
          amount: response.data?.tenant?.balance || response.data?.tenant?.monthly_rent || ''
        }));
      })
      .catch(() => {
        tenantPortalService.clearToken();
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
    const streamUrl = tenantPortalService.getStreamUrl();
    if (!streamUrl) return undefined;

    const source = new EventSource(streamUrl);
    const onMessage = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        if (!payload?.id) return;
        setMessages((prev) => (prev.some((item) => item.id === payload.id) ? prev : [...prev, payload]));
        if (payload.sender_type === 'admin') {
          emitAppToast('Live update: new message from admin', 'realtime');
        }
      } catch (_) {}
    };

    source.addEventListener('message', onMessage);
    source.onerror = () => {};

    return () => {
      source.removeEventListener('message', onMessage);
      source.close();
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
      const response = await tenantPortalService.login({
        username: credentialForm.username,
        password: credentialForm.password
      });
      tenantPortalService.setToken(response.data.token, credentialForm.remember);
      setPortalData(response.data);
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
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!tenantPortalService.getToken()) {
      setError('Login is required before uploading payment proof.');
      return;
    }
    if (!paymentForm.receipt) {
      setError('Upload a receipt image or PDF before submitting proof.');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');
    try {
      await tenantPortalService.uploadPaymentProof(paymentForm);
      setSuccess('Payment proof uploaded. It is now pending staff confirmation.');
      setPaymentForm((prev) => ({ ...prev, receipt: null, notes: '' }));
      await refreshPortal();
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to upload payment proof.'));
    } finally {
      setUploading(false);
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
            <strong>Opening tenant portal</strong>
            <p>Checking your saved session and loading your account details.</p>
          </div>
        </section>
      ) : !tenant ? (
        <section className="tp-auth-shell">
          <form className="tp-auth-card" onSubmit={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleAccess}>
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
              <div className="tp-brand-title">UBUMWE HOUSE LTD</div>
              <div className="tp-brand-subtitle">Tenant Portal</div>
            </div>

            <nav className="tp-nav">
              <button type="button" className="active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><IconGrid /> Dashboard</button>
              <button type="button" onClick={() => navigate('/tenant-portal/payments')}>Payments</button>
              <button type="button" onClick={() => navigate('/tenant-portal/upload')}>Upload Receipt</button>
              <button type="button" onClick={() => navigate('/tenant-portal/maintenance')}>Maintenance</button>
              <button type="button" onClick={() => navigate('/tenant-portal/messages')}>Messages</button>
              <button type="button" onClick={() => navigate('/tenant-portal/announcements')}>Announcements</button>
              <button type="button" onClick={() => navigate('/tenant-portal/profile')}>Profile</button>
              <button type="button" onClick={() => navigate('/forgot-password')}>Change Password</button>
            </nav>

            <button
              className="tp-logout"
              type="button"
              onClick={() => {
                tenantPortalService.clearToken();
                setPortalData(null);
                setMessages([]);
              }}
            >
              Logout
            </button>
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
                <div className="tp-stat-icon rent"><IconWallet /></div>
                <div>
                  <span>Monthly Rent</span>
                  <strong>{formatCurrency(tenant.monthly_rent)}</strong>
                </div>
              </article>
              <article className="tp-stat-card">
                <div className="tp-stat-icon paid"><IconCheck /></div>
                <div>
                  <span>Paid Amount</span>
                  <strong className="paid">{formatCurrency(tenant.current_period_paid)}</strong>
                </div>
              </article>
              <article className="tp-stat-card">
                <div className="tp-stat-icon outstanding"><IconFile /></div>
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
                  <div><span>Account Number</span><strong>{accountNumber}</strong></div>
                  <div><span>Bank Name</span><strong>{bankName}</strong></div>
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
                      <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setPaymentForm((prev) => ({ ...prev, receipt: event.target.files?.[0] || null }))} required />
                    </label>
                    <label className="full">
                      Notes
                      <textarea value={paymentForm.notes} onChange={(event) => setPaymentForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} />
                    </label>
                    <button className="tp-btn-primary" type="submit" disabled={uploading}>
                      {uploading ? 'Uploading...' : 'Submit Proof'}
                    </button>
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
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length ? payments.slice(0, 8).map((payment) => (
                        <tr key={payment.id}>
                          <td>{payment.payment_date || '-'}</td>
                          <td>RENT - {payment.payment_period || '-'}</td>
                          <td>{formatCurrency(payment.amount)}</td>
                          <td><span className={`tp-status-pill ${String(payment.payment_status || '').toLowerCase()}`}>{payment.payment_status || 'confirmed'}</span></td>
                          <td>
                            {getReceiptPath(payment) ? (
                              <a href={getReceiptPath(payment)} target="_blank" rel="noreferrer">Download</a>
                            ) : (
                              <span>-</span>
                            )}
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan="5">No payment history yet.</td></tr>
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
