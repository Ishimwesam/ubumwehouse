import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { buildingService, dashboardService, paymentService, tenantService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useDataSync } from '../context/DataSyncContext';

const formatCurrency = (value) => `${parseFloat(value || 0).toLocaleString()} RWF`;
const getInitialViewportWidth = () => (typeof window !== 'undefined' ? window.innerWidth : 1200);
const idsEqual = (first, second) => String(first || '') === String(second || '');

const Reports = () => {
  const { isManager } = useAuth();
  const { versions } = useDataSync();
  const [summary, setSummary] = useState(null);
  const [monthlyIncome, setMonthlyIncome] = useState([]);
  const [unpaidTenants, setUnpaidTenants] = useState([]);
  const [buildingPerformance, setBuildingPerformance] = useState([]);
  const [profitTrends, setProfitTrends] = useState({ monthlyTrends: [], delayedTenants: [] });
  const [expectedIncome, setExpectedIncome] = useState(null);
  const [payments, setPayments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [filters, setFilters] = useState({ from: '', to: '', buildingId: '', tenantId: '' });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const [viewportWidth, setViewportWidth] = useState(getInitialViewportWidth);
  const { showToast } = useToast();
  const canManageOperations = isManager();

  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth < 1024;

  useEffect(() => {
    fetchReportData();
  }, [versions.reports, versions.payments, versions.tenants, versions.buildings, versions.units, versions.contracts, versions.dashboard]);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      setError('');
      const [
        summaryRes,
        incomeRes,
        unpaidRes,
        performanceRes,
        trendRes,
        expectedRes,
        paymentsRes,
        tenantsRes,
        buildingsRes
      ] = await Promise.all([
        dashboardService.getSummary(),
        dashboardService.getMonthlyIncome(),
        dashboardService.getUnpaidTenants(),
        dashboardService.getBuildingPerformance(),
        dashboardService.getProfitTrends(),
        dashboardService.getMonthlyExpectedIncome(),
        paymentService.getAll(),
        tenantService.getAll(),
        buildingService.getAll()
      ]);

      setSummary(summaryRes.data);
      setMonthlyIncome(incomeRes.data);
      setUnpaidTenants(unpaidRes.data);
      setBuildingPerformance(performanceRes.data);
      setProfitTrends(trendRes.data);
      setExpectedIncome(expectedRes.data);
      setPayments(paymentsRes.data);
      setTenants(tenantsRes.data);
      setBuildings(buildingsRes.data);
    } catch (err) {
      setError('Failed to load advanced reports');
      showToast('Failed to load advanced reports', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters({ ...filters, [name]: value });
  };

  const clearFilters = () => {
    setFilters({ from: '', to: '', buildingId: '', tenantId: '' });
  };

  const isFilterRangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);
  const reportParams = {
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.buildingId ? { buildingId: filters.buildingId } : {}),
    ...(filters.tenantId ? { tenantId: filters.tenantId } : {})
  };

  const filteredPayments = useMemo(() => (
    payments.filter((payment) => {
      const isConfirmed = payment.payment_status !== 'pending';
      const matchesFrom = !filters.from || payment.payment_date >= filters.from;
      const matchesTo = !filters.to || payment.payment_date <= filters.to;
      const matchesBuilding = !filters.buildingId || idsEqual(payment.building_id, filters.buildingId);
      const matchesTenant = !filters.tenantId || idsEqual(payment.tenant_id, filters.tenantId);
      return !isFilterRangeInvalid && isConfirmed && matchesFrom && matchesTo && matchesBuilding && matchesTenant;
    })
  ), [payments, filters, isFilterRangeInvalid]);

  const tenantHistory = filters.tenantId
    ? payments.filter((payment) => idsEqual(payment.tenant_id, filters.tenantId))
    : [];
  const selectedTenant = tenants.find((tenant) => idsEqual(tenant.id, filters.tenantId));
  const maxMonthlyIncome = Math.max(...monthlyIncome.map((item) => parseFloat(item.total || 0)), 1);
  const maxTrendIncome = Math.max(...(profitTrends.monthlyTrends || []).map((item) => parseFloat(item.income || 0)), 1);
  const totalFilteredIncome = filteredPayments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);

  const exportCsv = async () => {
    if (!canManageOperations) {
      showToast('You have view-only access on this page.', 'info');
      return;
    }

    if (isFilterRangeInvalid) {
      showToast('Fix the date range before exporting.', 'warning');
      return;
    }

    setExporting('csv');
    try {
      const response = await paymentService.generateIncomeReport(reportParams);
      const reportPayments = response.data?.payments || [];
    const rows = [
      ['Tenant', 'Building', 'Unit', 'Date', 'Period', 'Amount', 'Status'],
        ...reportPayments.map((payment) => [
        payment.tenant_name || '',
        payment.building_name || '',
        payment.unit_number || '',
        payment.payment_date || '',
        payment.payment_period || '',
        payment.amount || 0,
        payment.payment_status || 'confirmed'
      ])
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
      link.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
      showToast('CSV report exported');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to export CSV report', 'error');
    } finally {
      setExporting('');
    }
  };

  const exportPdf = async () => {
    if (!canManageOperations) {
      showToast('You have view-only access on this page.', 'info');
      return;
    }

    if (isFilterRangeInvalid) {
      showToast('Fix the date range before exporting.', 'warning');
      return;
    }

    setExporting('pdf');
    try {
      const response = await paymentService.exportIncomeReportPDF(reportParams);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `income-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('PDF report exported');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to export PDF report', 'error');
    } finally {
      setExporting('');
    }
  };

  if (loading) return <div style={styles.loading}>Loading reports...</div>;

  return (
    <div id="reports-print" style={styles.printRoot}>
      <style>{`
        .print-watermark {
          display: none;
        }
        @media print {
          body * { visibility: hidden !important; }
          #reports-print, #reports-print * { visibility: visible !important; }
          #reports-print {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            background: #fff !important;
            padding: 20px !important;
          }
          .print-watermark {
            display: block !important;
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 460px !important;
            height: 460px !important;
            object-fit: contain !important;
            opacity: 0.05 !important;
            pointer-events: none !important;
            z-index: 0 !important;
          }
        }
      `}</style>
      <img src="/samm.svg" alt="" aria-hidden="true" className="print-watermark" />
      <div style={{ ...styles.header, ...(isMobile ? styles.headerMobile : {}) }}>
        <div>
          <div style={styles.eyebrowPill}>Reports Center</div>
          <h1 style={styles.title}>Advanced Reports Dashboard</h1>
          <p style={styles.subtitle}>Income, unpaid tenants, building performance, profit trends, and payment behavior.</p>
        </div>
        <div style={{ ...styles.headerActions, ...(isMobile ? styles.headerActionsMobile : {}) }}>
          <button
            type="button"
            style={{ ...styles.btnSecondary, ...(isMobile ? styles.btnMobile : {}) }}
            onClick={fetchReportData}
          >
            Refresh
          </button>
          <button
            type="button"
            style={{ ...styles.btnSecondary, ...(isMobile ? styles.btnMobile : {}), ...(!canManageOperations || exporting === 'pdf' ? styles.btnDisabled : {}) }}
            onClick={exportPdf}
            disabled={!canManageOperations || exporting === 'pdf'}
          >
            {exporting === 'pdf' ? 'Exporting PDF...' : 'Export PDF'}
          </button>
          <button
            type="button"
            style={{ ...styles.btnPrimary, ...(isMobile ? styles.btnMobile : {}), ...(!canManageOperations || exporting === 'csv' ? styles.btnDisabled : {}) }}
            onClick={exportCsv}
            disabled={!canManageOperations || exporting === 'csv'}
          >
            {exporting === 'csv' ? 'Exporting CSV...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {!canManageOperations ? (
        <div style={styles.readOnlyBanner}>
          You have view-only access here. Report insights stay visible, but export and print actions are limited to managers and admins.
        </div>
      ) : null}

      {error && <div style={styles.error}>{error}</div>}
      {isFilterRangeInvalid && <div style={styles.error}>The From date must be before the To date.</div>}

      <div style={{ ...styles.summaryGrid, ...(isMobile ? styles.summaryGridMobile : {}) }}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Today</div>
          <div style={styles.summaryValue}>{formatCurrency(summary?.todayIncome)}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>This Month</div>
          <div style={styles.summaryValue}>{formatCurrency(summary?.monthIncome)}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total Collected</div>
          <div style={styles.summaryValue}>{formatCurrency(summary?.totalIncome)}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Monthly Expected</div>
          <div style={styles.summaryValue}>{formatCurrency(expectedIncome?.expectedIncome)}</div>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Filters</h2>
        <div style={styles.filterGrid}>
          <div style={styles.formGroup}>
            <label>From</label>
            <input type="date" name="from" value={filters.from} onChange={handleFilterChange} />
          </div>
          <div style={styles.formGroup}>
            <label>To</label>
            <input type="date" name="to" value={filters.to} onChange={handleFilterChange} />
          </div>
          <div style={styles.formGroup}>
            <label>Building</label>
            <select name="buildingId" value={filters.buildingId} onChange={handleFilterChange}>
              <option value="">All buildings</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>{building.name}</option>
              ))}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label>Tenant</label>
            <select name="tenantId" value={filters.tenantId} onChange={handleFilterChange}>
              <option value="">All tenants</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.full_name}</option>
              ))}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label>&nbsp;</label>
            <button type="button" style={styles.btnSecondary} onClick={clearFilters}>Clear Filters</button>
          </div>
        </div>
        <p style={styles.infoText}>Filtered confirmed income: <strong>{formatCurrency(totalFilteredIncome)}</strong></p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Monthly Income Charts</h2>
        <div style={styles.chartGrid}>
          {monthlyIncome.map((month) => (
            <div key={month.month} style={{ ...styles.chartRow, ...(isMobile ? styles.chartRowMobile : {}) }}>
              <span style={styles.chartLabel}>{month.month}</span>
              <div style={styles.chartTrack}>
                <div style={{ ...styles.chartFill, width: `${(parseFloat(month.total || 0) / maxMonthlyIncome) * 100}%` }} />
              </div>
              <span style={styles.chartValue}>{formatCurrency(month.total)}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...styles.twoColumn, ...(isMobile ? styles.twoColumnMobile : {}) }}>
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Unpaid Tenants List</h2>
          {isTablet && <p style={styles.tableHint}>Scroll sideways to view all columns.</p>}
          {unpaidTenants.length > 0 ? (
            <table style={{ ...styles.table, ...(isTablet ? styles.tableCompact : {}) }}>
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Unit</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {unpaidTenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>{tenant.full_name}</td>
                    <td>{tenant.unit_number}</td>
                    <td style={styles.dangerText}>{formatCurrency(tenant.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={styles.noData}>No unpaid tenants</p>
          )}
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Who Usually Delays</h2>
          {isTablet && <p style={styles.tableHint}>Scroll sideways to view all columns.</p>}
          {(profitTrends.delayedTenants || []).length > 0 ? (
            <table style={{ ...styles.table, ...(isTablet ? styles.tableCompact : {}) }}>
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Avg Pay Day</th>
                  <th>Payments</th>
                </tr>
              </thead>
              <tbody>
                {profitTrends.delayedTenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>{tenant.full_name}</td>
                    <td>{tenant.avg_payment_day}</td>
                    <td>{tenant.total_payments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={styles.noData}>No delay pattern found yet</p>
          )}
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Building Performance</h2>
        {isTablet && <p style={styles.tableHint}>Scroll sideways to view all columns.</p>}
        <table style={{ ...styles.table, ...(isTablet ? styles.tableCompact : {}) }}>
          <thead>
            <tr>
              <th>Building</th>
              <th>Income</th>
              <th>Expected</th>
              <th>Tenants</th>
              <th>Occupied</th>
              <th>Available</th>
            </tr>
          </thead>
          <tbody>
            {buildingPerformance.map((building) => (
              <tr key={building.id}>
                <td>{building.building_name}</td>
                <td style={styles.successText}>{formatCurrency(building.total_income)}</td>
                <td>{formatCurrency(building.expected_income)}</td>
                <td>{building.tenant_count}</td>
                <td>{building.occupied_units || 0}</td>
                <td>{building.available_units || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Profit Trends</h2>
        {(profitTrends.monthlyTrends || []).map((trend) => (
          <div key={trend.month} style={{ ...styles.chartRow, ...(isMobile ? styles.chartRowMobile : {}) }}>
            <span style={styles.chartLabel}>{trend.month}</span>
            <div style={styles.chartTrack}>
              <div style={{ ...styles.chartFillAlt, width: `${(parseFloat(trend.income || 0) / maxTrendIncome) * 100}%` }} />
            </div>
            <span style={styles.chartValue}>{formatCurrency(trend.income)}</span>
          </div>
        ))}
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Payment History Per Tenant</h2>
        {selectedTenant ? (
          <p style={styles.infoText}>Showing all past payments for <strong>{selectedTenant.full_name}</strong>.</p>
        ) : (
          <p style={styles.infoText}>Select a tenant above to show dates and amounts for dispute resolution.</p>
        )}
        {tenantHistory.length > 0 ? (
          <>
            {isTablet && <p style={styles.tableHint}>Scroll sideways to view all columns.</p>}
            <table style={{ ...styles.table, ...(isTablet ? styles.tableCompact : {}) }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Period</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {tenantHistory.map((payment) => (
                <tr key={payment.id}>
                  <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                  <td>{payment.payment_period || '-'}</td>
                  <td>{formatCurrency(payment.amount)}</td>
                  <td>{payment.payment_status || 'confirmed'}</td>
                  <td>{payment.payment_method || '-'}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </>
        ) : (
          <p style={styles.noData}>No payment history selected</p>
        )}
      </div>
    </div>
  );
};

const styles = {
  printRoot: {
    position: 'relative'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '2rem',
    padding: '1.5rem',
    borderRadius: '1.1rem',
    background: 'linear-gradient(135deg, #0f172a 0%, #155e75 56%, #0f766e 100%)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    boxShadow: '0 22px 46px rgba(15, 23, 42, 0.18)'
  },
  headerMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginBottom: '1.25rem'
  },
  headerActions: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap'
  },
  headerActionsMobile: {
    width: '100%'
  },
  title: {
    fontSize: '2rem',
    fontWeight: '900',
    margin: '0.5rem 0 0.5rem',
    color: '#ffffff',
    lineHeight: 1.1,
    textShadow: '0 2px 10px rgba(15, 23, 42, 0.28)'
  },
  subtitle: {
    color: '#dbeafe',
    margin: 0
  },
  eyebrowPill: {
    display: 'inline-flex',
    color: '#0f172a',
    backgroundColor: '#ccfbf1',
    border: '1px solid rgba(255, 255, 255, 0.45)',
    borderRadius: '999px',
    padding: '0.35rem 0.75rem',
    fontSize: '0.76rem',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.14)'
  },
  btnPrimary: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontWeight: '700'
  },
  btnSecondary: {
    padding: '0.75rem 1.5rem',
    backgroundColor: 'white',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontWeight: '700'
  },
  btnMobile: {
    width: '100%'
  },
  btnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
    boxShadow: 'none'
  },
  readOnlyBanner: {
    marginBottom: '1rem',
    padding: '0.9rem 1rem',
    borderRadius: '0.75rem',
    border: '1px solid #cbd5e1',
    backgroundColor: '#f8fafc',
    color: '#334155',
    fontWeight: 600,
    lineHeight: 1.5
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem'
  },
  summaryGridMobile: {
    gridTemplateColumns: '1fr',
    marginBottom: '1.25rem'
  },
  summaryCard: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    border: '1px solid #e5e7eb',
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.06)'
  },
  summaryLabel: {
    color: '#6b7280',
    fontWeight: '700',
    marginBottom: '0.5rem'
  },
  summaryValue: {
    color: '#2563eb',
    fontSize: '1.5rem',
    fontWeight: '800'
  },
  section: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    marginBottom: '2rem',
    border: '1px solid #e5e7eb',
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.06)',
    overflowX: 'auto'
  },
  sectionTitle: {
    fontSize: '1.2rem',
    fontWeight: '800',
    color: '#111827',
    marginBottom: '1rem'
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: '1rem',
    marginBottom: '1rem'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  chartGrid: {
    display: 'grid',
    gap: '0.8rem'
  },
  chartRow: {
    display: 'grid',
    gridTemplateColumns: '90px 1fr 150px',
    gap: '0.8rem',
    alignItems: 'center',
    marginBottom: '0.75rem'
  },
  chartRowMobile: {
    gridTemplateColumns: '1fr',
    gap: '0.45rem'
  },
  chartLabel: {
    fontWeight: '700',
    color: '#374151'
  },
  chartTrack: {
    height: '18px',
    backgroundColor: '#e5e7eb',
    borderRadius: '0.25rem',
    overflow: 'hidden'
  },
  chartFill: {
    height: '100%',
    backgroundColor: '#2563eb'
  },
  chartFillAlt: {
    height: '100%',
    backgroundColor: '#10b981'
  },
  chartValue: {
    color: '#374151',
    fontWeight: '700'
  },
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1rem'
  },
  twoColumnMobile: {
    gridTemplateColumns: '1fr'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  tableCompact: {
    minWidth: '700px'
  },
  tableHint: {
    marginTop: 0,
    marginBottom: '0.6rem',
    color: '#475569',
    fontSize: '0.78rem',
    fontWeight: '600'
  },
  infoText: {
    color: '#4b5563',
    lineHeight: 1.6
  },
  successText: {
    color: '#047857',
    fontWeight: '800'
  },
  dangerText: {
    color: '#dc2626',
    fontWeight: '800'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#7f1d1d',
    padding: '1rem',
    borderRadius: '0.5rem',
    marginBottom: '1rem'
  },
  loading: {
    textAlign: 'center',
    padding: '2rem'
  },
  noData: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '2rem'
  }
};

export default Reports;
