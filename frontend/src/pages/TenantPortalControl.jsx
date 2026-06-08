import React, { useEffect, useMemo, useState } from 'react';
import { getReadableApiError, tenantPortalAdminService } from '../services/api';

const formatDateTime = (value) => {
  if (!value) return 'Never';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Never';
  return parsed.toLocaleString();
};

const TenantPortalControl = () => {
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return accounts;

    return accounts.filter((account) => [
      account.tenant_name,
      account.username,
      account.tenant_email,
      account.tenant_phone,
      account.unit_number,
      account.building_name
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [accounts, search]);

  const loadAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await tenantPortalAdminService.listAccounts();
      setAccounts(response.data?.accounts || []);
      setSummary(response.data?.summary || { total: 0, active: 0, inactive: 0 });
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to load tenant portal accounts.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleToggleStatus = async (account) => {
    setWorkingId(account.id);
    setError('');
    setSuccess('');
    try {
      await tenantPortalAdminService.updateAccountStatus(account.id, !account.is_active);
      setSuccess(`Account ${account.username} has been ${account.is_active ? 'deactivated' : 'activated'}.`);
      await loadAccounts();
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to update account status.'));
    } finally {
      setWorkingId('');
    }
  };

  const handleResetPassword = async (account) => {
    const newPassword = window.prompt(`Set a new password for ${account.username}. Password must be at least 8 characters and include a letter and a number.`);
    if (!newPassword) return;

    setWorkingId(account.id);
    setError('');
    setSuccess('');
    try {
      await tenantPortalAdminService.resetAccountPassword(account.id, newPassword);
      setSuccess(`Password reset for ${account.username} completed.`);
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to reset account password.'));
    } finally {
      setWorkingId('');
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Tenant Portal Control</h1>
          <p style={styles.subtitle}>Manage tenant portal account access, activation state, and password resets.</p>
        </div>
        <button type="button" style={styles.refreshButton} onClick={loadAccounts} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <section style={styles.summaryGrid}>
        <article style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Total Accounts</span>
          <strong style={styles.summaryValue}>{summary.total}</strong>
        </article>
        <article style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Active</span>
          <strong style={styles.summaryValue}>{summary.active}</strong>
        </article>
        <article style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Inactive</span>
          <strong style={styles.summaryValue}>{summary.inactive}</strong>
        </article>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <h2 style={styles.panelTitle}>Tenant Portal Accounts</h2>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tenant, username, contact, unit, or building"
            style={styles.searchInput}
          />
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}
        {success ? <div style={styles.success}>{success}</div> : null}

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Tenant</th>
                <th style={styles.th}>Username</th>
                <th style={styles.th}>Unit</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Last Login</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account) => (
                <tr key={account.id}>
                  <td style={styles.td}>
                    <div style={styles.primary}>{account.tenant_name || 'Unknown tenant'}</div>
                    <div style={styles.secondary}>{account.tenant_email || account.tenant_phone || 'No contact'}</div>
                  </td>
                  <td style={styles.td}>{account.username}</td>
                  <td style={styles.td}>{account.unit_number ? `${account.building_name || 'Unknown building'} / ${account.unit_number}` : 'Unassigned'}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.statusBadge, ...(account.is_active ? styles.statusActive : styles.statusInactive) }}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={styles.td}>{formatDateTime(account.last_login_at)}</td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button
                        type="button"
                        style={styles.actionButton}
                        onClick={() => handleToggleStatus(account)}
                        disabled={workingId === account.id}
                      >
                        {account.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        style={styles.actionButtonSecondary}
                        onClick={() => handleResetPassword(account)}
                        disabled={workingId === account.id}
                      >
                        Reset Password
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredAccounts.length === 0 ? (
                <tr>
                  <td style={styles.emptyState} colSpan={6}>No tenant portal accounts found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const styles = {
  page: {
    display: 'grid',
    gap: 20
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap'
  },
  title: {
    margin: 0,
    fontSize: 30,
    color: '#0f172a'
  },
  subtitle: {
    margin: '8px 0 0',
    color: '#475569'
  },
  refreshButton: {
    border: '1px solid #bfdbfe',
    background: '#ffffff',
    color: '#1d4ed8',
    borderRadius: 10,
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  summaryGrid: {
    display: 'grid',
    gap: 12,
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))'
  },
  summaryCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    padding: 14,
    display: 'grid',
    gap: 8
  },
  summaryLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#64748b'
  },
  summaryValue: {
    fontSize: 24,
    color: '#0f172a'
  },
  panel: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    padding: 16,
    display: 'grid',
    gap: 12
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap'
  },
  panelTitle: {
    margin: 0,
    color: '#0f172a'
  },
  searchInput: {
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    padding: '10px 12px',
    minWidth: 260,
    width: 'min(100%, 420px)'
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    borderRadius: 10,
    padding: '10px 12px'
  },
  success: {
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    color: '#047857',
    borderRadius: 10,
    padding: '10px 12px'
  },
  tableWrap: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    fontSize: 12,
    color: '#64748b',
    fontWeight: 700,
    padding: '10px 8px',
    borderBottom: '1px solid #e2e8f0'
  },
  td: {
    padding: '12px 8px',
    borderBottom: '1px solid #f1f5f9',
    color: '#0f172a',
    verticalAlign: 'top'
  },
  primary: {
    fontWeight: 700
  },
  secondary: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  statusBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700
  },
  statusActive: {
    background: '#dcfce7',
    color: '#166534'
  },
  statusInactive: {
    background: '#fee2e2',
    color: '#b91c1c'
  },
  actions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap'
  },
  actionButton: {
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
    color: '#1d4ed8',
    borderRadius: 8,
    padding: '8px 10px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  actionButtonSecondary: {
    border: '1px solid #d1d5db',
    background: '#ffffff',
    color: '#0f172a',
    borderRadius: 8,
    padding: '8px 10px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  emptyState: {
    padding: 16,
    textAlign: 'center',
    color: '#64748b'
  }
};

export default TenantPortalControl;
