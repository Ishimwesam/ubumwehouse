import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/api';
import useFeedbackToast from '../hooks/useFeedbackToast';
import '../../styles/reset-password.css';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const initialIdentifier = location.state?.identifier || '';

  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(location.state?.success || '');

  useFeedbackToast(error, 'error');
  useFeedbackToast(success, 'success');

  const isEmailTokenFlow = useMemo(() => Boolean(token), [token]);

  useEffect(() => {
    document.body.classList.add('reset-password-bg');
    return () => document.body.classList.remove('reset-password-bg');
  }, []);

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
    <div className="reset-password-shell">
      <div className="reset-password-card">
        <h1 className="reset-password-title">Reset Password</h1>
        <p className="reset-password-subtitle">Set a new password for your account</p>

        {error ? <div className="reset-password-alert error">{error}</div> : null}
        {success ? <div className="reset-password-alert success">{success}</div> : null}

        <form className="reset-password-form" onSubmit={handleSubmit}>
          {!isEmailTokenFlow ? (
            <>
              <label>
                Email or Phone
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter email or phone"
                  required
                />
              </label>

              <label>
                OTP Code (6 digits)
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter OTP"
                  maxLength={6}
                  required
                />
              </label>
            </>
          ) : null}

          <label>
            New Password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
            />
          </label>

          <label>
            Confirm New Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
            />
          </label>

          <button type="submit" className="reset-password-btn" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <p className="reset-password-links">
          Back to <Link to="/dashboard">Dashboard</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
