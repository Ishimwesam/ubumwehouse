import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, resolveTenantUploadUrl, tenantPortalService } from '../services/api';
import TenantRentDueNotice from '../components/TenantRentDueNotice';
import { TenantMobileAppHeader, TenantPortalShell, useTenantLanguage } from '../components/TenantPortalNav';
import '../styles/tenant-portal.css';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;
const formatDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString().slice(0, 10);
};

const formatPaymentMethod = (value = '', text = {}) => {
  const method = String(value || '').toLowerCase();
  if (method === 'bank_transfer') return text.bankDeposit || 'Bank Deposit';
  if (method === 'mobile_money') return text.mobileMoney || 'Mobile Money';
  if (method === 'cash') return text.cash || 'Cash';
  if (method === 'check') return text.check || 'Check';
  return value || '-';
};

const formatPaymentStatus = (value = '', text = {}) => {
  const status = String(value || '').toLowerCase();
  if (status === 'confirmed') return text.approved || 'Approved';
  if (status === 'pending') return text.pending || 'Pending';
  if (status === 'rejected') return text.rejected || 'Rejected';
  if (status === 'partial') return text.partial || 'Partial';
  if (status === 'overpaid') return text.overpaid || 'Overpaid';
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : (text.approved || 'Approved');
};

const TenantPortalPayments = () => {
  const navigate = useNavigate();
  const [, text] = useTenantLanguage();
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
    method: formatPaymentMethod(payment.payment_method, text),
    reference: payment.verification_code || payment.id || '-',
    status: formatPaymentStatus(payment.payment_status, text),
    receipt: resolveTenantUploadUrl(payment.receipt_path) || '',
    rejectionReason: payment.rejection_reason || '',
    rejectedAt: payment.rejected_at || ''
  }));

  const companyName = useMemo(() => 'UBUMWE HOUSE LTD', []);

  const loadPortalData = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const response = await tenantPortalService.me();
      setPortalData(response.data);
    } catch (err) {
      if (!silent) setError(getReadableApiError(err, text.failedLoadPaymentHistory || 'Failed to load payment history.'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleDownloadStatement = () => {
    const headers = [text.paymentDate, text.rentMonth, text.amountPaid, text.paymentMethod, text.transactionReference, text.paymentStatus, text.rejectionReason];
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

    loadPortalData().finally(() => {
      if (!mounted) return;
    });

    return () => {
      mounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    const onPortalEvent = (event) => {
      if (!['tenant_payment_update', 'tenant_rent_due'].includes(event.detail?.event_type)) return;
      loadPortalData({ silent: true });
    };
    window.addEventListener('tp:portal-event', onPortalEvent);
    return () => window.removeEventListener('tp:portal-event', onPortalEvent);
  }, []);

  return (
    <TenantPortalShell current="payments">
        <TenantMobileAppHeader current="payments" />
        <header className="tp-header">
          <div>
            <h1>{companyName} {text.paymentHistory}</h1>
            <p>{text.paymentHistorySubtitle}</p>
          </div>
          <button className="tp-btn-secondary" type="button" onClick={() => navigate('/tenant-portal')}>
            {text.backToDashboard}
          </button>
        </header>

        {error ? <div className="tp-alert error">{error}</div> : null}

        <TenantRentDueNotice tenant={tenant} onUpload={() => navigate('/tenant-portal/upload')} />

        <section className="tp-stats-row" style={{ marginTop: 14 }}>
          <article className="tp-stat-card">
            <div>
              <span>{text.totalPaid}</span>
              <strong className="paid">{formatCurrency(totalPaid)}</strong>
            </div>
          </article>
          <article className="tp-stat-card">
            <div>
              <span>{text.outstandingBalance}</span>
              <strong className="outstanding">{formatCurrency(outstandingBalance)}</strong>
            </div>
          </article>
          <article className="tp-stat-card">
            <div>
              <span>{text.lastPaymentDate}</span>
              <strong>{formatDate(lastPaymentDate)}</strong>
            </div>
          </article>
          <article className="tp-stat-card">
            <div>
              <span>{text.pendingPayments}</span>
              <strong>{pendingCount}</strong>
            </div>
          </article>
        </section>

        <section className="tp-card tp-section-anchor" id="history" style={{ marginTop: 14 }}>
          <div className="tp-card-header-row">
            <h2>{text.paymentsTitle}</h2>
            <div className="tp-payment-actions">
              <button className="tp-btn-primary" type="button" onClick={() => navigate('/tenant-portal/upload')}>{text.uploadNewReceipt}</button>
              <button className="tp-btn-secondary" type="button" onClick={handleDownloadStatement}>{text.downloadStatement}</button>
              <button className="tp-btn-secondary" type="button" onClick={() => navigate('/tenant-portal/messages')}>{text.contactAdmin}</button>
            </div>
          </div>
          {loading ? <p className="tp-empty">{text.loadingPaymentHistory}</p> : null}
          {!loading ? (
            <div className="tp-table-wrap" id="receipts">
              <table>
                <thead>
                  <tr>
                    <th>{text.paymentDate}</th>
                    <th>{text.rentMonth}</th>
                    <th>{text.amountPaid}</th>
                    <th>{text.paymentMethod}</th>
                    <th>{text.transactionReference}</th>
                    <th>{text.paymentStatus}</th>
                    <th>{text.receipt}</th>
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
                              <strong>{text.reason}:</strong> {payment.rejectionReason || text.noRejectionReason}
                              {payment.rejectedAt ? <small>{text.rejectedOn.replace('{date}', formatDate(payment.rejectedAt))}</small> : null}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          {payment.receipt ? (
                            <a href={payment.receipt} target="_blank" rel="noreferrer">{text.viewDownloadReceipt}</a>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={7}>{text.noPaymentHistoryYet}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
    </TenantPortalShell>
  );
};

export default TenantPortalPayments;
