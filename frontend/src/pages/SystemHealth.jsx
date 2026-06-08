import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { API_ROOT_URL, getReadableApiError, systemService, workspaceService } from '../services/api';
import PageLoader from '../components/PageLoader';

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatBytes = (bytes) => {
  const numericBytes = Number(bytes || 0);
  if (!numericBytes) return '-';
  if (numericBytes < 1024 * 1024) return `${(numericBytes / 1024).toFixed(1)} KB`;
  return `${(numericBytes / 1024 / 1024).toFixed(2)} MB`;
};

const formatAge = (hours) => {
  if (hours === null || hours === undefined) return '-';
  if (hours < 1) return `${Math.max(Math.round(hours * 60), 1)} minutes ago`;
  if (hours < 24) return `${hours.toFixed(1)} hours ago`;
  return `${(hours / 24).toFixed(1)} days ago`;
};

const getTone = (ok) => (ok ? 'good' : 'warn');

const StatusPill = ({ tone = 'muted', children }) => (
  <span style={{ ...styles.pill, ...(styles[`${tone}Pill`] || styles.mutedPill) }}>
    {children}
  </span>
);

const SystemHealth = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backendHealth, setBackendHealth] = useState(null);
  const [backupStatus, setBackupStatus] = useState(null);
  const [messagingStatus, setMessagingStatus] = useState(null);
  const [errors, setErrors] = useState([]);
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupVerifying, setBackupVerifying] = useState(false);
  const [verification, setVerification] = useState(null);

  const checks = useMemo(() => {
    const backupHealthy = backupStatus?.health === 'healthy';
    const emailOk = messagingStatus?.email?.configured;
    const smsOk = messagingStatus?.sms?.configured;
    const whatsappOk = !messagingStatus?.whatsapp?.enabled || messagingStatus?.whatsapp?.configured;

    return [
      {
        label: 'Backend API',
        status: backendHealth?.status === 'ok' ? 'Online' : 'Needs attention',
        detail: backendHealth?.message || errors.find((item) => item.key === 'backend')?.message || 'Not checked yet',
        tone: backendHealth?.status === 'ok' ? 'good' : 'danger'
      },
      {
        label: 'Encrypted Backups',
        status: backupStatus ? backupStatus.health.replace(/-/g, ' ') : isAdmin ? 'Not checked' : 'Admin only',
        detail: backupStatus?.health_message || (isAdmin ? 'Backup status unavailable.' : 'Backup status is visible to administrators.'),
        tone: backupHealthy ? 'good' : backupStatus ? 'warn' : 'muted'
      },
      {
        label: 'Email Messaging',
        status: messagingStatus ? (emailOk ? 'Configured' : 'Missing config') : isAdmin ? 'Not checked' : 'Admin only',
        detail: messagingStatus?.email?.configured ? `Sending from ${messagingStatus.email.from_email || 'configured account'}` : `Missing: ${(messagingStatus?.email?.missing || []).join(', ') || '-'}`,
        tone: messagingStatus ? getTone(emailOk) : 'muted'
      },
      {
        label: 'SMS / WhatsApp',
        status: messagingStatus ? (smsOk || whatsappOk ? 'Review ready' : 'Missing config') : isAdmin ? 'Not checked' : 'Admin only',
        detail: messagingStatus ? `SMS missing: ${(messagingStatus.sms?.missing || []).join(', ') || 'none'} | WhatsApp ${messagingStatus.whatsapp?.enabled ? 'enabled' : 'disabled'}` : 'Messaging status is visible to administrators.',
        tone: messagingStatus ? getTone(smsOk || whatsappOk) : 'muted'
      }
    ];
  }, [backendHealth, backupStatus, errors, isAdmin, messagingStatus]);

  const loadHealth = async ({ quiet = false } = {}) => {
    setRefreshing(true);
    const nextErrors = [];

    try {
      const response = await workspaceService.health();
      setBackendHealth(response.data);
    } catch (error) {
      setBackendHealth(null);
      nextErrors.push({ key: 'backend', message: getReadableApiError(error, 'Backend health check failed.') });
    }

    if (isAdmin) {
      try {
        const response = await systemService.getBackupStatus();
        setBackupStatus(response.data);
      } catch (error) {
        setBackupStatus(null);
        nextErrors.push({ key: 'backup', message: getReadableApiError(error, 'Backup status failed.') });
      }

      try {
        const response = await systemService.getMessagingStatus();
        setMessagingStatus(response.data);
      } catch (error) {
        setMessagingStatus(null);
        nextErrors.push({ key: 'messaging', message: getReadableApiError(error, 'Messaging status failed.') });
      }
    }

    setErrors(nextErrors);
    setLoading(false);
    setRefreshing(false);

    if (!quiet) {
      showToast(nextErrors.length ? 'Health check finished with items to review.' : 'System health check completed.', nextErrors.length ? 'warning' : 'success');
    }
  };

  useEffect(() => {
    loadHealth({ quiet: true });
  }, [isAdmin]);

  const runBackup = async () => {
    setBackupRunning(true);
    try {
      const response = await systemService.runBackup();
      setBackupStatus(response.data?.status || response.data);
      showToast(response.data?.message || 'Backup created successfully.', 'success');
    } catch (error) {
      showToast(getReadableApiError(error, 'Backup failed.'), 'error');
    } finally {
      setBackupRunning(false);
    }
  };

  const verifyBackup = async () => {
    setBackupVerifying(true);
    try {
      const response = await systemService.verifyBackup();
      setVerification(response.data);
      setBackupStatus(response.data?.status || backupStatus);
      showToast(response.data?.message || 'Backup verification completed.', response.data?.ok === false ? 'warning' : 'success');
    } catch (error) {
      showToast(getReadableApiError(error, 'Backup verification failed.'), 'error');
    } finally {
      setBackupVerifying(false);
    }
  };

  const copyDiagnostics = async () => {
    const payload = {
      checked_at: new Date().toISOString(),
      app_url: typeof window !== 'undefined' ? window.location.origin : '',
      api_root: API_ROOT_URL,
      backend: backendHealth,
      backup: backupStatus,
      messaging: messagingStatus,
      errors
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      showToast('Diagnostics copied to clipboard.', 'success');
    } catch (_) {
      showToast('Could not copy diagnostics in this browser.', 'warning');
    }
  };

  if (loading) return <PageLoader text="Checking system health..." />;

  return (
    <main className="system-health-page" style={styles.page}>
      <section style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>System Health</div>
          <h1 style={styles.title}>Operational status and recovery tools</h1>
          <p style={styles.subtitle}>Check server reachability, backups, messaging readiness, and copy diagnostics when something needs attention.</p>
        </div>
        <div style={styles.heroActions}>
          <button type="button" style={styles.primaryButton} onClick={() => loadHealth()} disabled={refreshing}>
            {refreshing ? 'Checking...' : 'Run Health Check'}
          </button>
          <button type="button" style={styles.secondaryButton} onClick={copyDiagnostics}>
            Copy Diagnostics
          </button>
        </div>
      </section>

      {errors.length ? (
        <section style={styles.alert}>
          <strong>Attention needed:</strong> {errors.map((item) => item.message).join(' ')}
        </section>
      ) : null}

      <section style={styles.checkGrid}>
        {checks.map((check) => (
          <article key={check.label} style={styles.checkCard}>
            <div style={styles.checkHeader}>
              <h2 style={styles.checkTitle}>{check.label}</h2>
              <StatusPill tone={check.tone}>{check.status}</StatusPill>
            </div>
            <p style={styles.checkDetail}>{check.detail}</p>
          </article>
        ))}
      </section>

      <section style={styles.detailGrid}>
        <article style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Backend</h2>
              <p style={styles.panelText}>API root: {API_ROOT_URL || '/api'}</p>
            </div>
            <StatusPill tone={backendHealth?.status === 'ok' ? 'good' : 'danger'}>{backendHealth?.status || 'offline'}</StatusPill>
          </div>
          <dl style={styles.metricList}>
            <div style={styles.metricRow}><dt>Checked</dt><dd>{formatDateTime(backendHealth?.checked_at)}</dd></div>
            <div style={styles.metricRow}><dt>Uptime</dt><dd>{backendHealth?.uptime ? `${backendHealth.uptime}s` : '-'}</dd></div>
            <div style={styles.metricRow}><dt>Message</dt><dd>{backendHealth?.message || '-'}</dd></div>
          </dl>
        </article>

        <article style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Backups</h2>
              <p style={styles.panelText}>{isAdmin ? 'Encrypted database backup status.' : 'Only admins can inspect backup details.'}</p>
            </div>
            <StatusPill tone={backupStatus?.health === 'healthy' ? 'good' : backupStatus ? 'warn' : 'muted'}>
              {backupStatus?.health || 'admin'}
            </StatusPill>
          </div>
          {isAdmin ? (
            <>
              <dl style={styles.metricList}>
                <div style={styles.metricRow}><dt>Latest</dt><dd>{backupStatus?.latest_backup?.name || '-'}</dd></div>
                <div style={styles.metricRow}><dt>Age</dt><dd>{formatAge(backupStatus?.latest_backup_age_hours)}</dd></div>
                <div style={styles.metricRow}><dt>Backups</dt><dd>{backupStatus?.backup_count ?? '-'}</dd></div>
                <div style={styles.metricRow}><dt>Storage</dt><dd>{formatBytes(backupStatus?.storage_used_bytes)}</dd></div>
              </dl>
              <div style={styles.actions}>
                <button type="button" style={styles.primaryButton} onClick={runBackup} disabled={backupRunning}>
                  {backupRunning ? 'Running...' : 'Run Backup'}
                </button>
                <button type="button" style={styles.secondaryButton} onClick={verifyBackup} disabled={backupVerifying}>
                  {backupVerifying ? 'Verifying...' : 'Verify Latest'}
                </button>
              </div>
              {verification ? <p style={styles.note}>{verification.message}</p> : null}
            </>
          ) : (
            <p style={styles.note}>Ask an administrator to review backup details if the system is behaving unusually.</p>
          )}
        </article>
      </section>
    </main>
  );
};

