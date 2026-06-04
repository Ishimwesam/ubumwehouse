import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buildingService, contractService, dashboardService, paymentService, resolveUploadUrl, tenantService, unitService } from '../services/api';
import { useDataSync } from '../context/DataSyncContext';

const fallbackBuildingImages = ['/candidate1.jpg', '/candidate2.jpg', '/sasa.jpg', '/dashboard-wallpaper.jpg'];

const formatCurrency = (value) => `${parseFloat(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;

const formatDate = (date) => new Date(date).toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric'
});

const formatShortDate = (date) => new Date(date).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});

const formatPaymentMethod = (method) => {
  if (!method) return 'Cash';
  return method.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const getInitials = (text = '') => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
};

const getMonthRemaining = (summary) => Math.max(
  parseFloat(summary?.expectedIncome || 0) - parseFloat(summary?.monthIncome || 0),
  0
);

const getStatValueStyle = (value) => {
  const length = String(value || '').length;
  if (length >= 16) return 'tight';
  if (length >= 12) return 'compact';
  return 'default';
};

const getBuildingImage = (building, index) => {
  if (building?.image_url) return resolveUploadUrl(building.image_url);
  return fallbackBuildingImages[index % fallbackBuildingImages.length];
};

const StatIcon = ({ tone }) => {
  const config = {
    green: { stroke: '#16a34a', fill: '#dcfce7' },
    blue: { stroke: '#2563eb', fill: '#dbeafe' },
    orange: { stroke: '#f97316', fill: '#ffedd5' },
    purple: { stroke: '#7c3aed', fill: '#ede9fe' }
  }[tone];

  const common = {
    width: 26,
    height: 26,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: config.stroke,
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };

  if (tone === 'green') {
    return (
      <svg {...common}>
        <rect x="3" y="7" width="18" height="10" rx="2" />
        <path d="M7 12h10" />
        <path d="M12 9v6" />
      </svg>
    );
  }

  if (tone === 'blue') {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M16 3v4M8 3v4M4 10h16" />
      </svg>
    );
  }

  if (tone === 'orange') {
    return (
      <svg {...common}>
        <path d="M4 7h4l3 5 3-3 6 8" />
        <path d="M14 7h6v6" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M7 18V9" />
      <path d="M12 18V5" />
      <path d="M17 18v-7" />
    </svg>
  );
};

const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f3b78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </svg>
);

const LocationIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#51617f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10Z" />
    <circle cx="12" cy="11" r="2.2" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const Dashboard = () => {
  const { isAuthenticated, loading: authLoading, isManager } = useAuth();
  const navigate = useNavigate();
  const { versions } = useDataSync();
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
  const [summary, setSummary] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canManageOperations = isManager();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    loadDashboard();
  }, [versions.dashboard, versions.payments, versions.tenants, versions.buildings, versions.units, versions.contracts]);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');

    const [summaryRes, buildingsRes, paymentsRes, tenantsRes, contractsRes, unitsRes] = await Promise.allSettled([
      dashboardService.getSummary(),
      buildingService.getAll(),
      paymentService.getAll(),
      tenantService.getAll(),
      contractService.getAll(),
      unitService.getAll()
    ]);

    if (summaryRes.status === 'fulfilled') {
      setSummary(summaryRes.value.data || {});
    }

    if (buildingsRes.status === 'fulfilled') {
      setBuildings(buildingsRes.value.data || []);
    }

    if (paymentsRes.status === 'fulfilled') {
      setRecentPayments(paymentsRes.value.data || []);
    }
    if (tenantsRes.status === 'fulfilled') {
      setTenants(tenantsRes.value.data || []);
    }
    if (contractsRes.status === 'fulfilled') {
      setContracts(contractsRes.value.data || []);
    }
    if (unitsRes.status === 'fulfilled') {
      setUnits(unitsRes.value.data || []);
    }

    if ([summaryRes, buildingsRes, paymentsRes, tenantsRes, contractsRes, unitsRes].some((result) => result.status === 'rejected')) {
      setError('Some dashboard data could not be loaded. Please ensure the backend server is running and reachable.');
    }

    setLoading(false);
  };

  const openDashboardPath = (path, fallback = '/payments') => {
    navigate(canManageOperations ? path : fallback);
  };

  const stats = [
    {
      label: "Today's Income",
      value: formatCurrency(summary?.todayIncome || 0),
      subtitle: 'Collected today',
      tone: 'green',
      borderColor: '#d9f5dd',
      iconBackground: '#daf4de',
      valueColor: '#16a34a',
      path: canManageOperations ? '/daily-income' : '/payments'
    },
    {
      label: 'This Month',
      value: formatCurrency(summary?.monthIncome || 0),
      subtitle: 'Collected this month only',
      tone: 'blue',
      borderColor: '#dbe7ff',
      iconBackground: '#e0ebff',
      valueColor: '#2563eb',
      path: canManageOperations ? '/reports' : '/payments'
    },
    {
      label: 'Month Remaining',
      value: formatCurrency(getMonthRemaining(summary)),
      subtitle: 'Expected minus this month collected',
      tone: 'orange',
      borderColor: '#f9e3cf',
      iconBackground: '#fff0dd',
      valueColor: '#f97316',
      path: canManageOperations ? '/reports' : '/payments'
    },
    {
      label: 'Monthly Expected',
      value: formatCurrency(summary?.expectedIncome || 0),
      subtitle: 'Total monthly rent across all houses',
      tone: 'purple',
      borderColor: '#eadfff',
      iconBackground: '#f0e8ff',
      valueColor: '#7c3aed',
      path: canManageOperations ? '/buildings?focus=expected' : '/monthly-rent-sheet'
    },
    {
      label: 'Active Tenants',
      value: `${summary?.totalTenants || 0}`,
      subtitle: 'Currently registered active tenants',
      tone: 'green',
      borderColor: '#d9f5dd',
      iconBackground: '#daf4de',
      valueColor: '#15803d',
      path: canManageOperations ? '/tenants' : '/monthly-rent-sheet'
    }
  ];

  const visibleBuildings = buildings.slice(0, 4);
  const visiblePayments = recentPayments
    .filter((payment) => (payment.payment_status || 'confirmed') === 'confirmed')
    .slice(0, 5);
  const pendingPayments = recentPayments.filter((payment) => payment.payment_status === 'pending');
  const unpaidTenants = tenants.filter((tenant) => parseFloat(tenant.balance || 0) > 0);
  const vacantUnits = units.filter((unit) => unit.status === 'available');
  const expiringContracts = contracts.filter((contract) => {
    if (contract.lifecycle_status && contract.lifecycle_status !== 'active') return false;
    const end = new Date(contract.contract_end);
    if (Number.isNaN(end.getTime())) return false;
    const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 30;
  });
  const actionItems = [
    { label: 'Unpaid Tenants', value: unpaidTenants.length, hint: 'Open balances needing collection', path: '/monthly-rent-sheet', tone: '#dc2626' },
    { label: 'Pending Receipts', value: pendingPayments.length, hint: 'Approve or reject uploaded proof', path: '/manual-confirmation', tone: '#d97706' },
    { label: 'Contracts Ending', value: expiringContracts.length, hint: 'Renew or follow up before expiry', path: '/contracts', tone: '#7c3aed' },
    { label: 'Vacant Units', value: vacantUnits.length, hint: 'Available rooms to assign', path: '/units', tone: '#0f766e' }
  ];
  const isTablet = viewportWidth < 1180;
  const isMobile = viewportWidth < 768;
  const isSmallPhone = viewportWidth < 520;

  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div style={{ ...styles.page, padding: isMobile ? '0 0 18px' : styles.page.padding }}>
      <div style={{ ...styles.pageHeader, alignItems: isMobile ? 'stretch' : styles.pageHeader.alignItems }}>
        <div>
          <h1 style={{ ...styles.pageTitle, fontSize: isMobile ? '26px' : styles.pageTitle.fontSize }}>Dashboard</h1>
          <p style={{ ...styles.pageSubtitle, fontSize: isMobile ? '14px' : styles.pageSubtitle.fontSize }}>Welcome back — here&apos;s your property overview</p>
        </div>

        <div style={{ ...styles.dateBadge, width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'center' : 'flex-start', padding: isMobile ? '12px 14px' : styles.dateBadge.padding }}>
          <CalendarIcon />
          <span>{formatDate(new Date())}</span>
        </div>
      </div>

      {error ? <div style={styles.errorBanner}>{error}</div> : null}

      <div style={{
        ...styles.statGrid,
        gridTemplateColumns: isSmallPhone
          ? '1fr'
          : isTablet
            ? 'repeat(2, minmax(0, 1fr))'
            : 'repeat(auto-fit, minmax(190px, 1fr))'
      }}>
        {stats.map((card) => (
          <button
            key={card.label}
            type="button"
            className="dashboard-stat-card"
            style={{
              ...styles.statCard,
              borderColor: card.borderColor,
              minHeight: isMobile ? '170px' : styles.statCard.minHeight,
              padding: isMobile ? '18px 16px' : styles.statCard.padding
            }}
            onClick={() => openDashboardPath(card.path)}
          >
            <div style={styles.statHeader}>
              <div style={{ ...styles.statIconWrap, background: card.iconBackground, width: isMobile ? 48 : styles.statIconWrap.width, height: isMobile ? 48 : styles.statIconWrap.height }}>
                <StatIcon tone={card.tone} />
              </div>
              <div style={{ ...styles.statLabel, fontSize: isMobile ? '14px' : styles.statLabel.fontSize }}>{card.label}</div>
            </div>
            <div style={styles.statBody}>
              <div
                style={{
                  ...styles.statValue,
                  ...(getStatValueStyle(card.value) === 'compact' ? styles.statValueCompact : {}),
                  ...(getStatValueStyle(card.value) === 'tight' ? styles.statValueTight : {}),
                  color: card.valueColor,
                  fontSize: isMobile && getStatValueStyle(card.value) === 'default' ? '1.2rem' : undefined
                }}
              >
                {card.value}
              </div>
              <div style={{ ...styles.statSubtitle, fontSize: isMobile ? '12px' : styles.statSubtitle.fontSize }}>{card.subtitle}</div>
              <div className="dashboard-stat-details" style={{ ...styles.statLink, fontSize: isMobile ? '12px' : styles.statLink.fontSize }}>
                <span className="dashboard-stat-details-label">Click to view details</span>
                <span className="dashboard-stat-details-icon"><ArrowIcon /></span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <section style={styles.actionCenter}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Action Center</h2>
            <p style={styles.panelSubtitle}>Urgent work that needs attention today.</p>
          </div>
          <button type="button" style={styles.viewAllLink} onClick={() => navigate('/calendar-events')}>
            <span>Events</span>
            <ArrowIcon />
          </button>
        </div>
        <div style={{ ...styles.actionGrid, gridTemplateColumns: isSmallPhone ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {actionItems.map((item) => (
            <button key={item.label} type="button" style={styles.actionCard} onClick={() => openDashboardPath(item.path)}>
              <span style={{ ...styles.actionCount, color: item.tone }}>{item.value}</span>
              <span style={styles.actionLabel}>{item.label}</span>
              <span style={styles.actionHint}>{item.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <div style={{ ...styles.lowerGrid, gridTemplateColumns: isTablet || !canManageOperations ? '1fr' : styles.lowerGrid.gridTemplateColumns }}>
        {canManageOperations ? (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Buildings</h2>
              <p style={styles.panelSubtitle}>{buildings.length} registered properties</p>
            </div>
            <button type="button" style={styles.viewAllLink} onClick={() => openDashboardPath('/buildings')}>
              <span>View All</span>
              <ArrowIcon />
            </button>
          </div>

          {visibleBuildings.length > 0 ? (
            <div style={{ ...styles.buildingGrid, gridTemplateColumns: isMobile ? '1fr' : styles.buildingGrid.gridTemplateColumns }}>
              {visibleBuildings.map((building, index) => (
                <article key={building.id} style={styles.buildingCard}>
                  <img src={getBuildingImage(building, index)} alt={building.name} style={styles.buildingImage} />
                  <div style={styles.buildingBody}>
                    <div style={styles.buildingName}>{building.name}</div>
                    <div style={styles.buildingLocationRow}>
                      <LocationIcon />
                      <span>
                        {(building.city || 'Kigali').toUpperCase()} • {(building.address || 'Kimisagara').toUpperCase()}
                      </span>
                    </div>
                    <button type="button" style={styles.buildingButton} onClick={() => openDashboardPath(`/buildings/${building.id}`)}>
                      <span>View Details</span>
                      <ArrowIcon />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div style={styles.emptyState}>No buildings added yet.</div>
          )}
        </section>
        ) : null}

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Recent Payments</h2>
              <p style={styles.panelSubtitle}>10 latest transactions</p>
            </div>
            <button type="button" style={styles.viewAllLink} onClick={() => navigate('/payments')}>
              <span>View All</span>
              <ArrowIcon />
            </button>
          </div>

          {visiblePayments.length > 0 ? (
            <div style={styles.paymentList}>
              {visiblePayments.map((payment, index) => {
                const avatarPalette = paymentAvatarPalettes[index % paymentAvatarPalettes.length];

                return (
                  <article
                    key={payment.id}
                    style={{
                      ...styles.paymentRow,
                      gridTemplateColumns: isMobile
                        ? '44px minmax(0, 1fr)'
                        : isTablet
                          ? '44px minmax(0, 1fr) auto'
                          : styles.paymentRow.gridTemplateColumns,
                      rowGap: isMobile ? '10px' : styles.paymentRow.rowGap
                    }}
                  >
                    <div style={{ ...styles.paymentAvatar, background: avatarPalette.bg, color: avatarPalette.text }}>
                      {getInitials(payment.tenant_name || payment.full_name || 'Tenant')}
                    </div>

                    <div style={styles.paymentPrimary}>
                      <div style={styles.paymentName}>{payment.tenant_name || payment.full_name || 'Tenant'}</div>
                      <div style={styles.paymentBuilding}>{payment.building_name || payment.unit_number || 'UBUMWE HOUSE LTD'}</div>
                    </div>

                    <div
                      style={{
                        ...styles.paymentMeta,
                        ...(isMobile ? { gridColumn: '2 / -1' } : {}),
                        ...(isTablet ? { alignItems: 'flex-start' } : {})
                      }}
                    >
                      <div style={styles.paymentDate}>{formatShortDate(payment.payment_date)}</div>
                      <div style={styles.methodBadge}>{formatPaymentMethod(payment.payment_method)}</div>
                    </div>

                    <div
                      style={{
                        ...styles.paymentAmountColumn,
                        ...(isMobile ? { gridColumn: '2 / -1', alignItems: 'flex-start' } : {}),
                        ...(isTablet ? { alignItems: isMobile ? 'flex-start' : 'flex-end' } : {})
                      }}
                    >
                      <div style={styles.paymentAmount}>{formatCurrency(payment.amount || 0)}</div>
                      <div style={styles.statusBadge}>Paid</div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div style={styles.emptyState}>No recent payments recorded.</div>
          )}

          <button type="button" style={styles.viewAllPaymentsLink} onClick={() => navigate('/payments')}>
            <span>View all payments</span>
            <ArrowIcon />
          </button>
        </section>
      </div>
    </div>
  );
};

const paymentAvatarPalettes = [
  { bg: '#dff5dd', text: '#2a7c3b' },
  { bg: '#dfe9ff', text: '#2555b7' },
  { bg: '#f0e5ff', text: '#7a41d2' },
  { bg: '#ffeacc', text: '#d97706' },
  { bg: '#dff6fb', text: '#0f8ba8' }
];

const styles = {
  page: {
    background: '#f6f8fc',
    minHeight: '100%',
    padding: '8px 4px 20px'
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '20px',
    marginBottom: '28px',
    flexWrap: 'wrap',
    padding: '22px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, #0f172a 0%, #155e75 56%, #0f766e 100%)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    boxShadow: '0 22px 46px rgba(15, 23, 42, 0.18)'
  },
  pageTitle: {
    margin: 0,
    color: '#ffffff',
    fontSize: '31px',
    lineHeight: 1.15,
    fontWeight: 900,
    letterSpacing: '-0.03em',
    textShadow: '0 2px 10px rgba(15, 23, 42, 0.28)'
  },
  pageSubtitle: {
    margin: '8px 0 0',
    color: '#dbeafe',
    fontSize: '15px',
    lineHeight: 1.45,
    fontWeight: 600
  },
  dateBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    minHeight: '52px',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.12)',
    border: '1px solid rgba(255, 255, 255, 0.28)',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 500,
    boxShadow: '0 12px 24px rgba(15, 23, 42, 0.16)',
    backdropFilter: 'blur(10px)'
  },
  errorBanner: {
    marginBottom: '18px',
    padding: '14px 16px',
    borderRadius: '12px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    fontSize: '14px',
    fontWeight: 600
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: '16px',
    marginBottom: '26px'
  },
  statCard: {
    appearance: 'none',
    border: '1px solid',
    background: '#ffffff',
    borderRadius: '16px',
    padding: '20px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    textAlign: 'left',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(39, 64, 110, 0.04)',
    minHeight: '188px'
  },
  statHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0
  },
  statIconWrap: {
    width: '54px',
    height: '54px',
    borderRadius: '999px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  statBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minWidth: 0
  },
  statLabel: {
    color: '#44577d',
    fontSize: 'clamp(0.9rem, 0.92vw, 1rem)',
    fontWeight: 500,
    lineHeight: 1.35,
    letterSpacing: '-0.01em'
  },
  statValue: {
    fontSize: 'clamp(1.2rem, 1.25vw, 1.7rem)',
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: '-0.03em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  statValueCompact: {
    fontSize: 'clamp(1.05rem, 1.08vw, 1.45rem)',
    lineHeight: 1.18
  },
  statValueTight: {
    fontSize: 'clamp(0.96rem, 0.94vw, 1.24rem)',
    lineHeight: 1.15
  },
  statSubtitle: {
    color: '#4f6489',
    fontSize: '13px',
    lineHeight: 1.5,
    minHeight: '38px',
    maxWidth: '100%'
  },
  statLink: {
    marginTop: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#2563eb',
    fontSize: '13px',
    fontWeight: 500,
    lineHeight: 1.35
  },
  lowerGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
    gap: '20px',
    alignItems: 'start'
  },
  actionCenter: {
    background: '#ffffff',
    border: '1px solid #dde5f2',
    borderRadius: '18px',
    padding: '18px',
    boxShadow: '0 18px 40px rgba(37, 71, 127, 0.05)',
    marginBottom: '24px'
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px'
  },
  actionCard: {
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    borderRadius: '12px',
    padding: '14px',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.28rem',
    minHeight: '118px'
  },
  actionCount: {
    fontSize: '1.7rem',
    fontWeight: 900,
    lineHeight: 1
  },
  actionLabel: {
    color: '#0f172a',
    fontWeight: 900,
    fontSize: '0.96rem'
  },
  actionHint: {
    color: '#64748b',
    fontSize: '0.82rem',
    lineHeight: 1.45
  },
  panel: {
    background: '#ffffff',
    border: '1px solid #dde5f2',
    borderRadius: '18px',
    padding: '18px',
    boxShadow: '0 18px 40px rgba(37, 71, 127, 0.05)'
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    marginBottom: '18px'
  },
  panelTitle: {
    margin: 0,
    color: '#172554',
    fontSize: '18px',
    fontWeight: 800
  },
  panelSubtitle: {
    margin: '4px 0 0',
    color: '#5a6d91',
    fontSize: '14px'
  },
  viewAllLink: {
    border: 'none',
    background: 'transparent',
    color: '#2563eb',
    fontSize: '14px',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    padding: 0
  },
  buildingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '14px'
  },
  buildingCard: {
    borderRadius: '15px',
    overflow: 'hidden',
    border: '1px solid #e2e8f3',
    background: '#fff'
  },
  buildingImage: {
    width: '100%',
    height: '124px',
    objectFit: 'cover',
    display: 'block',
    background: '#e6edf8'
  },
  buildingBody: {
    padding: '12px 14px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  buildingName: {
    color: '#172554',
    fontSize: '15px',
    fontWeight: 800,
    lineHeight: 1.25
  },
  buildingLocationRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: '#51617f',
    fontSize: '12px',
    fontWeight: 500,
    lineHeight: 1.4
  },
  buildingButton: {
    width: 'fit-content',
    minHeight: '34px',
    padding: '0 14px',
    borderRadius: '8px',
    border: '1px solid #cfe0ff',
    background: '#ffffff',
    color: '#2563eb',
    fontSize: '13px',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer'
  },
  paymentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0px',
    border: '1px solid #e0e8f5',
    borderRadius: '16px',
    overflow: 'hidden',
    background: '#fff'
  },
  paymentRow: {
    display: 'grid',
    gridTemplateColumns: '52px minmax(0, 1.4fr) minmax(0, 1fr) auto',
    gap: '16px',
    alignItems: 'center',
    padding: '16px 14px',
    borderBottom: '1px solid #e9eef7',
    rowGap: '16px'
  },
  paymentAvatar: {
    width: '44px',
    height: '44px',
    borderRadius: '999px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    fontWeight: 700
  },
  paymentPrimary: {
    minWidth: 0
  },
  paymentName: {
    color: '#172554',
    fontSize: '15px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  paymentBuilding: {
    marginTop: '4px',
    color: '#526581',
    fontSize: '13px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  paymentMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'flex-start'
  },
  paymentDate: {
    color: '#526581',
    fontSize: '14px',
    fontWeight: 500
  },
  methodBadge: {
    minHeight: '24px',
    padding: '0 10px',
    borderRadius: '7px',
    border: '1px solid #d8e2f1',
    background: '#ffffff',
    color: '#526581',
    fontSize: '12px',
    display: 'inline-flex',
    alignItems: 'center'
  },
  paymentAmountColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px'
  },
  paymentAmount: {
    color: '#16a34a',
    fontSize: '16px',
    fontWeight: 700,
    whiteSpace: 'nowrap'
  },
  statusBadge: {
    minHeight: '24px',
    padding: '0 11px',
    borderRadius: '8px',
    background: '#e7f8eb',
    color: '#16a34a',
    fontSize: '12px',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center'
  },
  viewAllPaymentsLink: {
    marginTop: '18px',
    border: 'none',
    background: 'transparent',
    color: '#2563eb',
    fontSize: '14px',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    padding: 0
  },
  emptyState: {
    minHeight: '180px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
    fontSize: '14px',
    border: '1px dashed #d7e1ef',
    borderRadius: '14px',
    background: '#fafcff'
  },
  loadingWrap: {
    minHeight: '60vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px'
  },
  spinner: {
    width: '38px',
    height: '38px',
    borderRadius: '999px',
    border: '4px solid #dbe6f5',
    borderTopColor: '#2563eb',
    animation: 'spin 0.9s linear infinite'
  },
  loadingText: {
    margin: 0,
    color: '#51617f',
    fontSize: '14px',
    fontWeight: 500
  }
};

export default Dashboard;
