import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, tenantPortalService } from '../services/api';
import '../styles/tenant-portal.css';

const TenantPortalProfile = () => {
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      })
      .catch((err) => {
        if (!mounted) return;
        setError(getReadableApiError(err, 'Failed to load profile.'));
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
            <h1>Profile</h1>
            <p>Tenant account information linked to UBUMWE HOUSE LTD.</p>
          </div>
          <button className="tp-btn-secondary" type="button" onClick={() => navigate('/tenant-portal')}>
            Back To Dashboard
          </button>
        </header>

        {error ? <div className="tp-alert error">{error}</div> : null}

        <section className="tp-card" style={{ marginTop: 14 }}>
          <h2>Tenant Details</h2>
          {loading ? <p className="tp-empty">Loading profile...</p> : null}
          {!loading ? (
            <div className="tp-payment-list">
              <div><span>Tenant Name</span><strong>{tenant?.full_name || '-'}</strong></div>
              <div><span>Company</span><strong>UBUMWE HOUSE LTD</strong></div>
              <div><span>Email</span><strong>{tenant?.email || '-'}</strong></div>
              <div><span>Phone</span><strong>{tenant?.phone || '-'}</strong></div>
              <div><span>Building</span><strong>{tenant?.building_name || '-'}</strong></div>
              <div><span>Unit</span><strong>{tenant?.unit_number || '-'}</strong></div>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
};

export default TenantPortalProfile;
