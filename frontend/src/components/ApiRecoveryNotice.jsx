import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ApiRecoveryNotice = () => {
  const navigate = useNavigate();
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const handleApiError = (event) => {
      const detail = event.detail || {};
      if (!detail.recoverable) return;

      setNotice({
        message: detail.message || 'The server could not be reached.',
        status: detail.status || '',
        path: detail.path || ''
      });
    };

    window.addEventListener('app:api-error', handleApiError);
    return () => window.removeEventListener('app:api-error', handleApiError);
  }, []);

  if (!notice) return null;

  return (
    <div style={styles.overlay} role="alert" aria-live="assertive">
      <section style={styles.panel}>
        <div style={styles.badge}>Connection Recovery</div>
        <h2 style={styles.title}>The system needs a quick check</h2>
        <p style={styles.text}>{notice.message}</p>
        {notice.path ? <p style={styles.meta}>Last request: {notice.path}</p> : null}
        <div style={styles.actions}>
          <button type="button" style={styles.primary} onClick={() => setNotice(null)}>
            Keep Working
          </button>
          <button type="button" style={styles.secondary} onClick={() => window.location.reload()}>
            Retry Page
          </button>
          <button type="button" style={styles.secondary} onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
          <button type="button" style={styles.secondary} onClick={() => navigate('/system-health')}>
            System Health
          </button>
        </div>
      </section>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 25000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '18px',
    background: 'rgba(15, 23, 42, 0.34)',
    backdropFilter: 'blur(5px)'
  },
  panel: {
    width: 'min(560px, 100%)',
    borderRadius: '14px',
    border: '1px solid #dbe4f0',
    background: '#ffffff',
    padding: '22px',
    boxShadow: '0 28px 70px rgba(15, 23, 42, 0.24)'
  },
  badge: {
    display: 'inline-flex',
    minHeight: '28px',
    alignItems: 'center',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '12px',
    fontWeight: 900,
    marginBottom: '12px'
  },
  title: {
    margin: '0 0 8px',
    color: '#0f172a',
    fontSize: '1.45rem',
    lineHeight: 1.18
  },
  text: {
    margin: '0 0 10px',
    color: '#475569',
    lineHeight: 1.55
  },
  meta: {
    margin: '0 0 16px',
    color: '#64748b',
    fontSize: '12px',
    overflowWrap: 'anywhere'
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  primary: {
    minHeight: '40px',
    border: 'none',
    borderRadius: '9px',
    background: '#2563eb',
    color: '#ffffff',
    padding: '0 14px',
    fontWeight: 800,
    cursor: 'pointer'
  },
  secondary: {
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

export default ApiRecoveryNotice;
