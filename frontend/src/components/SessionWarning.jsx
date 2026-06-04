import React from 'react';
import { useAuth } from '../context/AuthContext';

const SessionWarning = () => {
  const { sessionWarning, extendSession, logoutWithFarewell, timeRemaining } = useAuth();

  if (!sessionWarning) return null;

  const minutesRemaining = Math.ceil(timeRemaining / (60 * 1000));

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.icon}>⏰</div>
        <h3 style={styles.title}>Session Expiring Soon</h3>
        <p style={styles.message}>
          Your session will expire in {minutesRemaining} minute{minutesRemaining !== 1 ? 's' : ''} due to inactivity.
          Would you like to extend your session?
        </p>
        <div style={styles.actions}>
          <button
            type="button"
            style={styles.extendBtn}
            onClick={extendSession}
          >
            Extend Session
          </button>
          <button
            type="button"
            style={styles.logoutBtn}
            onClick={logoutWithFarewell}
          >
            Logout Now
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '0.75rem',
    padding: '2rem',
    maxWidth: '400px',
    width: '90%',
    textAlign: 'center',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
  },
  icon: {
    fontSize: '3rem',
    marginBottom: '1rem'
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '1rem'
  },
  message: {
    color: '#6b7280',
    lineHeight: '1.6',
    marginBottom: '2rem'
  },
  actions: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center'
  },
  extendBtn: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.95rem'
  },
  logoutBtn: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#f3f4f6',
    color: '#1f2937',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.95rem'
  }
};

export default SessionWarning;
