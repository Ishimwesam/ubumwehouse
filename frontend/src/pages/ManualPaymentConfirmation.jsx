import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentService, resolveUploadUrl } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useDataSync } from '../context/DataSyncContext';

const formatCurrency = (value) =>
  `${parseFloat(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6" />
    <path d="M3 12a9 9 0 0 1 15.5-6.36L21 8" />
    <path d="M3 22v-6h6" />
    <path d="M21 12a9 9 0 0 1-15.5 6.36L3 16" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 5 5L20 7" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

const ManualPaymentConfirmation = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { versions, notifyDataChanged } = useDataSync();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [workingId, setWorkingId] = useState('');

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await paymentService.getAll();
      setPayments(response.data || []);
    } catch (error) {
      showToast('Failed to load pending payments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [versions.payments]);

  const pendingPayments = useMemo(
    () => payments.filter((payment) => payment.payment_status === 'pending'),
    [payments]
  );

  useEffect(() => {
    try {
      localStorage.setItem('pendingPaymentsCount', String(pendingPayments.length));
    } catch (_) {}
  }, [pendingPayments.length]);

  const filteredPayments = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return pendingPayments;

    return pendingPayments.filter((payment) =>
      [
        payment.tenant_name,
        payment.unit_number,
        payment.building_name,
        payment.payment_method,
        payment.payment_period,
        payment.notes
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch))
    );
  }, [pendingPayments, searchTerm]);

  const totalPending = pendingPayments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
  const readyToConfirm = pendingPayments.filter((payment) => payment.receipt_path).length;
  const missingReceipts = pendingPayments.length - readyToConfirm;

  const handleConfirm = async (payment) => {
    if (!payment?.receipt_path) {
      showToast('Attach a receipt before confirming this payment.', 'warning');
      return;
    }

    try {
      setWorkingId(payment.id);
      await paymentService.confirm(payment.id);
      notifyDataChanged(['payments', 'dashboard', 'reports', 'tenants', 'units']);
      showToast('Payment confirmed successfully', 'success');
      await fetchPayments();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to confirm payment', 'error');
    } finally {
      setWorkingId('');
    }
  };

  const handleDelete = async (paymentId) => {
    if (!window.confirm('Delete this pending payment?')) return;

    try {
      setWorkingId(paymentId);
      await paymentService.delete(paymentId);
      notifyDataChanged(['payments', 'dashboard', 'reports', 'tenants', 'units']);
      showToast('Pending payment deleted', 'success');
      await fetchPayments();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to delete payment', 'error');
    } finally {
      setWorkingId('');
    }
  };

  const handleReject = async (payment) => {
    const reason = window.prompt('Reason for rejecting this payment');
    if (!reason) return;

    try {
      setWorkingId(payment.id);
      await paymentService.rejectPayment(payment.id, reason);
      notifyDataChanged(['payments', 'dashboard', 'reports', 'tenants', 'units']);
      showToast('Payment rejected', 'success');
      await fetchPayments();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to reject payment', 'error');
    } finally {
      setWorkingId('');
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Manual Payment Confirmation</h1>
          <p style={styles.subtitle}>Review receipts, confirm pending records, and clear issues before they affect reports.</p>
        </div>
        <div style={styles.headerActions}>
          <button type="button" style={styles.secondaryButton} onClick={fetchPayments}>
            <span style={styles.buttonInner}><RefreshIcon />Refresh queue</span>
          </button>
          <button type="button" style={styles.primaryButton} onClick={() => navigate('/payments')}>
            Back to Payments
          </button>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Pending Review</div>
          <div style={styles.statValue}>{pendingPayments.length}</div>
          <div style={styles.statHint}>Payments waiting for confirmation.</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Ready To Confirm</div>
          <div style={styles.statValue}>{readyToConfirm}</div>
          <div style={styles.statHint}>Pending payments with receipt files attached.</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Missing Receipt</div>
          <div style={{ ...styles.statValue, color: '#dc2626' }}>{missingReceipts}</div>
          <div style={styles.statHint}>These need a receipt before approval.</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Pending Amount</div>
          <div style={{ ...styles.statValue, color: '#1d4ed8' }}>{formatCurrency(totalPending)}</div>
          <div style={styles.statHint}>Total value waiting in the queue.</div>
        </div>
      </div>

      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}><SearchIcon /></span>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search tenant, unit, method, period, or notes"
            style={styles.searchInput}
          />
        </div>
        <div style={styles.toolbarText}>
          Showing <strong>{filteredPayments.length}</strong> of <strong>{pendingPayments.length}</strong> pending payments
        </div>
      </div>

      <div style={styles.card}>
        {loading ? (
          <div style={styles.emptyState}>Loading pending payments...</div>
        ) : filteredPayments.length === 0 ? (
          <div style={styles.emptyState}>
            {pendingPayments.length === 0 ? 'No pending payments found.' : 'No pending payments match the current search.'}
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Tenant</th>
                  <th style={styles.th}>Unit</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Method</th>
                  <th style={styles.th}>Receipt</th>
                  <th style={styles.th}>Notes</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => {
                  const hasReceipt = Boolean(payment.receipt_path);
                  const isWorking = workingId === payment.id;

                  return (
                    <tr key={payment.id} style={styles.row}>
                      <td style={styles.td}>{new Date(payment.payment_date).toLocaleDateString()}</td>
                      <td style={styles.td}>
                        <div style={styles.primaryCell}>{payment.tenant_name || 'Unknown tenant'}</div>
                        <div style={styles.secondaryCell}>{payment.building_name || 'No building'}</div>
                      </td>
                      <td style={styles.td}>{payment.unit_number || 'N/A'}</td>
                      <td style={{ ...styles.td, ...styles.amountCell }}>{formatCurrency(payment.amount)}</td>
                      <td style={styles.td}>
                        <span style={styles.methodBadge}>{payment.payment_method || 'Cash'}</span>
                      </td>
                      <td style={styles.td}>
                        {hasReceipt ? (
                          <a
                            href={resolveUploadUrl(payment.receipt_path)}
                            target="_blank"
                            rel="noreferrer"
                            style={styles.receiptLink}
                          >
                            View upload
                          </a>
                        ) : (
                          <span style={styles.missingReceipt}>Missing receipt</span>
                        )}
                      </td>
                      <td style={styles.td}>{payment.notes || '-'}</td>
                      <td style={styles.td}>
                        <div style={styles.actions}>
                          <button
                            type="button"
                            style={{
                              ...styles.actionButton,
                              ...styles.confirmButton,
                              ...(hasReceipt ? null : styles.disabledButton)
                            }}
                            onClick={() => handleConfirm(payment)}
                            disabled={!hasReceipt || isWorking}
                          >
                            <span style={styles.buttonInner}><CheckIcon />Confirm</span>
                          </button>
                          <button
                            type="button"
                            style={{ ...styles.actionButton, ...styles.deleteButton }}
                            onClick={() => handleReject(payment)}
                            disabled={isWorking}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            style={{ ...styles.actionButton, ...styles.deleteButton }}
                            onClick={() => handleDelete(payment.id)}
                            disabled={isWorking}
                          >
                            <span style={styles.buttonInner}><TrashIcon />Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem'
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap'
  },
  title: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: 800,
    color: '#0f172a'
  },
  subtitle: {
    margin: '0.5rem 0 0',
    fontSize: '1rem',
    color: '#475569'
  },
  headerActions: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap'
  },
  primaryButton: {
    border: 'none',
    borderRadius: '14px',
    padding: '0.9rem 1.25rem',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer'
  },
  secondaryButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '14px',
    padding: '0.9rem 1.25rem',
    background: '#fff',
    color: '#0f172a',
    fontWeight: 700,
    cursor: 'pointer'
  },
  buttonInner: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem'
  },
  statCard: {
    background: '#fff',
    border: '1px solid #dbe7ff',
    borderRadius: '20px',
    padding: '1.25rem',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.05)'
  },
  statLabel: {
    fontSize: '0.82rem',
    fontWeight: 700,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    color: '#64748b'
  },
  statValue: {
    marginTop: '0.55rem',
    fontSize: '1.85rem',
    fontWeight: 800,
    color: '#0f172a'
  },
  statHint: {
    marginTop: '0.45rem',
    fontSize: '0.95rem',
    color: '#475569',
    lineHeight: 1.5
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap'
  },
  searchWrap: {
    flex: '1 1 320px',
    minWidth: '280px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    background: '#fff',
    border: '1px solid #d9e2f2',
    borderRadius: '16px',
    padding: '0 1rem',
    boxShadow: '0 18px 36px rgba(15, 23, 42, 0.04)'
  },
  searchIcon: {
    color: '#64748b',
    display: 'inline-flex',
    alignItems: 'center'
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    width: '100%',
    minHeight: '48px',
    fontSize: '0.98rem',
    color: '#0f172a',
    background: 'transparent'
  },
  toolbarText: {
    fontSize: '0.95rem',
    color: '#475569'
  },
  card: {
    background: '#fff',
    border: '1px solid #dbe7ff',
    borderRadius: '24px',
    padding: '1.25rem',
    boxShadow: '0 24px 48px rgba(15, 23, 42, 0.05)'
  },
  tableWrapper: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '980px'
  },
  th: {
    textAlign: 'left',
    padding: '0.9rem 0.85rem',
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    color: '#64748b',
    borderBottom: '1px solid #e2e8f0'
  },
  row: {
    borderBottom: '1px solid #eef2ff'
  },
  td: {
    padding: '1rem 0.85rem',
    fontSize: '0.96rem',
    color: '#0f172a',
    verticalAlign: 'top'
  },
  primaryCell: {
    fontWeight: 700,
    color: '#0f172a'
  },
  secondaryCell: {
    marginTop: '0.2rem',
    fontSize: '0.86rem',
    color: '#64748b'
  },
  amountCell: {
    fontWeight: 800,
    color: '#16a34a'
  },
  methodBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.32rem 0.62rem',
    borderRadius: '999px',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontWeight: 700,
    fontSize: '0.82rem',
    textTransform: 'capitalize'
  },
  receiptLink: {
    color: '#2563eb',
    fontWeight: 700,
    textDecoration: 'none'
  },
  missingReceipt: {
    color: '#dc2626',
    fontWeight: 700,
    fontSize: '0.88rem'
  },
  actions: {
    display: 'flex',
    gap: '0.6rem',
    flexWrap: 'wrap'
  },
  actionButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '0.68rem 0.9rem',
    fontWeight: 700,
    cursor: 'pointer'
  },
  confirmButton: {
    background: '#dcfce7',
    color: '#166534'
  },
  deleteButton: {
    background: '#fef2f2',
    color: '#b91c1c'
  },
  disabledButton: {
    opacity: 0.45,
    cursor: 'not-allowed'
  },
  emptyState: {
    padding: '2rem 1rem',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '1rem'
  }
};

export default ManualPaymentConfirmation;
