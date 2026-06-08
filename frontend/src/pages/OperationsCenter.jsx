import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildingService, contractService, paymentService, tenantService, unitService } from '../services/api';
import { useDataSync } from '../context/DataSyncContext';
import PageLoader from '../components/PageLoader';

const getDaysUntil = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

const OperationsCenter = () => {
  const navigate = useNavigate();
  const { versions } = useDataSync();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ tenants: [], payments: [], contracts: [], units: [], buildings: [] });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');

      const results = await Promise.allSettled([
        tenantService.getAll(),
        paymentService.getAll(),
        contractService.getAll(),
        unitService.getAll(),
        buildingService.getAll()
      ]);

      if (!mounted) return;

      const [tenants, payments, contracts, units, buildings] = results;
      setData({
        tenants: tenants.status === 'fulfilled' ? tenants.value.data || [] : [],
        payments: payments.status === 'fulfilled' ? payments.value.data || [] : [],
        contracts: contracts.status === 'fulfilled' ? contracts.value.data || [] : [],
        units: units.status === 'fulfilled' ? units.value.data || [] : [],
        buildings: buildings.status === 'fulfilled' ? buildings.value.data || [] : []
      });

      if (results.some((result) => result.status === 'rejected')) {
        setError('Some operation data could not be loaded. Use System Health if this continues.');
      }

      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [versions.tenants, versions.payments, versions.contracts, versions.units, versions.buildings]);

  const items = useMemo(() => {
    const unpaidTenants = data.tenants.filter((tenant) => Number(tenant.balance || 0) > 0);
    const pendingPayments = data.payments.filter((payment) => payment.payment_status === 'pending');
    const vacantUnits = data.units.filter((unit) => unit.status === 'available');
    const expiringContracts = data.contracts
      .map((contract) => ({ ...contract, daysUntil: getDaysUntil(contract.contract_end) }))
      .filter((contract) => (contract.lifecycle_status || 'active') === 'active' && contract.daysUntil !== null && contract.daysUntil >= 0 && contract.daysUntil <= 30);

    return [
      {
        title: 'Unpaid Tenants',
        count: unpaidTenants.length,
        text: 'Open balances that need collection or follow-up.',
        tone: '#dc2626',
        action: 'Open rent sheet',
        path: '/monthly-rent-sheet'
      },
      {
        title: 'Pending Receipts',
        count: pendingPayments.length,
        text: 'Uploaded proof waiting for approval or rejection.',
        tone: '#d97706',
        action: 'Review queue',
        path: '/manual-confirmation'
      },
      {
        title: 'Contracts Ending',
        count: expiringContracts.length,
        text: 'Contracts ending within the next 30 days.',
        tone: '#7c3aed',
        action: 'Open contracts',
        path: '/contracts'
      },
      {
        title: 'Vacant Units',
        count: vacantUnits.length,
        text: 'Available rooms that can be assigned to tenants.',
        tone: '#0f766e',
        action: 'Open units',
        path: '/units'
      }
    ];
  }, [data]);

  if (loading) return <PageLoader text="Loading operations center..." />;

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Operations Center</div>
          <h1 style={styles.title}>Needs attention queue</h1>
          <p style={styles.subtitle}>A single place for urgent collection, receipt, contract, occupancy, reminder, and recovery work.</p>
        </div>
        <button type="button" style={styles.secondaryButton} onClick={() => navigate('/system-health')}>
          System Health
        </button>
      </section>

      {error ? <div style={styles.alert}>{error}</div> : null}

      <section style={styles.grid}>
        {items.map((item) => (
          <article key={item.title} style={styles.card}>
            <div style={styles.cardTop}>
              <span style={{ ...styles.count, color: item.tone }}>{item.count}</span>
              <h2 style={styles.cardTitle}>{item.title}</h2>
            </div>
            <p style={styles.cardText}>{item.text}</p>
            <button type="button" style={styles.primaryButton} onClick={() => navigate(item.path)}>
              {item.action}
            </button>
          </article>
        ))}
      </section>

      <section style={styles.workflowGrid}>
        <article style={styles.panel}>
          <h2 style={styles.panelTitle}>Smart Reminders</h2>
          <p style={styles.panelText}>Use live rent reminders, calendar follow-ups, and WhatsApp readiness from one workflow.</p>
          <div style={styles.actions}>
            <button type="button" style={styles.secondaryButton} onClick={() => navigate('/tenants/reminders')}>Rent reminders</button>
            <button type="button" style={styles.secondaryButton} onClick={() => navigate('/calendar-events')}>Calendar</button>
            <button type="button" style={styles.secondaryButton} onClick={() => navigate('/system-health')}>Messaging status</button>
          </div>
        </article>

        <article style={styles.panel}>
          <h2 style={styles.panelTitle}>Audit And Exports</h2>
          <p style={styles.panelText}>Review tracked actions in Settings and download reports from the export center.</p>
          <div style={styles.actions}>
            <button type="button" style={styles.secondaryButton} onClick={() => navigate('/settings')}>Audit logs</button>
            <button type="button" style={styles.secondaryButton} onClick={() => navigate('/export-center')}>Export center</button>
          </div>
        </article>
      </section>
    </main>
  );
};

