import React, { useMemo, useState } from 'react';
import { getReadableApiError, tenantPortalService } from '../services/api';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;
const currentPeriod = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

const TenantPortal = () => {
  const [accessForm, setAccessForm] = useState({ identifier: '', accessCode: '' });
  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
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

  const handleAccess = async (event) => {
    event.preventDefault();
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

  const refreshPortal = async () => {
    const response = await tenantPortalService.access(accessForm);
    setPortalData(response.data);
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!paymentForm.receipt) {
      setError('Upload a receipt image or PDF before submitting proof.');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');
    try {
      await tenantPortalService.uploadPaymentProof({
        ...accessForm,
        ...paymentForm
      });
      setSuccess('Payment proof uploaded. It is now pending staff confirmation.');
      setPaymentForm((prev) => ({ ...prev, receipt: null, notes: '' }));
      await refreshPortal();
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to upload payment proof.'));
    } finally {
      setUploading(false);
    }
  };

  const tenant = portalData?.tenant;
  const payments = portalData?.payments || [];

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.brand}>UBUMWE SYSTEM COMPANY</div>
        <h1 style={styles.title}>Tenant Self-Service Portal</h1>
        <p style={styles.subtitle}>View your balance, payment history, contract status, and upload proof of payment for confirmation.</p>
      </section>

      <section style={styles.shell}>
        {!tenant ? (
          <form style={styles.accessCard} onSubmit={handleAccess}>
            <h2 style={styles.sectionTitle}>Access your account</h2>
            <p style={styles.muted}>Use your registered email, phone, or national ID. Access code is the last 4 digits of your phone or national ID.</p>
            {error ? <div style={styles.error}>{error}</div> : null}
            <label style={styles.label}>
              Email, phone, or national ID
              <input
                value={accessForm.identifier}
                onChange={(event) => setAccessForm((prev) => ({ ...prev, identifier: event.target.value }))}
                style={styles.input}
                required
              />
            </label>
            <label style={styles.label}>
              Access code
              <input
                value={accessForm.accessCode}
                onChange={(event) => setAccessForm((prev) => ({ ...prev, accessCode: event.target.value }))}
                style={styles.input}
                inputMode="numeric"
                required
              />
            </label>
            <button type="submit" style={styles.primaryButton} disabled={loading}>
              {loading ? 'Checking...' : 'Open Portal'}
            </button>
          </form>
        ) : (
          <div style={styles.portalGrid}>
            <section style={styles.summaryPanel}>
              <div>
                <div style={styles.kicker}>Tenant</div>
                <h2 style={styles.tenantName}>{tenant.full_name}</h2>
                <p style={styles.muted}>{tenant.building_name || 'Building'} · Unit {tenant.unit_number || '-'}</p>
              </div>
              <button type="button" style={styles.secondaryButton} onClick={() => setPortalData(null)}>Switch tenant</button>
            </section>

            {error ? <div style={styles.errorWide}>{error}</div> : null}
            {success ? <div style={styles.successWide}>{success}</div> : null}

            <section style={styles.statsGrid}>
              <article style={styles.statCard}><span>Monthly Rent</span><strong>{formatCurrency(tenant.monthly_rent)}</strong></article>
              <article style={styles.statCard}><span>Paid This Month</span><strong>{formatCurrency(tenant.current_period_paid)}</strong></article>
              <article style={styles.statCard}><span>Pending</span><strong>{formatCurrency(tenant.pending_amount)}</strong></article>
              <article style={styles.statCard}><span>Balance</span><strong>{formatCurrency(tenant.balance)}</strong></article>
            </section>

            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Upload payment proof</h2>
              <form style={styles.formGrid} onSubmit={handleUpload}>
                <label style={styles.label}>
                  Amount
                  <input type="number" min="1" value={paymentForm.amount} onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))} style={styles.input} required />
                </label>
                <label style={styles.label}>
                  Payment date
                  <input type="date" value={paymentForm.payment_date} onChange={(event) => setPaymentForm((prev) => ({ ...prev, payment_date: event.target.value }))} style={styles.input} required />
                </label>
                <label style={styles.label}>
                  Payment period
                  <input type="month" value={paymentForm.payment_period} onChange={(event) => setPaymentForm((prev) => ({ ...prev, payment_period: event.target.value }))} style={styles.input} required />
                </label>
                <label style={styles.label}>
                  Method
                  <select value={paymentForm.payment_method} onChange={(event) => setPaymentForm((prev) => ({ ...prev, payment_method: event.target.value }))} style={styles.input}>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="mobile_money">Mobile money</option>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                  </select>
                </label>
                <label style={{ ...styles.label, gridColumn: '1 / -1' }}>
                  Receipt image or PDF
                  <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setPaymentForm((prev) => ({ ...prev, receipt: event.target.files?.[0] || null }))} style={styles.input} required />
                </label>
                <label style={{ ...styles.label, gridColumn: '1 / -1' }}>
                  Notes
                  <textarea value={paymentForm.notes} onChange={(event) => setPaymentForm((prev) => ({ ...prev, notes: event.target.value }))} style={{ ...styles.input, minHeight: 86 }} />
                </label>
                <button type="submit" style={styles.primaryButton} disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Submit Proof'}
                </button>
              </form>
            </section>

            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Contract status</h2>
              {activeContract ? (
                <div style={styles.contractBox}>
                  <strong>{activeContract.lifecycle_status || activeContract.status || 'active'}</strong>
                  <span>{activeContract.contract_start || '-'} to {activeContract.contract_end || '-'}</span>
                  <span>{activeContract.building_name || tenant.building_name || '-'} · Unit {activeContract.unit_number || tenant.unit_number || '-'}</span>
                </div>
              ) : (
                <p style={styles.muted}>No contract record is currently visible.</p>
              )}
            </section>

            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Payment history</h2>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
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
          </div>
        )}
      </section>
    </main>
  );
};

