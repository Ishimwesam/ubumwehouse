import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/api';
import useFeedbackToast from '../hooks/useFeedbackToast';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const initialIdentifier = location.state?.identifier || '';
  const initialMethod = location.state?.method || (token ? 'email' : 'sms');

  const [method, setMethod] = useState(initialMethod);
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(location.state?.success || '');
  useFeedbackToast(error, 'error');
  useFeedbackToast(success, 'success');

  const isEmailTokenFlow = useMemo(() => !!token && method !== 'sms', [token, method]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Please enter and confirm the new password');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      if (isEmailTokenFlow) {
        await authService.resetPassword({ token, newPassword });
      } else {
        await authService.resetPasswordOtp({ identifier, otp, newPassword });
      }

      setSuccess('Password updated successfully');
      setTimeout(() => {
        navigate('/login', {
          state: { success: 'Password updated successfully. Please log in.' }
        });
      }, 1300);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Reset Password</h1>
        <p style={styles.subtitle}>Set a new password for your account</p>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        <form onSubmit={handleSubmit}>
          {!isEmailTokenFlow && (
            <>
              <div style={styles.formGroup}>
                <label>Email or Phone</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter email or phone"
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label>OTP Code (6 digits)</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter OTP"
                  maxLength={6}
                  required
                />
              </div>
            </>
          )}

          <div style={styles.formGroup}>
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
            />
          </div>

          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <p style={styles.linkText}>
          Back to <Link to="/dashboard" style={styles.link}>Dashboard</Link>
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
    maxWidth: '460px',
    backgroundColor: '#fff',
    borderRadius: '10px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    padding: '2rem'
  },
  title: { margin: 0, marginBottom: '0.5rem', color: '#1f2937' },
  subtitle: { marginTop: 0, marginBottom: '1.2rem', color: '#6b7280' },
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
  success: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    border: '1px solid #a7f3d0',
    borderRadius: '0.375rem',
    padding: '0.7rem',
    marginBottom: '1rem'
  },
  linkText: { marginTop: '1rem', marginBottom: 0, color: '#6b7280' },
  link: { color: '#2563eb', textDecoration: 'none', fontWeight: 600 }
};

export default ResetPassword;