const styles = {
  page: {
    minHeight: '100%',
    padding: '8px 4px 24px',
    background: '#f6f8fc'
  },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '18px',
    flexWrap: 'wrap',
    padding: '22px',
    borderRadius: '16px',
    background: '#ffffff',
    border: '1px solid #dbe4f0',
    boxShadow: '0 18px 42px rgba(15, 23, 42, 0.08)',
    marginBottom: '18px'
  },
  eyebrow: {
    color: '#2563eb',
    fontSize: '12px',
    fontWeight: 900,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '8px'
  },
  title: {
    margin: 0,
    color: '#0f172a',
    fontSize: 'clamp(1.55rem, 4vw, 2.35rem)',
    lineHeight: 1.12
  },
  subtitle: {
    margin: '10px 0 0',
    color: '#475569',
    maxWidth: '720px',
    lineHeight: 1.55
  },
  alert: {
    marginBottom: '18px',
    padding: '13px 15px',
    borderRadius: '12px',
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    color: '#9a3412',
    fontWeight: 700
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
    marginBottom: '18px'
  },
  card: {
    border: '1px solid #dbe4f0',
    borderRadius: '14px',
    background: '#ffffff',
    padding: '18px',
    boxShadow: '0 14px 32px rgba(15, 23, 42, 0.06)'
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '10px'
  },
  count: {
    fontSize: '2rem',
    fontWeight: 900,
    lineHeight: 1
  },
  cardTitle: {
    margin: 0,
    color: '#172554',
    fontSize: '17px'
  },
  cardText: {
    margin: '0 0 15px',
    color: '#64748b',
    lineHeight: 1.5,
    fontSize: '14px'
  },
  workflowGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px'
  },
  panel: {
    border: '1px solid #dbe4f0',
    borderRadius: '14px',
    background: '#ffffff',
    padding: '18px',
    boxShadow: '0 14px 32px rgba(15, 23, 42, 0.06)'
  },
  panelTitle: {
    margin: '0 0 8px',
    color: '#172554',
    fontSize: '18px'
  },
  panelText: {
    margin: '0 0 14px',
    color: '#64748b',
    lineHeight: 1.5
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  primaryButton: {
    minHeight: '40px',
    border: 'none',
    borderRadius: '9px',
    background: '#2563eb',
    color: '#ffffff',
    padding: '0 14px',
    fontWeight: 800,
    cursor: 'pointer'
  },
  secondaryButton: {
    minHeight: '40px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    background: '#ffffff',
    color: '#1e293b',
    padding: '0 14px',
    fontWeight: 800,
    cursor: 'pointer'
  }
};

export default OperationsCenter;
