import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, tenantPortalService } from '../services/api';
import { TenantMobileAppHeader, TenantPortalShell, useTenantLanguage } from '../components/TenantPortalNav';
import '../styles/tenant-portal.css';

const TenantPortalProfile = () => {
  const navigate = useNavigate();
  const [, text] = useTenantLanguage();
  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const tenant = portalData?.tenant || null;
  const activeContract = portalData?.contracts?.find((contract) => (contract.lifecycle_status || contract.status) === 'active') || portalData?.contracts?.[0] || null;

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
        setPortalData(response.data || null);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(getReadableApiError(err, text.failedLoadProfile));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(passwordForm.newPassword)) {
      setError('Password must be at least 8 characters and include a letter and a number.');
      return;
    }

    setSavingPassword(true);
    setError('');
    setSuccess('');
    try {
      await tenantPortalService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccess('Password changed successfully.');
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to change password.'));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <TenantPortalShell current="profile">
        <TenantMobileAppHeader current="profile" />
        <header className="tp-header">
          <div>
            <h1>{text.profile}</h1>
            <p>{text.profileSubtitle}</p>
          </div>
          <button className="tp-btn-secondary" type="button" onClick={() => navigate('/tenant-portal')}>
            {text.backToDashboard}
          </button>
        </header>

        {error ? <div className="tp-alert error">{error}</div> : null}
        {success ? <div className="tp-alert success">{success}</div> : null}

        <section className="tp-card" style={{ marginTop: 14 }}>
          <h2>{text.tenantDetails}</h2>
          {loading ? <p className="tp-empty">{text.loadingProfile}</p> : null}
          {!loading ? (
            <div className="tp-payment-list">
              <div><span>{text.tenantName}</span><strong>{tenant?.full_name || '-'}</strong></div>
              <div><span>{text.company}</span><strong>UBUMWE HOUSE LTD</strong></div>
              <div><span>{text.email}</span><strong>{tenant?.email || '-'}</strong></div>
              <div><span>{text.phone}</span><strong>{tenant?.phone || '-'}</strong></div>
              <div><span>{text.building}</span><strong>{tenant?.building_name || '-'}</strong></div>
              <div><span>{text.unit}</span><strong>{tenant?.unit_number || '-'}</strong></div>
            </div>
          ) : null}
        </section>

        <section className="tp-main-grid second-row">
          <article className="tp-card tp-section-anchor" id="lease">
            <h2>{text.lease}</h2>
            <div className="tp-payment-list">
              <div><span>{text.building}</span><strong>{activeContract?.building_name || tenant?.building_name || '-'}</strong></div>
              <div><span>{text.unit}</span><strong>{activeContract?.unit_number || tenant?.unit_number || '-'}</strong></div>
              <div><span>Start</span><strong>{activeContract?.contract_start || tenant?.move_in_date || '-'}</strong></div>
              <div><span>End</span><strong>{activeContract?.contract_end || tenant?.move_out_date || '-'}</strong></div>
              <div><span>{text.status}</span><strong>{(activeContract?.lifecycle_status || activeContract?.status || tenant?.status || '-').replace(/_/g, ' ')}</strong></div>
            </div>
          </article>

          <article className="tp-card tp-section-anchor" id="password">
            <h2>{text.password}</h2>
            <form className="tp-upload-form tp-password-form" onSubmit={handlePasswordSubmit}>
              <label className="full">
                Current password
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                  required
                />
              </label>
              <label className="full">
                New password
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                  required
                />
              </label>
              <label className="full">
                Confirm new password
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                  required
                />
              </label>
              <button className="tp-btn-primary" type="submit" disabled={savingPassword}>
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </article>
        </section>
    </TenantPortalShell>
  );
};

export default TenantPortalProfile;