const styles = {
  page: {
    minHeight: '100%',
    background: '#f6f8fc',
    padding: '8px 4px 24px'
  },
  hero: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '18px',
    flexWrap: 'wrap',
    borderRadius: '16px',
    border: '1px solid #dbe4f0',
    background: '#ffffff',
    padding: '22px',
    boxShadow: '0 18px 42px rgba(15, 23, 42, 0.08)',
    marginBottom: '18px'
  },
  eyebrow: {
    color: '#2563eb',
    fontSize: '12px',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
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
    maxWidth: '760px',
    color: '#475569',
    fontSize: '15px',
    lineHeight: 1.55
  },
  heroActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  primaryButton: {
    minHeight: '42px',
    border: 'none',
    borderRadius: '9px',
    background: '#2563eb',
    color: '#ffffff',
    padding: '0 16px',
    fontWeight: 800,
    cursor: 'pointer'
  },
  secondaryButton: {
    minHeight: '42px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    background: '#ffffff',
    color: '#1e293b',
    padding: '0 16px',
    fontWeight: 800,
    cursor: 'pointer'
  },
  alert: {
    border: '1px solid #fed7aa',
    borderRadius: '12px',
    background: '#fff7ed',
    color: '#9a3412',
    padding: '13px 15px',
    marginBottom: '18px',
    fontSize: '14px',
    lineHeight: 1.45
  },
  checkGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
    marginBottom: '18px'
  },
  checkCard: {
    border: '1px solid #dbe4f0',
    borderRadius: '13px',
    background: '#ffffff',
    padding: '16px',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)'
  },
  checkHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    alignItems: 'flex-start',
    marginBottom: '10px'
  },
  checkTitle: {
    margin: 0,
    color: '#172554',
    fontSize: '16px',
    lineHeight: 1.25
  },
  checkDetail: {
    margin: 0,
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.5
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '26px',
    borderRadius: '999px',
    padding: '0 9px',
    fontSize: '11px',
    fontWeight: 900,
    textTransform: 'capitalize',
    whiteSpace: 'nowrap'
  },
  goodPill: { background: '#dcfce7', color: '#166534' },
  warnPill: { background: '#fef3c7', color: '#92400e' },
  dangerPill: { background: '#fee2e2', color: '#991b1b' },
  mutedPill: { background: '#e2e8f0', color: '#475569' },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px'
  },
  panel: {
    border: '1px solid #dbe4f0',
    borderRadius: '14px',
    background: '#ffffff',
    padding: '18px',
    boxShadow: '0 14px 32px rgba(15, 23, 42, 0.06)'
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '14px',
    alignItems: 'flex-start',
    marginBottom: '14px'
  },
  panelTitle: {
    margin: 0,
    color: '#172554',
    fontSize: '18px'
  },
  panelText: {
    margin: '5px 0 0',
    color: '#64748b',
    fontSize: '13px'
  },
  metricList: {
    display: 'grid',
    gap: '8px',
    margin: 0
  },
  metricRow: {
    display: 'grid',
    gridTemplateColumns: '110px minmax(0, 1fr)',
    gap: '12px',
    padding: '9px 0',
    borderBottom: '1px solid #edf2f7',
    color: '#334155',
    fontSize: '13px'
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '14px'
  },
  note: {
    margin: '12px 0 0',
    color: '#475569',
    fontSize: '13px',
    lineHeight: 1.5
  }
};

export default SystemHealth;
