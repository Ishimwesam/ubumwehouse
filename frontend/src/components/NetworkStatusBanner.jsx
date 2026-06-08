import React, { useEffect, useState } from 'react';

const getNetworkState = () => {
  if (typeof navigator === 'undefined') {
    return { online: true, slow: false, label: 'online' };
  }

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const effectiveType = connection?.effectiveType || '';
  const slow = ['slow-2g', '2g'].includes(effectiveType) || Boolean(connection?.saveData);

  return {
    online: navigator.onLine,
    slow,
    label: slow ? 'slow connection' : 'online'
  };
};

const NetworkStatusBanner = () => {
  const [network, setNetwork] = useState(getNetworkState);
  const [lastSyncAt, setLastSyncAt] = useState(() => {
    try {
      return localStorage.getItem('rms-last-successful-sync') || '';
    } catch (_) {
      return '';
    }
  });

  useEffect(() => {
    const updateNetwork = () => setNetwork(getNetworkState());
    const updateSync = (event) => {
      const value = event.detail?.syncedAt || new Date().toISOString();
      setLastSyncAt(value);
    };

    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    window.addEventListener('app:data-sync-success', updateSync);

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    connection?.addEventListener?.('change', updateNetwork);

    return () => {
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
      window.removeEventListener('app:data-sync-success', updateSync);
      connection?.removeEventListener?.('change', updateNetwork);
    };
  }, []);

  if (network.online && !network.slow) return null;

  const lastSyncLabel = lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'not recorded yet';

  return (
    <div style={{ ...styles.banner, ...(network.online ? styles.slow : styles.offline) }} role="status" aria-live="polite">
      <strong>{network.online ? 'Slow network mode' : 'Offline mode'}</strong>
      <span>
        {network.online
          ? 'The system may use cached data while requests finish.'
          : 'You can keep viewing cached dashboard data until the connection returns.'}
      </span>
      <small>Last sync: {lastSyncLabel}</small>
    </div>
  );
};

const styles = {
  banner: {
    position: 'fixed',
    left: '50%',
    bottom: 'max(14px, env(safe-area-inset-bottom))',
    transform: 'translateX(-50%)',
    zIndex: 30000,
    width: 'min(720px, calc(100vw - 24px))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    padding: '10px 14px',
    borderRadius: '999px',
    boxShadow: '0 18px 38px rgba(15, 23, 42, 0.22)',
    fontSize: '13px',
    lineHeight: 1.35,
    textAlign: 'center'
  },
  slow: {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#92400e'
  },
  offline: {
    background: '#fff1f2',
    border: '1px solid #fecdd3',
    color: '#9f1239'
  }
};

export default NetworkStatusBanner;