const styles = {
  page: { minHeight: '100vh', background: '#f6f8fc', padding: '20px' },
  hero: { maxWidth: 1100, margin: '0 auto 18px', padding: '26px 0' },
  brand: { color: '#2563eb', fontSize: 12, fontWeight: 900, letterSpacing: '0.08em' },
  title: { margin: '8px 0', color: '#0f172a', fontSize: 'clamp(1.8rem, 5vw, 3rem)', lineHeight: 1.08 },
  subtitle: { margin: 0, color: '#475569', maxWidth: 720, lineHeight: 1.55 },
  shell: { maxWidth: 1100, margin: '0 auto' },
  accessCard: { width: 'min(480px, 100%)', background: '#fff', border: '1px solid #dbe4f0', borderRadius: 14, padding: 22, boxShadow: '0 18px 42px rgba(15,23,42,.08)' },
  portalGrid: { display: 'grid', gap: 16 },
  summaryPanel: { display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', background: '#fff', border: '1px solid #dbe4f0', borderRadius: 14, padding: 18 },
  kicker: { color: '#2563eb', fontSize: 12, fontWeight: 900, textTransform: 'uppercase' },
  tenantName: { margin: '5px 0', color: '#172554', fontSize: 24 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  statCard: { background: '#fff', border: '1px solid #dbe4f0', borderRadius: 13, padding: 16, display: 'grid', gap: 8 },
  card: { background: '#fff', border: '1px solid #dbe4f0', borderRadius: 14, padding: 18, boxShadow: '0 14px 32px rgba(15,23,42,.06)' },
  sectionTitle: { margin: '0 0 10px', color: '#172554', fontSize: 19 },
  muted: { margin: '0 0 14px', color: '#64748b', lineHeight: 1.5 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 },
  label: { display: 'grid', gap: 6, color: '#334155', fontSize: 13, fontWeight: 800 },
  input: { width: '100%', minHeight: 42, border: '1px solid #cbd5e1', borderRadius: 9, padding: '0 12px', background: '#fff', color: '#0f172a' },
  primaryButton: { minHeight: 42, border: 'none', borderRadius: 9, background: '#2563eb', color: '#fff', padding: '0 16px', fontWeight: 900, cursor: 'pointer' },
  secondaryButton: { minHeight: 40, border: '1px solid #cbd5e1', borderRadius: 9, background: '#fff', color: '#1e293b', padding: '0 14px', fontWeight: 800, cursor: 'pointer' },
  error: { marginBottom: 12, padding: 12, borderRadius: 10, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' },
  errorWide: { padding: 12, borderRadius: 10, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' },
  successWide: { padding: 12, borderRadius: 10, background: '#ecfdf5', color: '#166534', border: '1px solid #bbf7d0' },
  contractBox: { display: 'grid', gap: 8, color: '#334155' },
  tableWrap: { overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 },
  table: { width: '100%', minWidth: 620, borderCollapse: 'collapse' }
};

export default TenantPortal;
