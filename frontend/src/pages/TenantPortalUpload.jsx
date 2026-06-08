import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, tenantPortalService } from '../services/api';
import '../styles/tenant-portal.css';

const currentPeriod = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

const TenantPortalUpload = () => {
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    amount: '',
    payment_date: today(),
    payment_period: currentPeriod(),
    payment_method: 'bank_transfer',
    notes: '',
    receipt: null
  });

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
        setTenant(response.data?.tenant || null);
        setForm((prev) => ({ ...prev, amount: response.data?.tenant?.balance || response.data?.tenant?.monthly_rent || '' }));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(getReadableApiError(err, 'Failed to load tenant account.'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!form.receipt) {
      setError('Upload a receipt image or PDF before submitting proof.');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');
    try {
      await tenantPortalService.uploadPaymentProof(form);
      setSuccess('Payment proof uploaded successfully.');
      setForm((prev) => ({ ...prev, receipt: null, notes: '' }));
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to upload payment proof.'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="tp-page tp-subpage">
      <section className="tp-main tp-subpage-main">
        <header className="tp-header">
          <div>
            <h1>Upload Payment Receipt</h1>
            <p>Bank deposit receipts for UBUMWE HOUSE LTD payment confirmation.</p>
          </div>
          <button className="tp-btn-secondary" type="button" onClick={() => navigate('/tenant-portal')}>
            Back To Dashboard
          </button>
        </header>

        {error ? <div className="tp-alert error">{error}</div> : null}
        {success ? <div className="tp-alert success">{success}</div> : null}

        <section className="tp-card" style={{ marginTop: 14 }}>
          <h2>Receipt Details</h2>
          {loading ? <p className="tp-empty">Loading account details...</p> : null}
          {!loading ? (
            <form className="tp-upload-form" onSubmit={handleUpload}>
              <label>
                Amount
                <input type="number" min="1" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} required />
              </label>
              <label>
                Payment date
                <input type="date" value={form.payment_date} onChange={(event) => setForm((prev) => ({ ...prev, payment_date: event.target.value }))} required />
              </label>
              <label>
                Payment period
                <input type="month" value={form.payment_period} onChange={(event) => setForm((prev) => ({ ...prev, payment_period: event.target.value }))} required />
              </label>
              <label>
                Method
                <select value={form.payment_method} onChange={(event) => setForm((prev) => ({ ...prev, payment_method: event.target.value }))}>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="mobile_money">Mobile money</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                </select>
              </label>
              <label className="full">
                Receipt image or PDF
                <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setForm((prev) => ({ ...prev, receipt: event.target.files?.[0] || null }))} required />
              </label>
              <label className="full">
                Notes
                <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} />
              </label>
              <button className="tp-btn-primary" type="submit" disabled={uploading}>
                {uploading ? 'Uploading...' : 'Submit Proof'}
              </button>
            </form>
          ) : null}

          {tenant ? <p className="tp-empty" style={{ marginTop: 10 }}>Tenant: {tenant.full_name || '-'} / Unit {tenant.unit_number || '-'}</p> : null}
        </section>
      </section>
    </main>
  );
};

export default TenantPortalUpload;
