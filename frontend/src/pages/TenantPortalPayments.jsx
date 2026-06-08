import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, resolveUploadUrl, tenantPortalService } from '../services/api';
import '../styles/tenant-portal.css';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;

const TenantPortalPayments = () => {
  const navigate = useNavigate();
  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const payments = portalData?.payments || [];

  const companyName = useMemo(() => 'UBUMWE HOUSE LTD', []);

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
        tenantPortalService.clearToken();
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

        <section className="tp-card" style={{ marginTop: 14 }}>
          <h2>Payments</h2>
          {loading ? <p className="tp-empty">Loading payment history...</p> : null}
          {!loading ? (
            <div className="tp-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Method</th>
                    <th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length ? payments.map((payment) => {
                    const receiptUrl = resolveUploadUrl(payment.receipt_path);
                    return (
                      <tr key={payment.id}>
                        <td>{payment.payment_date || '-'}</td>
                        <td>RENT - {payment.payment_period || '-'}</td>
                        <td>{formatCurrency(payment.amount)}</td>
                        <td>
                          <span className={`tp-status-pill ${String(payment.payment_status || '').toLowerCase()}`}>
                            {payment.payment_status || 'confirmed'}
                          </span>
                        </td>
                        <td>{payment.payment_method || '-'}</td>
                        <td>
                          {receiptUrl ? (
                            <a href={receiptUrl} target="_blank" rel="noreferrer">Download</a>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={6}>No payment history yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
};

export default TenantPortalPayments;
