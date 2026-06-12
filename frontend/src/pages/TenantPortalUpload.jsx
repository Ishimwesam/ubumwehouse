import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, tenantPortalService } from '../services/api';
import ReceiptCaptureInput from '../components/ReceiptCaptureInput';
import TenantPortalNav, { TenantMobileAppHeader, useTenantLanguage } from '../components/TenantPortalNav';
import '../styles/tenant-portal.css';

const currentPeriod = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

const TenantPortalUpload = () => {
  const navigate = useNavigate();
  const [, text] = useTenantLanguage();
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
        setError(getReadableApiError(err, text.failedLoadTenantAccount));
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
      setError(text.uploadReceiptRequired);
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');
    try {
      await tenantPortalService.uploadPaymentProof(form);
      setSuccess(text.paymentProofUploaded);
      setForm((prev) => ({ ...prev, receipt: null, notes: '' }));
    } catch (err) {
      setError(getReadableApiError(err, text.failedUploadPaymentProof));
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="tp-page tp-subpage">
      <section className="tp-main tp-subpage-main">
        <TenantMobileAppHeader current="upload" />
        <header className="tp-header">
          <div>
            <h1>{text.uploadPaymentReceipt}</h1>
            <p>{text.uploadPaymentSubtitle}</p>
          </div>
          <button className="tp-btn-secondary" type="button" onClick={() => navigate('/tenant-portal')}>
            {text.backToDashboard}
          </button>
        </header>

        {error ? <div className="tp-alert error">{error}</div> : null}
        {success ? <div className="tp-alert success">{success}</div> : null}

        <section className="tp-card" style={{ marginTop: 14 }}>
          <h2>{text.receiptDetails}</h2>
          {loading ? <p className="tp-empty">{text.loadingAccountDetails}</p> : null}
          {!loading ? (
            <form className="tp-upload-form" onSubmit={handleUpload}>
              <label>
                {text.amount}
                <input type="number" min="1" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} required />
              </label>
              <label>
                {text.paymentDate}
                <input type="date" value={form.payment_date} onChange={(event) => setForm((prev) => ({ ...prev, payment_date: event.target.value }))} required />
              </label>
              <label>
                {text.paymentPeriod}
                <input type="month" value={form.payment_period} onChange={(event) => setForm((prev) => ({ ...prev, payment_period: event.target.value }))} required />
              </label>
              <label>
                {text.method}
                <select value={form.payment_method} onChange={(event) => setForm((prev) => ({ ...prev, payment_method: event.target.value }))}>
                  <option value="bank_transfer">{text.bankDeposit}</option>
                  <option value="mobile_money">{text.mobileMoney}</option>
                  <option value="cash">{text.cash}</option>
                  <option value="check">{text.check}</option>
                </select>
              </label>
              <div className="full tp-upload-field">
                <span>{text.receiptFile}</span>
                <ReceiptCaptureInput
                  file={form.receipt}
                  onFileSelected={(file) => setForm((prev) => ({ ...prev, receipt: file }))}
                />
              </div>
              <label className="full">
                {text.notes}
                <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} />
              </label>
              <button className="tp-btn-primary" type="submit" disabled={uploading}>
                {uploading ? text.uploading : text.submitProof}
              </button>
            </form>
          ) : null}

          {tenant ? <p className="tp-empty" style={{ marginTop: 10 }}>{text.tenantLabel}: {tenant.full_name || '-'} / {text.unit} {tenant.unit_number || '-'}</p> : null}
        </section>
      </section>
      <TenantPortalNav current="upload" mobileOnly />
    </main>
  );
};

export default TenantPortalUpload;
