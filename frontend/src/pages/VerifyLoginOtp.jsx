import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const VerifyLoginOtp = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyLoginOtp } = useAuth();

  const [username, setUsername] = useState(location.state?.username || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info] = useState(location.state?.message || 'Enter the OTP sent to your registered email/phone.');
  const rememberMe = Boolean(location.state?.rememberMe);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !otp) {
      setError('Username and OTP are required');
      return;
    }

    setLoading(true);
    try {
      await verifyLoginOtp(username, otp, rememberMe);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.message || err.response?.data?.error || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>OTP Verification</h1>
        <p style={styles.subtitle}>{info}</p>
        {location.state?.destination && (
          <p style={styles.destination}>Sent to: {location.state.destination}</p>
        )}

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label>OTP Code</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter 6-digit OTP"
              maxLength={6}
              required
            />
          </div>

          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>

        <p style={styles.backText}>
          Back to <Link to="/login" style={styles.link}>Login</Link>
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    padding: '1rem'
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: '#fff',
    borderRadius: '10px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    padding: '2rem'
  },
  title: { margin: 0, marginBottom: '0.5rem', color: '#1f2937' },
  subtitle: { marginTop: 0, color: '#6b7280', marginBottom: '0.5rem' },
  destination: {
    marginTop: 0,
    marginBottom: '1rem',
    color: '#374151',
    fontSize: '0.9rem',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '6px',
    padding: '0.45rem 0.6rem'
  },
  formGroup: { marginBottom: '1rem' },
  submitBtn: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#7f1d1d',
    border: '1px solid #fecaca',
    borderRadius: '0.375rem',
    padding: '0.7rem',
    marginBottom: '1rem'
  },
  backText: { marginTop: '1rem', marginBottom: 0, color: '#6b7280' },
  link: { color: '#2563eb', textDecoration: 'none', fontWeight: 600 }
};

export default VerifyLoginOtp;
