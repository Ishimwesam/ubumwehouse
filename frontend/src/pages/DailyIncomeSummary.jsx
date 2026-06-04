import React, { useState, useEffect } from 'react';
import { dashboardService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useDataSync } from '../context/DataSyncContext';

const formatCurrency = (value) => `${parseFloat(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;
const formatPercent = (value) => `${parseFloat(value || 0).toFixed(2)}%`;

const DailyIncomeSummary = () => {
  const { versions } = useDataSync();
  const [summary, setSummary] = useState(null);
  const [todayBreakdown, setTodayBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchDailySummary();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchDailySummary, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [versions.dashboard, versions.payments, versions.reports]);

  const fetchDailySummary = async () => {
    try {
      setRefreshing(true);
      const response = await dashboardService.getSummary();
      setSummary(response.data);
      
      // Generate breakdown by building
      if (response.data.recentPayments) {
        const today = new Date().toISOString().split('T')[0];
        const todayPayments = response.data.recentPayments.filter(
          (p) => p.payment_date?.split('T')[0] === today
        );
        setTodayBreakdown(todayPayments);
      }

      showToast('Income summary updated', 'success');
    } catch (err) {
      console.error('Error fetching daily summary:', err);
      showToast('Failed to load income summary', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getProgressPercent = () => {
    if (!summary || !summary.monthIncome || !summary.expectedIncome) return 0;
    return (summary.monthIncome / summary.expectedIncome) * 100;
  };

  const getRemainingDays = () => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return lastDay.getDate() - today.getDate();
  };

  const getExpectedDaily = () => {
    if (!summary || !summary.expectedIncome) return 0;
    const daysInMonth = new Date(summary.year || new Date().getFullYear(), (summary.month || new Date().getMonth()) + 1, 0).getDate();
    return summary.expectedIncome / daysInMonth;
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <p>Loading daily income summary...</p>
        </div>
      </div>
    );
  }

  const progressPercent = getProgressPercent();
  const remainingDays = getRemainingDays();
  const expectedDaily = getExpectedDaily();

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Daily Income Summary</h1>
          <p style={styles.subtitle}>Real-time income tracking and daily progress</p>
        </div>
        <button
          type="button"
          style={{ ...styles.btnPrimary, opacity: refreshing ? 0.7 : 1 }}
          onClick={fetchDailySummary}
          disabled={refreshing}
        >
          {refreshing ? '⟳ Refreshing...' : '⟳ Refresh Now'}
        </button>
      </div>

      {/* Main Summary Cards */}
      <div style={styles.mainGrid}>
        {/* Today's Income */}
        <div style={styles.largeCard}>
          <div style={styles.cardLabel}>Today's Income</div>
          <div style={{ ...styles.largeValue, color: '#10b981' }}>
            {formatCurrency(summary?.todayIncome)}
          </div>
          <div style={styles.cardSubtext}>
            Expected daily: {formatCurrency(expectedDaily)}
          </div>
          <div
            style={{
              ...styles.progressBar,
              width: `${Math.min((summary?.todayIncome / expectedDaily) * 100, 100)}%`,
              backgroundColor:
                summary?.todayIncome >= expectedDaily ? '#10b981' : '#f59e0b'
            }}
          />
          <div style={styles.progressText}>
            {summary?.todayIncome >= expectedDaily
              ? '✓ Target reached for today!'
              : `${formatCurrency(expectedDaily - summary?.todayIncome)} to reach target`}
          </div>
        </div>

        {/* This Month */}
        <div style={styles.largeCard}>
          <div style={styles.cardLabel}>This Month</div>
          <div style={{ ...styles.largeValue, color: '#2563eb' }}>
            {formatCurrency(summary?.monthIncome)}
          </div>
          <div style={styles.cardSubtext}>
            Expected: {formatCurrency(summary?.expectedIncome)}
          </div>
          <div
            style={{
              ...styles.progressBar,
              width: `${Math.min(progressPercent, 100)}%`,
              backgroundColor:
                progressPercent >= 100 ? '#10b981' : progressPercent >= 80 ? '#2563eb' : '#f59e0b'
            }}
          />
          <div style={styles.progressText}>
            {formatPercent(progressPercent)} collected • {remainingDays} days remaining
          </div>
        </div>

        {/* Total Collected */}
        <div style={styles.largeCard}>
          <div style={styles.cardLabel}>Total Collected</div>
          <div style={{ ...styles.largeValue, color: '#7c3aed' }}>
            {formatCurrency(summary?.totalIncome)}
          </div>
          <div style={styles.cardSubtext}>All-time income</div>
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <span style={styles.badge}>Grand Total</span>
          </div>
        </div>

        {/* Outstanding */}
        <div style={styles.largeCard}>
          <div style={styles.cardLabel}>Outstanding Balance</div>
          <div style={{ ...styles.largeValue, color: '#ef4444' }}>
            {formatCurrency(summary?.unpaidBalances)}
          </div>
          <div style={styles.cardSubtext}>Unpaid amounts</div>
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <span style={styles.badgeDanger}>⚠️ Action Required</span>
          </div>
        </div>
      </div>

      {/* Quick Metrics */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>Days</div>
          <div style={styles.metricLabel}>Days in Month</div>
          <div style={styles.metricValue}>
            {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>Left</div>
          <div style={styles.metricLabel}>Days Remaining</div>
          <div style={styles.metricValue}>{remainingDays}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>Target</div>
          <div style={styles.metricLabel}>Daily Target</div>
          <div style={styles.metricValue}>{formatCurrency(expectedDaily)}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>Rate</div>
          <div style={styles.metricLabel}>Progress Rate</div>
          <div
            style={{
              ...styles.metricValue,
              color:
                progressPercent >= 100 ? '#10b981' : progressPercent >= 80 ? '#2563eb' : '#f59e0b'
            }}
          >
            {formatPercent(progressPercent)}
          </div>
        </div>
      </div>

      {/* Today's Transactions */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>Today's Transactions ({todayBreakdown.length})</div>
        {todayBreakdown.length > 0 ? (
          <div style={styles.transactionList}>
            {todayBreakdown.map((transaction, idx) => (
              <div key={idx} style={styles.transactionItem}>
                <div style={styles.transactionLeft}>
                  <div style={styles.transactionTenant}>{transaction.full_name}</div>
                  <div style={styles.transactionUnit}>Unit {transaction.unit_number}</div>
                </div>
                <div style={styles.transactionRight}>
                  <div
                    style={{
                      ...styles.transactionAmount,
                      color: '#10b981'
                    }}
                  >
                    +{formatCurrency(transaction.amount)}
                  </div>
                  <div style={styles.transactionTime}>
                    {new Date(transaction.payment_date).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <p>No payments recorded today yet</p>
          </div>
        )}
      </div>

      {/* Income Analysis */}
      <div style={styles.analysisGrid}>
        {/* Status */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>Status Today</div>
          <div style={styles.statusContent}>
            {summary?.todayIncome >= expectedDaily ? (
              <div style={styles.statusGood}>
                <div style={styles.statusIcon}>On</div>
                <div style={styles.statusText}>
                  <strong>Target Reached!</strong>
                  <p>You've met today's income goal.</p>
                </div>
              </div>
            ) : summary?.todayIncome > 0 ? (
              <div style={styles.statusWarning}>
                <div style={styles.statusIcon}>In</div>
                <div style={styles.statusText}>
                  <strong>In Progress</strong>
                  <p>
                    Need {formatCurrency(expectedDaily - summary?.todayIncome)} more to reach daily target.
                  </p>
                </div>
              </div>
            ) : (
              <div style={styles.statusWarning}>
                <div style={styles.statusIcon}>No</div>
                <div style={styles.statusText}>
                  <strong>No Income Yet</strong>
                  <p>Daily target: {formatCurrency(expectedDaily)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Monthly Forecast */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>Monthly Forecast</div>
          <div style={styles.forecastContent}>
            <div style={styles.forecastItem}>
              <span style={styles.forecastLabel}>On Track For:</span>
              <span style={styles.forecastValue}>
                {formatCurrency(
                  summary?.monthIncome +
                    expectedDaily * remainingDays
                )}
              </span>
            </div>
            <div style={styles.forecastItem}>
              <span style={styles.forecastLabel}>Needed Daily:</span>
              <span style={styles.forecastValue}>{formatCurrency(expectedDaily)}</span>
            </div>
            <div style={styles.forecastItem}>
              <span style={styles.forecastLabel}>Projected Shortfall:</span>
              <span
                style={{
                  ...styles.forecastValue,
                  color:
                    summary?.monthIncome +
                      expectedDaily * remainingDays >=
                    summary?.expectedIncome
                      ? '#10b981'
                      : '#ef4444'
                }}
              >
                {formatCurrency(
                  Math.max(
                    0,
                    summary?.expectedIncome -
                      (summary?.monthIncome + expectedDaily * remainingDays)
                  )
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div style={styles.footer}>
        Last updated: {new Date().toLocaleTimeString()} | Auto-refreshes every 5 minutes
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '2rem',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '2rem',
    gap: '1rem'
  },
  pageTitle: {
    fontSize: '2rem',
    fontWeight: 700,
    margin: 0,
    color: '#1f2937'
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginTop: '0.25rem',
    margin: 0
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
    color: 'white',
    padding: '0.75rem 1.5rem',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.3s ease'
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem'
  },
  largeCard: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
    border: '2px solid #e5e7eb',
    borderRadius: '0.75rem',
    padding: '2rem',
    textAlign: 'center'
  },
  cardLabel: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#6b7280',
    marginBottom: '0.5rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  largeValue: {
    fontSize: '2.5rem',
    fontWeight: 700,
    marginBottom: '0.5rem'
  },
  cardSubtext: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginBottom: '1rem'
  },
  progressBar: {
    height: '8px',
    background: '#e5e7eb',
    borderRadius: '9999px',
    marginBottom: '0.5rem',
    transition: 'width 0.5s ease'
  },
  progressText: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginTop: '0.5rem'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem'
  },
  metricCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  },
  metricIcon: {
    fontSize: '2rem',
    marginBottom: '0.5rem'
  },
  metricLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#6b7280',
    marginBottom: '0.5rem',
    textTransform: 'uppercase'
  },
  metricValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#1f2937'
  },
  card: {
    background: '#ffffff',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
    marginBottom: '1.5rem'
  },
  cardHeader: {
    fontSize: '1.125rem',
    fontWeight: 700,
    marginBottom: '1rem',
    borderBottom: '2px solid #e5e7eb',
    paddingBottom: '1rem',
    color: '#1f2937'
  },
  transactionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  transactionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem',
    background: '#f9fafb',
    borderRadius: '0.5rem',
    transition: 'all 0.2s ease'
  },
  transactionLeft: {
    flex: 1
  },
  transactionTenant: {
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: '0.25rem',
    fontSize: '0.875rem'
  },
  transactionUnit: {
    fontSize: '0.75rem',
    color: '#6b7280'
  },
  transactionRight: {
    textAlign: 'right'
  },
  transactionAmount: {
    fontWeight: 700,
    marginBottom: '0.25rem',
    fontSize: '0.95rem'
  },
  transactionTime: {
    fontSize: '0.75rem',
    color: '#6b7280'
  },
  emptyState: {
    textAlign: 'center',
    padding: '2rem',
    color: '#6b7280'
  },
  analysisGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem'
  },
  statusContent: {
    padding: '1rem'
  },
  statusGood: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    background: '#f0fdf4',
    borderRadius: '0.5rem',
    border: '1px solid #dcfce7'
  },
  statusWarning: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    background: '#fffbeb',
    borderRadius: '0.5rem',
    border: '1px solid #fef3c7'
  },
  statusIcon: {
    fontSize: '1.5rem'
  },
  statusText: {
    textAlign: 'left',
    color: '#92400e',
    fontSize: '0.875rem'
  },
  forecastContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  forecastItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.75rem',
    background: '#f9fafb',
    borderRadius: '0.5rem',
    borderLeft: '4px solid #2563eb'
  },
  forecastLabel: {
    fontSize: '0.875rem',
    color: '#6b7280',
    fontWeight: 500
  },
  forecastValue: {
    fontWeight: 700,
    color: '#1f2937'
  },
  badge: {
    display: 'inline-block',
    padding: '0.375rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  badgeDanger: {
    display: 'inline-block',
    padding: '0.375rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  footer: {
    textAlign: 'center',
    padding: '1rem',
    background: '#f3f4f6',
    borderRadius: '0.5rem',
    fontSize: '0.75rem',
    color: '#6b7280'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
    color: '#6b7280'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '1rem'
  }
};

export default DailyIncomeSummary;
