import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/tenant-portal.css';

const TenantPortalAnnouncements = () => {
  const navigate = useNavigate();

  return (
    <main className="tp-page tp-subpage">
      <section className="tp-main tp-subpage-main">
        <header className="tp-header">
          <div>
            <h1>Announcements</h1>
            <p>Official UBUMWE HOUSE LTD updates for tenants.</p>
          </div>
          <button className="tp-btn-secondary" type="button" onClick={() => navigate('/tenant-portal')}>
            Back To Dashboard
          </button>
        </header>

        <section className="tp-card" style={{ marginTop: 14 }}>
          <h2>Latest Updates</h2>
          <p className="tp-empty">No announcements yet. New notices from UBUMWE HOUSE LTD will appear on this page.</p>
        </section>
      </section>
    </main>
  );
};

export default TenantPortalAnnouncements;
