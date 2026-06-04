import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/api';
import { adminContactLinks } from '../utils/adminContact';
import useFeedbackToast from '../hooks/useFeedbackToast';

import '../../styles/copilot-forgot.css';

const MailIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);

const BuildingMark = () => (
  <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M28 66V35.6C28 33.6118 29.6118 32 31.6 32H46V66" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M46 66V24.6C46 22.6118 47.6118 21 49.6 21H63.4C65.3882 21 67 22.6118 67 24.6V66" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 66H75" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
    <path d="M56 30H57M56 39H57M56 48H57M56 57H57M37 40H38M37 49H38" stroke="white" strokeWidth="4" strokeLinecap="round"/>
  </svg>
);

const ShieldFeatureIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
  </svg>
);

const BarsFeatureIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 20V10" />
    <path d="M12 20V4" />
    <path d="M18 20v-7" />
  </svg>
);

const ClockFeatureIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

const ForgotPassword = () => {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devResetLink, setDevResetLink] = useState('');
  useFeedbackToast(error, 'error');
  useFeedbackToast(success, 'success');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setDevResetLink('');

    if (!identifier) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.forgotPassword({ identifier, method: 'email' });
      const msg = response.data?.message || 'Recovery instructions sent.';
      setSuccess(msg);
      if (response.data?.devResetLink) {
        setDevResetLink(response.data.devResetLink);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start password recovery');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.body.classList.add('copilot-forgot-bg');
    return () => document.body.classList.remove('copilot-forgot-bg');
  }, []);

  return (
    <div className="copilot-forgot-shell">
      <div className="copilot-forgot-card">
        <div className="copilot-forgot-left">
          <div className="copilot-forgot-overlay" />
          <div className="copilot-forgot-branding">
            <div className="copilot-forgot-logo">
              <BuildingMark />
            </div>
            <h1 className="copilot-forgot-title">
              UBUMWE
              <span>SYSTEM COMPANY</span>
            </h1>
            <div className="copilot-forgot-brand-divider" />
            <div className="copilot-forgot-slogan">Secure password recovery for your property management workspace</div>
          </div>
          <div className="copilot-forgot-features">
            <div className="copilot-forgot-feature">
              <span className="copilot-forgot-feature-icon"><ShieldFeatureIcon /></span>
              <div>
                <b>Secure</b>
                <span>Reset links are sent only to registered accounts</span>
              </div>
            </div>
            <div className="copilot-forgot-feature">
              <span className="copilot-forgot-feature-icon"><BarsFeatureIcon /></span>
              <div>
                <b>Guided</b>
                <span>We will guide you through the recovery process</span>
              </div>
            </div>
            <div className="copilot-forgot-feature">
              <span className="copilot-forgot-feature-icon"><ClockFeatureIcon /></span>
              <div>
                <b>Fast</b>
                <span>Get back into your account in just a few steps</span>
              </div>
            </div>
          </div>
        </div>

        <div className="copilot-forgot-right">
          <div className="copilot-forgot-formwrap">
            <div className="copilot-forgot-header">
              <h2 className="copilot-forgot-heading">Forgot Password?</h2>
              <p className="copilot-forgot-subtitle">Enter your email address and we&apos;ll send you a reset link.</p>
            </div>

            {error && <div className="copilot-forgot-error">{error}</div>}
            {success && <div className="copilot-forgot-success">{success}</div>}
            {devResetLink ? (
              <div className="copilot-forgot-devlink">
                <div className="copilot-forgot-devlink-title">Temporary Reset Link (Development)</div>
                <a href={devResetLink} className="copilot-forgot-devlink-link">
                  {devResetLink}
                </a>
              </div>
            ) : null}

            <form className="copilot-forgot-form" onSubmit={handleSubmit}>
              <div className="copilot-forgot-form-group">
                <label className="copilot-forgot-label" htmlFor="identifier">Email Address</label>
                <div className="copilot-forgot-input-wrap">
                  <span className="copilot-forgot-input-icon"><MailIcon /></span>
                  <input
                    className="copilot-forgot-input"
                    id="identifier"
                    type="email"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter your email address"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="copilot-forgot-btn" disabled={loading}>
                {loading ? 'Please wait...' : 'Send Recovery Instructions'}
              </button>
            </form>

            <div className="copilot-forgot-links">
              <p className="copilot-forgot-link-text">
                Back to <Link to="/login">Login</Link>
              </p>
              <p className="copilot-forgot-link-text">
                Need help? <a href={adminContactLinks.passwordRecovery}>Contact Administrator</a>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="copilot-forgot-copyright">
        © 2026 Ubumwe System Company. All rights reserved.
      </div>
    </div>
  );
};

export default ForgotPassword;
