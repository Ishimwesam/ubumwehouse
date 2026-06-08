import React, { useEffect, useMemo, useState } from 'react';
import { getReadableApiError, tenantPortalService } from '../services/api';
import '../styles/tenant-portal.css';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;
const currentPeriod = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

const BuildingIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 21h16" />
    <path d="M6 21V7h8v14" />
    <path d="M14 21V3h4v18" />
    <path d="M8 10h.01M8 13h.01M11 10h.01M11 13h.01M16 7h.01M16 11h.01M16 15h.01" />
  </svg>
);

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.78-.88L3 21l1.97-5.27A8.5 8.5 0 1 1 21 11.5Z" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
  </svg>
);

const TenantPortal = () => {
  const [accessForm, setAccessForm] = useState({ identifier: '', accessCode: '' });
  const [mode, setMode] = useState('login');
  const [credentialForm, setCredentialForm] = useState({ username: '', password: '', confirmPassword: '', remember: true });
  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
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
    if (!token) return undefined;

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
        if (mounted) setLoading(false);
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
    <main className="tenant-portal-page">
      <section className="tenant-portal-hero">
        <div className="tenant-portal-brand">
          <span className="tenant-portal-brand-icon"><BuildingIcon /></span>
          UBUMWE SYSTEM COMPANY
        </div>
        <h1>Tenant Self-Service Portal</h1>
        <p>Manage your payments, check contract status, and chat directly with the admin support team.</p>
      </section>

      <section className="tenant-portal-shell">
        {!tenant ? (
          <form className="tenant-portal-auth-card" onSubmit={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleAccess}>
            <h2>{mode === 'login' ? 'Tenant Login' : mode === 'register' ? 'Create Tenant Account' : 'One-Time Access'}</h2>
            <div className="tenant-portal-mode-tabs">
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
              <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Create</button>
              <button type="button" className={mode === 'access' ? 'active' : ''} onClick={() => setMode('access')}>One-time</button>
            </div>
            <p className="tenant-portal-hint">
              {mode === 'register'
                ? 'Verify your tenant record first, then set your own login credentials.'
                : mode === 'login'
                  ? 'Use your saved tenant portal username and password.'
                  : 'Use your registered email, phone, or national ID with the last 4 digits access code.'}
            </p>

            {error ? <div className="tenant-portal-alert error">{error}</div> : null}
            {success ? <div className="tenant-portal-alert success">{success}</div> : null}

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
                <label className="tenant-portal-checkbox">
                  <input
                    type="checkbox"
                    checked={credentialForm.remember}
                    onChange={(event) => setCredentialForm((prev) => ({ ...prev, remember: event.target.checked }))}
                  />
                  Keep me signed in
                </label>
              </>
            ) : null}

            <button className="tenant-portal-primary" type="submit" disabled={loading}>
              {loading ? 'Checking...' : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Open Portal'}
            </button>
          </form>
        ) : (
          <div className="tenant-portal-grid">
            <section className="tenant-portal-summary">
              <div>
                <div className="tenant-portal-kicker">Tenant</div>
                <h2>{tenant.full_name}</h2>
                <p>{tenant.building_name || 'Building'} / Unit {tenant.unit_number || '-'}</p>
              </div>
              <button
                className="tenant-portal-secondary"
                type="button"
                onClick={() => {
                  tenantPortalService.clearToken();
                  setPortalData(null);
                  setMessages([]);
                }}
              >
                Sign out
              </button>
            </section>

            {error ? <div className="tenant-portal-alert error">{error}</div> : null}
            {success ? <div className="tenant-portal-alert success">{success}</div> : null}

            <section className="tenant-portal-stats">
              <article><span>Monthly Rent</span><strong>{formatCurrency(tenant.monthly_rent)}</strong></article>
              <article><span>Paid This Month</span><strong>{formatCurrency(tenant.current_period_paid)}</strong></article>
              <article><span>Pending</span><strong>{formatCurrency(tenant.pending_amount)}</strong></article>
              <article><span>Balance</span><strong>{formatCurrency(tenant.balance)}</strong></article>
            </section>

            <section className="tenant-portal-card">
              <h3><ShieldIcon /> Upload payment proof</h3>
              <form className="tenant-portal-form-grid" onSubmit={handleUpload}>
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
                  <textarea value={paymentForm.notes} onChange={(event) => setPaymentForm((prev) => ({ ...prev, notes: event.target.value }))} rows={4} />
                </label>
                <button className="tenant-portal-primary" type="submit" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Submit Proof'}
                </button>
              </form>
            </section>

            <section className="tenant-portal-card">
              <h3>Contract status</h3>
              {activeContract ? (
                <div className="tenant-portal-contract-box">
                  <strong>{activeContract.lifecycle_status || activeContract.status || 'active'}</strong>
                  <span>{activeContract.contract_start || '-'} to {activeContract.contract_end || '-'}</span>
                  <span>{activeContract.building_name || tenant.building_name || '-'} / Unit {activeContract.unit_number || tenant.unit_number || '-'}</span>
                </div>
              ) : (
                <p className="tenant-portal-empty">No contract record is currently visible.</p>
              )}
            </section>

            <section className="tenant-portal-card">
              <h3>Payment history</h3>
              <div className="tenant-portal-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Period</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length ? payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.payment_date}</td>
                        <td>{payment.payment_period}</td>
                        <td>{formatCurrency(payment.amount)}</td>
                        <td>{payment.payment_status}</td>
                        <td>{payment.payment_method || '-'}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan="5">No payment history yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="tenant-portal-card tenant-portal-chat-card">
              <h3><ChatIcon /> Support chat</h3>
              <p className="tenant-portal-chat-note">Chat with admin support for payment follow-up and account help.</p>
              <div className="tenant-portal-chat-log">
                {messages.length ? messages.map((message) => (
                  <div key={message.id} className={`tenant-portal-chat-bubble ${message.sender_type === 'tenant' ? 'tenant' : 'admin'}`}>
                    <span className="author">{message.sender_type === 'tenant' ? 'You' : (message.sender_name || 'Admin')}</span>
                    <p>{message.message}</p>
                  </div>
                )) : <div className="tenant-portal-empty">No messages yet. Start a conversation.</div>}
              </div>
              <form className="tenant-portal-chat-compose" onSubmit={handleSendMessage}>
                <textarea
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  placeholder="Type your message to admin support..."
                  rows={3}
                />
                <button className="tenant-portal-primary" type="submit" disabled={sendingMessage}>
                  {sendingMessage ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </section>
          </div>
        )}
      </section>
    </main>
  );
};

export default TenantPortal;
