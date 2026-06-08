import React from 'react';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleDashboard = () => {
    window.location.assign('/dashboard');
  };

  handleHealth = () => {
    window.location.assign('/system-health');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main style={styles.shell} role="alert" aria-live="assertive">
        <section style={styles.panel}>
          <div style={styles.badge}>Recovery</div>
          <h1 style={styles.title}>This page needs a quick reset</h1>
          <p style={styles.text}>
            Something in this screen failed to load correctly. Your session is still protected, and you can retry the page or return to a stable area.
          </p>
          <div style={styles.actions}>
            <button type="button" style={styles.primaryButton} onClick={this.handleRetry}>
              Retry Page
            </button>
            <button type="button" style={styles.secondaryButton} onClick={this.handleDashboard}>
              Go to Dashboard
            </button>
            <button type="button" style={styles.secondaryButton} onClick={this.handleHealth}>
              System Health
            </button>
          </div>
          {this.state.error?.message ? (
            <pre style={styles.errorText}>{this.state.error.message}</pre>
          ) : null}
        </section>
      </main>
    );
  }
}

const styles = {
  shell: {
    minHeight: '60vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px'
  },
  panel: {
    width: 'min(680px, 100%)',
    borderRadius: '14px',
    border: '1px solid #dbe4f0',
    background: '#ffffff',
    boxShadow: '0 22px 54px rgba(15, 23, 42, 0.12)',
    padding: '24px'
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
    fontWeight: 800,
    marginBottom: '14px'
  },
  title: {
    margin: '0 0 10px',
    color: '#0f172a',
    fontSize: 'clamp(1.5rem, 4vw, 2.1rem)',
    lineHeight: 1.15
  },
  text: {
    margin: '0 0 18px',
    color: '#475569',
    fontSize: '15px',
    lineHeight: 1.6
  },
  actions: {
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
  errorText: {
    margin: '18px 0 0',
    padding: '12px',
    borderRadius: '9px',
    background: '#f8fafc',
    color: '#64748b',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    fontSize: '12px'
  }
};

export default AppErrorBoundary;
