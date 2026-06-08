import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/tenant-portal.css';

const TenantPortalMaintenance = () => {
  const navigate = useNavigate();

  return (
    <main className="tp-page tp-subpage">
      <section className="tp-main tp-subpage-main">
        <header className="tp-header">
          <div>
            <h1>Maintenance Requests</h1>
            <p>UBUMWE HOUSE LTD maintenance support and request tracking.</p>
          </div>
          <button className="tp-btn-secondary" type="button" onClick={() => navigate('/tenant-portal')}>
            Back To Dashboard
          </button>
        </header>

        <section className="tp-card" style={{ marginTop: 14 }}>
          <h2>Request Maintenance</h2>
          <div className="tp-maintenance-state">
            <strong>No open requests</strong>
            <p>Your maintenance workflow page is ready. Submit requests here as soon as request API is enabled.</p>
            <button type="button" className="tp-btn-primary">Create New Request</button>
          </div>
        </section>
      </section>
    </main>
  );
};

export default TenantPortalMaintenance;
