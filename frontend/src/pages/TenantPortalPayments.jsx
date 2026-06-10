import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, resolveTenantUploadUrl, tenantPortalService } from '../services/api';
import TenantPortalNav from '../components/TenantPortalNav';
import '../styles/tenant-portal.css';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;
const formatDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString().slice(0, 10);
};

const formatPaymentMethod = (value = '') => {
  const method = String(value || '').toLowerCase();
  if (method === 'bank_transfer') return 'Bank Deposit';
  if (method === 'mobile_money') return 'Mobile Money';
  if (method === 'cash') return 'Cash';
  if (method === 'check') return 'Check';
  return value || '-';
};

const formatPaymentStatus = (value = '') => {
  const status = String(value || '').toLowerCase();
  if (status === 'confirmed') return 'Approved';
  if (status === 'pending') return 'Pending';
  if (status === 'rejected') return 'Rejected';
  if (status === 'partial') return 'Partial';
  if (status === 'overpaid') return 'Overpaid';
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Approved';
};

const TenantPortalPayments = () => {
  const navigate = useNavigate();
  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const payments = portalData?.payments || [];
  const tenant = portalData?.tenant || {};
  const monthlyRent = Number(tenant.monthly_rent || 0);
  const totalPaid = payments
    .filter((payment) => String(payment.payment_status || 'confirmed').toLowerCase() !== 'rejected')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const pendingCount = payments.filter((payment) => String(payment.payment_status || '').toLowerCase() === 'pending').length;
  const lastPaymentDate = payments.length ? payments[0].payment_date || payments[0].created_at : null;
  const outstandingBalance = Number(tenant.balance || Math.max(0, monthlyRent - totalPaid));
  const statementRows = payments.map((payment) => ({
    date: formatDate(payment.payment_date),
    rentMonth: payment.payment_period || '-',
    amount: formatCurrency(payment.amount),
    method: formatPaymentMethod(payment.payment_method),
    reference: payment.verification_code || payment.id || '-',
    status: formatPaymentStatus(payment.payment_status),
    receipt: resolveTenantUploadUrl(payment.receipt_path) || '',
    rejectionReason: payment.rejection_reason || '',
    rejectedAt: payment.rejected_at || ''
  }));

  const companyName = useMemo(() => 'UBUMWE HOUSE LTD', []);

  const handleDownloadStatement = () => {
    const headers = ['Payment Date', 'Rent Month', 'Amount Paid', 'Payment Method', 'Transaction Reference', 'Payment Status', 'Rejection Reason'];
    const csv = [
      headers.join(','),
      ...statementRows.map((row) => [row.date, row.rentMonth, row.amount, row.method, row.reference, row.status, row.rejectionReason].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tenant-payment-statement-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let mounted = true;
    const token = tenantPortalService.getToken();
    if (!token) {
      navigate('/tenant-portal');
      return undefined;
    }

    setLoading(true);
    tenantPortalService.me()
      .then((response) => {
        if (!mounted) return;
        setPortalData(response.data);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(getReadableApiError(err, 'Failed to load payment history.'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <main className="tp-page tp-subpage">
      <section className="tp-main tp-subpage-main">
        <header className="tp-header">
          <div>
            <h1>{companyName} Payment History</h1>
            <p>All receipts and payment records for your tenant portal account.</p>
          </div>
          <button className="tp-btn-secondary" type="button" onClick={() => navigate('/tenant-portal')}>
            Back To Dashboard
          </button>
        </header>

        {error ? <div className="tp-alert error">{error}</div> : null}

        <section className="tp-stats-row" style={{ marginTop: 14 }}>
          <article className="tp-stat-card">
            <div>
              <span>Total Paid</span>
              <strong className="paid">{formatCurrency(totalPaid)}</strong>
            </div>
          </article>
          <article className="tp-stat-card">
            <div>
              <span>Outstanding Balance</span>
              <strong className="outstanding">{formatCurrency(outstandingBalance)}</strong>
            </div>
          </article>
          <article className="tp-stat-card">
            <div>
              <span>Last Payment Date</span>
              <strong>{formatDate(lastPaymentDate)}</strong>
            </div>
          </article>
          <article className="tp-stat-card">
            <div>
              <span>Pending Payments</span>
              <strong>{pendingCount}</strong>
            </div>
          </article>
        </section>

        <section className="tp-card" style={{ marginTop: 14 }}>
          <div className="tp-card-header-row">
            <h2>Payments</h2>
            <div className="tp-payment-actions">
              <button className="tp-btn-primary" type="button" onClick={() => navigate('/tenant-portal/upload')}>Upload New Receipt</button>
              <button className="tp-btn-secondary" type="button" onClick={handleDownloadStatement}>Download Statement</button>
              <button className="tp-btn-secondary" type="button" onClick={() => navigate('/tenant-portal/messages')}>Contact Admin</button>
            </div>
          </div>
          {loading ? <p className="tp-empty">Loading payment history...</p> : null}
          {!loading ? (
            <div className="tp-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Payment Date</th>
                    <th>Rent Month</th>
                    <th>Amount Paid</th>
                    <th>Payment Method</th>
                    <th>Transaction Reference</th>
                    <th>Payment Status</th>
                    <th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {statementRows.length ? statementRows.map((payment, index) => {
                    return (
                      <tr key={payments[index]?.id || `${payment.reference}-${index}`}>
                        <td>{payment.date}</td>
                        <td>{payments[index]?.payment_period || '-'}</td>
                        <td>{payment.amount}</td>
                        <td>{payment.method}</td>
                        <td>{payment.reference}</td>
                        <td>
                          <span className={`tp-status-pill ${String(payments[index]?.payment_status || 'confirmed').toLowerCase()}`}>
                            {payment.status}
                          </span>
                          {String(payments[index]?.payment_status || '').toLowerCase() === 'rejected' ? (
                            <div className="tp-rejection-note">
                              <strong>Reason:</strong> {payment.rejectionReason || 'No reason was recorded. Please contact admin.'}
                              {payment.rejectedAt ? <small>Rejected {formatDate(payment.rejectedAt)}</small> : null}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          {payment.receipt ? (
                            <a href={payment.receipt} target="_blank" rel="noreferrer">View / Download</a>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={7}>No payment history yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </section>
      <TenantPortalNav current="payments" mobileOnly />
    </main>
  );
};

export default TenantPortalPayments;
