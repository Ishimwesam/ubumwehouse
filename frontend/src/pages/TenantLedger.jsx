import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { paymentService, resolveUploadUrl, tenantService } from '../services/api';
import { useToast } from '../context/ToastContext';
import PageLoader from '../components/PageLoader';

const formatCurrency = (value) => `${parseFloat(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;
const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};
const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};
const getCurrentPeriod = () => new Date().toISOString().slice(0, 7);

const actionOptions = [
  { value: 'call', label: 'Call' },
  { value: 'send_reminder', label: 'Send Reminder' },
  { value: 'followed_up', label: 'Mark Followed Up' },
  { value: 'promise_to_pay', label: 'Promise To Pay' },
  { value: 'note', label: 'Add Note' }
];

const TenantLedger = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rejectingId, setRejectingId] = useState('');
  const [formData, setFormData] = useState({
    action_type: 'call',
    payment_period: getCurrentPeriod(),
    promise_date: '',
    note: ''
  });

  const loadLedger = async () => {
    try {
      setLoading(true);
      const response = await tenantService.getLedger(id);
      setLedger(response.data || null);
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to load tenant ledger', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [id]);

  const latestPeriod = useMemo(() => ledger?.periods?.[0] || null, [ledger]);

  const handleFollowUpSubmit = async (event) => {
    event.preventDefault();
    if (!formData.note.trim()) {
      showToast('Add a note before saving a follow-up.', 'warning');
      return;
    }

    try {
      setSaving(true);
      await tenantService.createFollowUp(id, {
        ...formData,
        unit_id: ledger?.tenant?.unit_id || '',
        status: formData.action_type === 'followed_up' ? 'done' : 'open'
      });
      setFormData((prev) => ({ ...prev, note: '', promise_date: '' }));
      showToast('Follow-up saved', 'success');
      loadLedger();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to save follow-up', 'error');
    } finally {
      setSaving(false);
    }
  };

  const markFollowUpDone = async (followUp) => {
    try {
      await tenantService.updateFollowUp(followUp.id, {
        note: followUp.note,
        promise_date: followUp.promise_date,
        status: 'done'
      });
      showToast('Follow-up closed', 'success');
      loadLedger();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to update follow-up', 'error');
    }
  };

  const confirmPayment = async (paymentId) => {
    try {
      await paymentService.confirmPayment(paymentId);
      showToast('Payment confirmed', 'success');
      loadLedger();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to confirm payment', 'error');
    }
  };

  const rejectPayment = async (paymentId) => {
    const reason = window.prompt('Why is this payment rejected?');
    if (!reason) return;

    try {
      setRejectingId(paymentId);
      await paymentService.rejectPayment(paymentId, reason);
      showToast('Payment rejected', 'success');
      loadLedger();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to reject payment', 'error');
    } finally {
      setRejectingId('');
    }
  };

  if (loading) {
    return <PageLoader text="Loading tenant ledger..." />;
  }

  if (!ledger?.tenant) {
    return (
      <div style={styles.empty}>
        <h2>Tenant ledger not found</h2>
        <button type="button" style={styles.primaryButton} onClick={() => navigate('/tenants')}>Back to Tenants</button>
      </div>
    );
  }

  const { tenant, payments = [], followups = [], periods = [], totals = {} } = ledger;

  return (
    <div className="tenant-ledger-page-shell" style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Tenant Ledger</div>
          <h1 style={styles.title}>{tenant.full_name}</h1>
          <p style={styles.subtitle}>
            {tenant.building_name || 'Building'} / {tenant.unit_number || 'Unit'} / {tenant.phone || 'No phone'}
          </p>
        </div>
        <div style={styles.headerActions}>
          <button type="button" style={styles.secondaryOnDark} onClick={() => navigate('/tenants')}>Tenants</button>
          <button type="button" style={styles.primaryOnDark} onClick={() => navigate('/monthly-rent-sheet')}>Rent Sheet</button>
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.metric}><span>Monthly Rent</span><strong>{formatCurrency(tenant.monthly_rent)}</strong></div>
        <div style={styles.metric}><span>Confirmed Paid</span><strong>{formatCurrency(totals.confirmed)}</strong></div>
        <div style={styles.metric}><span>Pending</span><strong>{formatCurrency(totals.pending)}</strong></div>
        <div style={styles.metric}><span>Open Follow-Ups</span><strong>{totals.open_followups || 0}</strong></div>
      </div>

      <div style={styles.contentGrid}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Monthly Statement</h2>
              <p style={styles.panelText}>Rent required, confirmed, pending, rejected, and balance by period.</p>
            </div>
            {latestPeriod ? <span style={styles.statusPill}>{latestPeriod.status}</span> : null}
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Required</th>
                  <th>Confirmed</th>
                  <th>Pending</th>
                  <th>Rejected</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {periods.length ? periods.map((period) => (
                  <tr key={period.period}>
                    <td>{period.period}</td>
                    <td>{formatCurrency(period.required)}</td>
                    <td>{formatCurrency(period.confirmed)}</td>
                    <td>{formatCurrency(period.pending)}</td>
                    <td>{formatCurrency(period.rejected)}</td>
                    <td>{formatCurrency(period.balance)}</td>
                    <td><span style={period.balance <= 0 ? styles.goodBadge : styles.warnBadge}>{period.status}</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan="7" style={styles.emptyCell}>No payments yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>Collection Follow-Up</h2>
          <form onSubmit={handleFollowUpSubmit} style={styles.followForm}>
            <select
              value={formData.action_type}
              onChange={(event) => setFormData((prev) => ({ ...prev, action_type: event.target.value }))}
              style={styles.input}
            >
              {actionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input
              type="month"
              value={formData.payment_period}
              onChange={(event) => setFormData((prev) => ({ ...prev, payment_period: event.target.value }))}
              style={styles.input}
            />
            <input
              type="date"
              value={formData.promise_date}
              onChange={(event) => setFormData((prev) => ({ ...prev, promise_date: event.target.value }))}
              style={styles.input}
            />
            <textarea
              value={formData.note}
              onChange={(event) => setFormData((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="Record call result, reminder message, promise to pay, or collection note..."
              style={{ ...styles.input, minHeight: 92, resize: 'vertical' }}
            />
            <button type="submit" style={styles.primaryButton} disabled={saving}>{saving ? 'Saving...' : 'Save Follow-Up'}</button>
          </form>

          <div style={styles.followList}>
            {followups.length ? followups.map((followup) => (
              <article key={followup.id} style={styles.followItem}>
                <div style={styles.followTop}>
                  <strong>{actionOptions.find((item) => item.value === followup.action_type)?.label || followup.action_type}</strong>
                  <span style={followup.status === 'done' ? styles.goodBadge : styles.warnBadge}>{followup.status}</span>
                </div>
                <p>{followup.note || '-'}</p>
                <div style={styles.followMeta}>
                  <span>{followup.payment_period || '-'}</span>
                  <span>Promise: {formatDate(followup.promise_date)}</span>
                  <span>{formatDateTime(followup.created_at)}</span>
                </div>
                {followup.status !== 'done' ? (
                  <button type="button" style={styles.smallButton} onClick={() => markFollowUpDone(followup)}>Mark Done</button>
                ) : null}
              </article>
            )) : <div style={styles.emptyCell}>No follow-up notes yet.</div>}
          </div>
        </section>
      </div>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Payment History</h2>
            <p style={styles.panelText}>Receipt links, approval state, rejection reason, and print tracking.</p>
          </div>
          <button type="button" style={styles.secondaryButton} onClick={() => navigate('/payments', { state: { recordPaymentFor: { tenantId: tenant.id, unitId: tenant.unit_id } } })}>
            Record Payment
          </button>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Period</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Receipt</th>
                <th>Verification</th>
                <th>Printed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length ? payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{formatDate(payment.payment_date)}</td>
                  <td>{payment.payment_period || '-'}</td>
                  <td>{formatCurrency(payment.amount)}</td>
                  <td>
                    <span style={(payment.payment_status || 'confirmed') === 'confirmed' ? styles.goodBadge : payment.payment_status === 'rejected' ? styles.badBadge : styles.warnBadge}>
                      {payment.payment_status || 'confirmed'}
                    </span>
                    {payment.rejection_reason ? <div style={styles.reasonText}>{payment.rejection_reason}</div> : null}
                  </td>
                  <td>
                    {payment.receipt_path ? <a href={resolveUploadUrl(payment.receipt_path)} target="_blank" rel="noreferrer">View</a> : '-'}
                  </td>
                  <td>{payment.verification_code || '-'}</td>
                  <td>{Number(payment.receipt_printed || 0) ? `Yes (${payment.receipt_print_count || 1})` : 'No'}</td>
                  <td>
                    <div style={styles.inlineActions}>
                      {payment.payment_status === 'pending' ? (
                        <>
                          <button type="button" style={styles.smallButton} onClick={() => confirmPayment(payment.id)}>Confirm</button>
                          <button type="button" style={styles.smallDangerButton} disabled={rejectingId === payment.id} onClick={() => rejectPayment(payment.id)}>Reject</button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="8" style={styles.emptyCell}>No payment history found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    padding: '1.5rem',
    borderRadius: '1rem',
    background: 'linear-gradient(135deg, #0f172a 0%, #155e75 56%, #0f766e 100%)',
    color: '#fff',
    boxShadow: '0 22px 46px rgba(15, 23, 42, 0.18)'
  },
  eyebrow: { color: '#99f6e4', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem', fontWeight: 900 },
  title: { margin: '0.2rem 0', fontSize: '2rem', lineHeight: 1.1, color: '#fff' },
  subtitle: { margin: 0, color: '#dbeafe', fontWeight: 700 },
  headerActions: { display: 'flex', gap: '0.6rem', alignItems: 'flex-start', flexWrap: 'wrap' },
  primaryOnDark: { background: '#fff', color: '#0f172a', border: '1px solid rgba(255,255,255,0.4)' },
  secondaryOnDark: { background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.9rem' },
  metric: { background: '#fff', border: '1px solid #dbe4f0', borderRadius: '0.8rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  contentGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', gap: '1rem' },
  panel: { background: '#fff', border: '1px solid #dbe4f0', borderRadius: '0.9rem', padding: '1rem', boxShadow: '0 14px 28px rgba(15, 23, 42, 0.05)' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '0.8rem' },
  panelTitle: { margin: 0, color: '#0f172a', fontSize: '1.15rem' },
  panelText: { margin: '0.25rem 0 0', color: '#64748b' },
  tableWrap: { overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.75rem' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 820 },
  followForm: { display: 'grid', gap: '0.65rem' },
  input: { width: '100%', border: '1px solid #cbd5e1', borderRadius: '0.65rem', padding: '0.7rem 0.8rem', color: '#0f172a', background: '#fff' },
  followList: { display: 'grid', gap: '0.65rem', marginTop: '1rem' },
  followItem: { border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.8rem', background: '#f8fafc' },
  followTop: { display: 'flex', justifyContent: 'space-between', gap: '0.7rem', alignItems: 'center' },
  followMeta: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap', color: '#64748b', fontSize: '0.8rem' },
  inlineActions: { display: 'flex', gap: '0.45rem', flexWrap: 'wrap' },
  primaryButton: { background: '#2563eb', color: '#fff', border: '1px solid #2563eb' },
  secondaryButton: { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' },
  smallButton: { padding: '0.42rem 0.65rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' },
  smallDangerButton: { padding: '0.42rem 0.65rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
  goodBadge: { display: 'inline-flex', padding: '0.25rem 0.5rem', borderRadius: 999, background: '#dcfce7', color: '#166534', fontWeight: 800, fontSize: '0.75rem' },
  warnBadge: { display: 'inline-flex', padding: '0.25rem 0.5rem', borderRadius: 999, background: '#fef3c7', color: '#92400e', fontWeight: 800, fontSize: '0.75rem' },
  badBadge: { display: 'inline-flex', padding: '0.25rem 0.5rem', borderRadius: 999, background: '#fee2e2', color: '#991b1b', fontWeight: 800, fontSize: '0.75rem' },
  statusPill: { display: 'inline-flex', padding: '0.4rem 0.7rem', borderRadius: 999, background: '#ecfdf5', color: '#047857', fontWeight: 900 },
  reasonText: { marginTop: '0.25rem', color: '#991b1b', fontSize: '0.78rem' },
  emptyCell: { padding: '1rem', textAlign: 'center', color: '#64748b' },
  empty: { padding: '2rem', background: '#fff', borderRadius: '1rem' },
  loading: { padding: '2rem', color: '#475569' }
};

export default TenantLedger;
