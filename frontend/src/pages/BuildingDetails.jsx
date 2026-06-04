import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buildingService, tenantService, paymentService } from '../services/api';
import { FLOOR_OPTIONS, parseBuildingFloors } from '../utils/floorOptions';
import useFeedbackToast from '../hooks/useFeedbackToast';

const formatCurrency = (value) => `${parseFloat(value || 0).toLocaleString()} RWF`;

const inferFloorFromUnit = (unit = '') => {
  const normalized = String(unit || '').trim().toUpperCase();
  if (normalized.startsWith('BF')) return 'BASEMENT 1';
  if (normalized.startsWith('GF')) return 'GROUND FLOOR';

  const numberMatch = normalized.match(/^(\d+)\s*F/);
  if (numberMatch) {
    const floorNumber = parseInt(numberMatch[1], 10);
    if (floorNumber === 1) return '1ST FLOOR';
    if (floorNumber === 2) return '2ND FLOOR';
    if (floorNumber === 3) return '3RD FLOOR';
    return `${floorNumber}TH FLOOR`;
  }

  return 'UNASSIGNED FLOOR';
};

const getFloorRank = (floor, availableFloors = []) => {
  const normalized = String(floor || '').trim().toUpperCase();
  const configuredFloors = availableFloors.map((entry) => String(entry || '').trim().toUpperCase());
  const configuredIndex = configuredFloors.indexOf(normalized);

  if (configuredIndex >= 0) return configuredIndex;

  const defaultIndex = FLOOR_OPTIONS.indexOf(normalized);
  if (defaultIndex >= 0) return defaultIndex;

  if (normalized.startsWith('BASEMENT')) {
    const level = parseInt(normalized.replace(/[^\d-]/g, ''), 10);
    if (!Number.isNaN(level)) return 100 + level;
  }

  if (normalized.endsWith('FLOOR')) {
    const level = parseInt(normalized.replace(/[^\d]/g, ''), 10);
    if (!Number.isNaN(level)) return 200 + level;
  }

  return 1000;
};

const getTenantStatusStyle = (status) => ({
  ...styles.badge,
  ...(status === 'active' ? styles.badgeSuccess : styles.badgeNeutral)
});

const getCollectionStatusStyle = (status) => ({
  ...styles.badge,
  ...(status === 'Up to date' ? styles.badgeSuccess : styles.badgeWarning)
});

const getMethodStyle = (method) => ({
  ...styles.badge,
  ...(method && method !== '-' ? styles.badgeInfo : styles.badgeNeutral)
});

const getCurrentPeriod = () => new Date().toISOString().slice(0, 7);

const BuildingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isManager } = useAuth();
  const [building, setBuilding] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const canManageOperations = isManager();
  useFeedbackToast(error, 'error');

  useEffect(() => {
    fetchBuildingDetails();
  }, [id]);

  const fetchBuildingDetails = async () => {
    setLoading(true);
    setError('');

    try {
      const [buildingRes, tenantsRes, paymentsRes] = await Promise.all([
        buildingService.getById(id),
        tenantService.getByBuilding(id),
        paymentService.getByBuilding(id)
      ]);

      setBuilding(buildingRes.data);
      setTenants(tenantsRes.data);
      setPayments(paymentsRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load building details');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!canManageOperations) {
      setError('You have view-only access on this page.');
      return;
    }

    setExporting(true);
    setError('');

    try {
      const response = await paymentService.exportByBuilding(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${building?.name || 'building'}-payment-history.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      setError('Failed to export payment history');
    } finally {
      setExporting(false);
    }
  };

  const houseCollectionRows = tenants.map((tenant) => {
    const monthlyExpected = parseFloat(tenant.monthly_rent || 0);
    const remaining = parseFloat(tenant.balance || 0);
    const floor = tenant.floor || inferFloorFromUnit(tenant.unit_number);

    return {
      id: tenant.id,
      unitId: tenant.unit_id,
      unit: tenant.unit_number || '-',
      floor,
      tenantName: tenant.full_name || '-',
      phone: tenant.phone || '-',
      tenantStatus: tenant.status || '-',
      monthlyExpected,
      remaining,
      collectionStatus: remaining <= 0 ? 'Up to date' : 'Pending balance'
    };
  });

  const availableFloors = parseBuildingFloors(building?.available_floors);
  const orderedHouseCollectionRows = [...houseCollectionRows].sort((left, right) => {
    const floorDiff = getFloorRank(left.floor, availableFloors) - getFloorRank(right.floor, availableFloors);
    if (floorDiff !== 0) return floorDiff;
    return String(left.unit || '').localeCompare(String(right.unit || ''), undefined, { numeric: true, sensitivity: 'base' });
  });

  const houseCollectionSections = orderedHouseCollectionRows.reduce((sections, row) => {
    const lastSection = sections[sections.length - 1];
    if (!lastSection || lastSection.floor !== row.floor) {
      sections.push({ floor: row.floor, rows: [row] });
      return sections;
    }

    lastSection.rows.push(row);
    return sections;
  }, []);

  const totalMonthlyExpected = houseCollectionRows.reduce((sum, row) => sum + row.monthlyExpected, 0);
  const totalRemaining = houseCollectionRows.reduce((sum, row) => sum + Math.max(row.remaining, 0), 0);

  const handleAddTenantToBuilding = () => {
    navigate('/tenants', {
      state: {
        addTenantForBuilding: {
          buildingId: id,
          buildingName: building?.name
        }
      }
    });
  };

  const handleRecordPayment = (row) => {
    navigate('/payments', {
      state: {
        recordPaymentFor: {
          tenantId: row.id,
          unitId: row.unitId,
          amount: row.remaining > 0 ? row.remaining : row.monthlyExpected,
          period: getCurrentPeriod(),
          notes: `Rent payment for ${building?.name || 'building'} - ${row.unit}`
        }
      }
    });
  };

  if (loading) {
    return <div style={styles.loading}>Loading building details...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <button type="button" style={styles.linkButton} onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </button>
          <h1 style={styles.title}>Building Details</h1>
          <p style={styles.subtitle}>{building?.name}</p>
        </div>
        <div style={styles.headerActions}>
          <button
            type="button"
            style={{ ...styles.btnAddTenant, ...(!canManageOperations ? styles.btnDisabled : {}) }}
            onClick={handleAddTenantToBuilding}
            disabled={!canManageOperations}
          >
            Add Tenant
          </button>
          <button
            type="button"
            style={{ ...styles.btnPrimary, ...(!canManageOperations ? styles.btnDisabled : {}) }}
            onClick={handleExport}
            disabled={exporting || !canManageOperations}
          >
            {exporting ? 'Exporting...' : 'Export Payment History'}
          </button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {!canManageOperations ? (
        <div style={styles.readOnlyBanner}>
          You have view-only access here. Building collection details remain visible, but exporting is limited to managers and admins.
        </div>
      ) : null}

      <div style={styles.infoCard}>
        <div style={styles.infoGroup}>
          <span style={styles.infoLabel}>Address</span>
          <span style={styles.infoValue}>{building?.address || '-'}</span>
        </div>
        <div style={styles.infoGroup}>
          <span style={styles.infoLabel}>City</span>
          <span style={styles.infoValue}>{building?.city || '-'}</span>
        </div>
        <div style={styles.infoGroup}>
          <span style={styles.infoLabel}>Country</span>
          <span style={styles.infoValue}>{building?.country || '-'}</span>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>House Collection Summary</h2>
        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Total Monthly Amount to Collect</div>
            <div style={styles.summaryValue}>{formatCurrency(totalMonthlyExpected)}</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Total Remaining Balance</div>
            <div style={{ ...styles.summaryValue, color: totalRemaining > 0 ? '#b91c1c' : '#047857' }}>
              {formatCurrency(totalRemaining)}
            </div>
          </div>
        </div>

        {houseCollectionRows.length > 0 ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, ...styles.stickyUnitHead }}>Unit</th>
                  <th style={{ ...styles.th, ...styles.stickyTenantHead }}>Tenant</th>
                  <th style={styles.th}>Phone</th>
                  <th style={styles.th}>Monthly to Collect</th>
                  <th style={styles.th}>Remaining</th>
                  <th style={styles.th}>Tenant Status</th>
                  <th style={styles.th}>Sheet Status</th>
                  <th style={{ ...styles.th, ...styles.stickyActionHead }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {houseCollectionSections.map((section) => (
                  <React.Fragment key={section.floor}>
                    <tr>
                      <td colSpan={8} style={styles.floorHeaderCell}>
                        <span style={styles.floorHeaderBadge}>{section.floor}</span>
                        <span style={styles.floorHeaderMeta}>{section.rows.length} tenant{section.rows.length === 1 ? '' : 's'} on this floor</span>
                      </td>
                    </tr>
                    {section.rows.map((row) => (
                      <tr key={row.id} style={styles.tr}>
                        <td style={{ ...styles.td, ...styles.stickyUnitCell }}>
                          <span style={styles.primaryCell}>{row.unit}</span>
                        </td>
                        <td style={{ ...styles.td, ...styles.stickyTenantCell }}>
                          <div style={styles.cellStack}>
                            <span style={styles.primaryCell}>{row.tenantName}</span>
                            <span style={styles.secondaryCell}>Tenant record</span>
                          </div>
                        </td>
                        <td style={styles.td}>{row.phone}</td>
                        <td style={{ ...styles.td, ...styles.stickyActionCell }}>
                          <span style={styles.amountText}>{formatCurrency(row.monthlyExpected)}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ ...styles.amountText, color: row.remaining > 0 ? '#b91c1c' : '#047857' }}>
                            {formatCurrency(row.remaining)}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={getTenantStatusStyle(row.tenantStatus)}>{row.tenantStatus}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={getCollectionStatusStyle(row.collectionStatus)}>{row.collectionStatus}</span>
                        </td>
                        <td style={styles.td}>
                          <button
                            type="button"
                            style={styles.recordPaymentButton}
                            onClick={() => handleRecordPayment(row)}
                          >
                            Record Payment
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={styles.noData}>No tenants found in this building.</p>
        )}
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Payment History for This Building</h2>
        {payments.length > 0 ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Tenant</th>
                  <th style={styles.th}>Unit</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Period</th>
                  <th style={styles.th}>Method</th>
                  <th style={styles.th}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} style={styles.tr}>
                    <td style={styles.td}>{new Date(payment.payment_date).toLocaleDateString()}</td>
                    <td style={styles.td}>
                      <span style={styles.primaryCell}>{payment.tenant_name}</span>
                    </td>
                    <td style={styles.td}>{payment.unit_number}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.amountText, color: '#047857' }}>{formatCurrency(payment.amount)}</span>
                    </td>
                    <td style={styles.td}>{payment.payment_period}</td>
                    <td style={styles.td}>
                      <span style={getMethodStyle(payment.payment_method || '-')}>{payment.payment_method || '-'}</span>
                    </td>
                    <td style={styles.td}>{payment.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={styles.noData}>No payments recorded for this building.</p>
        )}
      </div>
    </div>
  );
};

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    flexWrap: 'wrap',
    padding: '1.35rem 1.5rem',
    borderRadius: '1rem',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    border: '1px solid #dbe4f0',
    boxShadow: '0 14px 30px rgba(15, 23, 42, 0.06)'
  },
  title: {
    fontSize: '2rem',
    fontWeight: '700',
    margin: 0,
    color: '#0f172a',
    lineHeight: 1.08
  },
  subtitle: {
    marginTop: '0.55rem',
    color: '#475569',
    fontSize: '1.05rem',
    fontWeight: '600'
  },
  linkButton: {
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
    color: '#1d4ed8',
    cursor: 'pointer',
    padding: '0.55rem 0.9rem',
    fontSize: '0.9rem',
    fontWeight: '700',
    borderRadius: '999px',
    marginBottom: '0.95rem'
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    flexWrap: 'wrap'
  },
  btnAddTenant: {
    padding: '0.85rem 1.3rem',
    background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '0.85rem',
    cursor: 'pointer',
    fontWeight: '800',
    boxShadow: '0 14px 24px rgba(15, 118, 110, 0.2)'
  },
  btnPrimary: {
    padding: '0.85rem 1.3rem',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '0.85rem',
    cursor: 'pointer',
    fontWeight: '700',
    boxShadow: '0 14px 24px rgba(37, 99, 235, 0.22)'
  },
  btnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
    boxShadow: 'none'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#7f1d1d',
    padding: '1rem 1.1rem',
    borderRadius: '0.85rem',
    border: '1px solid #fecaca'
  },
  readOnlyBanner: {
    padding: '1rem 1.1rem',
    borderRadius: '0.85rem',
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    color: '#334155',
    fontWeight: 600,
    lineHeight: 1.5
  },
  infoCard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
    padding: '1.5rem',
    borderRadius: '1rem',
    background: 'linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)',
    border: '1px solid #dbe4f0',
    boxShadow: '0 14px 30px rgba(15, 23, 42, 0.05)'
  },
  infoGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    padding: '0.85rem 0.95rem',
    borderRadius: '0.85rem',
    background: '#f8fafc',
    border: '1px solid #e2e8f0'
  },
  infoLabel: {
    fontSize: '0.78rem',
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  infoValue: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: '1rem'
  },
  section: {
    background: '#ffffff',
    padding: '1.5rem',
    borderRadius: '1rem',
    border: '1px solid #dbe4f0',
    boxShadow: '0 14px 30px rgba(15, 23, 42, 0.05)'
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    marginBottom: '1rem',
    color: '#0f172a'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
    marginBottom: '1.15rem'
  },
  summaryCard: {
    border: '1px solid #dbe4f0',
    borderRadius: '0.95rem',
    padding: '1rem 1.05rem',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)'
  },
  summaryLabel: {
    fontSize: '0.78rem',
    color: '#64748b',
    marginBottom: '0.42rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  summaryValue: {
    fontSize: '1.35rem',
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 1.15
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid #e2e8f0',
    borderRadius: '0.95rem',
    background: '#ffffff',
    position: 'relative'
  },
  table: {
    width: '100%',
    minWidth: '880px',
    borderCollapse: 'separate',
    borderSpacing: 0
  },
  th: {
    padding: '0.95rem 0.9rem',
    background: '#f8fafc',
    color: '#475569',
    fontSize: '0.78rem',
    fontWeight: '800',
    textAlign: 'left',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky',
    top: 0,
    zIndex: 4
  },
  stickyUnitHead: {
    left: 0,
    zIndex: 8,
    minWidth: '110px',
    boxShadow: '10px 0 18px rgba(15, 23, 42, 0.10)'
  },
  stickyTenantHead: {
    left: '110px',
    zIndex: 7,
    minWidth: '230px',
    boxShadow: '10px 0 18px rgba(15, 23, 42, 0.08)'
  },
  stickyActionHead: {
    right: 0,
    zIndex: 7,
    minWidth: '150px',
    boxShadow: '-10px 0 18px rgba(15, 23, 42, 0.08)'
  },
  floorHeaderCell: {
    padding: '0.8rem 0.9rem',
    background: 'linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)',
    borderBottom: '1px solid #bfdbfe'
  },
  floorHeaderBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.36rem 0.72rem',
    borderRadius: '999px',
    background: '#1d4ed8',
    color: '#ffffff',
    fontSize: '0.8rem',
    fontWeight: '800',
    letterSpacing: '0.03em'
  },
  floorHeaderMeta: {
    marginLeft: '0.7rem',
    color: '#1e3a8a',
    fontSize: '0.82rem',
    fontWeight: '700'
  },
  tr: {
    backgroundColor: '#ffffff'
  },
  td: {
    padding: '0.95rem 0.9rem',
    borderBottom: '1px solid #eef2f7',
    color: '#0f172a',
    fontSize: '0.93rem',
    verticalAlign: 'middle'
  },
  stickyUnitCell: {
    position: 'sticky',
    left: 0,
    zIndex: 3,
    minWidth: '110px',
    backgroundColor: '#ffffff',
    boxShadow: '10px 0 18px rgba(15, 23, 42, 0.06)'
  },
  stickyTenantCell: {
    position: 'sticky',
    left: '110px',
    zIndex: 3,
    minWidth: '230px',
    backgroundColor: '#ffffff',
    boxShadow: '10px 0 18px rgba(15, 23, 42, 0.04)'
  },
  stickyActionCell: {
    position: 'sticky',
    right: 0,
    zIndex: 3,
    minWidth: '150px',
    backgroundColor: '#ffffff',
    boxShadow: '-10px 0 18px rgba(15, 23, 42, 0.06)'
  },
  cellStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem'
  },
  primaryCell: {
    fontWeight: '700',
    color: '#0f172a'
  },
  secondaryCell: {
    fontSize: '0.8rem',
    color: '#64748b'
  },
  amountText: {
    fontWeight: '700',
    color: '#0f172a'
  },
  recordPaymentButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.5rem 0.78rem',
    borderRadius: '999px',
    border: '1px solid #0f766e',
    background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
    color: '#ffffff',
    fontSize: '0.76rem',
    fontWeight: '900',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: '0 8px 16px rgba(15, 118, 110, 0.16)'
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    padding: '0.32rem 0.68rem',
    fontSize: '0.79rem',
    fontWeight: '700',
    lineHeight: 1.2
  },
  badgeSuccess: {
    background: '#dcfce7',
    color: '#166534'
  },
  badgeWarning: {
    background: '#fef3c7',
    color: '#92400e'
  },
  badgeInfo: {
    background: '#dbeafe',
    color: '#1d4ed8'
  },
  badgeNeutral: {
    background: '#e2e8f0',
    color: '#334155'
  },
  noData: {
    textAlign: 'center',
    color: '#64748b',
    padding: '1.5rem',
    background: '#f8fafc',
    border: '1px dashed #cbd5e1',
    borderRadius: '0.85rem'
  },
  loading: {
    textAlign: 'center',
    padding: '2rem',
    color: '#64748b'
  }
};

export default BuildingDetails;
