import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReadableApiError, tenantPortalService } from '../services/api';
import TenantPortalNav, { useTenantLanguage } from '../components/TenantPortalNav';
import '../styles/tenant-portal.css';

const TenantPortalProfile = () => {
  const navigate = useNavigate();
  const [, text] = useTenantLanguage();
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
        setError(getReadableApiError(err, text.failedLoadProfile));
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
            <h1>{text.profile}</h1>
            <p>{text.profileSubtitle}</p>
          </div>
          <button className="tp-btn-secondary" type="button" onClick={() => navigate('/tenant-portal')}>
            {text.backToDashboard}
          </button>
        </header>

        {error ? <div className="tp-alert error">{error}</div> : null}

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
      </section>
      <TenantPortalNav current="profile" mobileOnly />
    </main>
  );
};

export default TenantPortalProfile;
