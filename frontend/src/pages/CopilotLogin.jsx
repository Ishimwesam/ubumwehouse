import React, { useState, useEffect, useRef } from 'react';
import '../../styles/copilot-login.css';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminContactEmail, adminContactLinks } from '../utils/adminContact';
import useFeedbackToast from '../hooks/useFeedbackToast';
import AuthActionOverlay from '../components/AuthActionOverlay';

const MailIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);

const LockIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 1 1 8 0v3" />
  </svg>
);

const EyeIcon = ({ open }) => (
  open ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 3 18 18" />
      <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
      <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c6.4 0 10 7 10 7a13.16 13.16 0 0 1-4.22 4.94" />
      <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.6 7 10 7a10.94 10.94 0 0 0 4.09-.78" />
    </svg>
  )
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

const AdminIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21a8 8 0 0 0-16 0" />
    <circle cx="12" cy="8" r="4" />
  </svg>
);

const CopyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const LoginLockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 1 1 8 0v3" />
  </svg>
);

const CopilotLogin = () => {
  const LOGIN_SUCCESS_DURATION = 2800;
  const LOGIN_ERROR_DURATION = 3200;
  const navigate = useNavigate();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactCopied, setContactCopied] = useState(false);
  const [authOverlay, setAuthOverlay] = useState({ open: false, variant: 'success', message: '', userName: '' });
  const overlayTimerRef = useRef(null);
  useFeedbackToast(error, 'error');
  useFeedbackToast(info, 'info');

  useEffect(() => {
    document.body.classList.add('copilot-login-bg');
    return () => document.body.classList.remove('copilot-login-bg');
  }, []);

  useEffect(() => () => {
    if (overlayTimerRef.current) {
      clearTimeout(overlayTimerRef.current);
    }
  }, []);

  const openAuthOverlay = (variant, message, userName = '', duration = LOGIN_ERROR_DURATION) => {
    if (overlayTimerRef.current) {
      clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = null;
    }

    setAuthOverlay({
      open: true,
      variant,
      message,
      userName
    });

    overlayTimerRef.current = setTimeout(() => {
      setAuthOverlay((current) => ({ ...current, open: false }));
      overlayTimerRef.current = null;
    }, duration);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const data = await login(identifier, password, rememberMe);
      if (data?.requires_otp) {
        setLoading(false);
        setInfo(data.message || 'A login verification code has been sent.');
        navigate('/verify-login-otp', {
          state: {
            username: data.username || identifier,
            destination: data.destination,
            message: data.message,
            rememberMe
          }
        });
        return;
      }

      if (data && data.token && data.user) {
        setLoading(false);
        openAuthOverlay(
          'success',
          'You have signed in successfully. Your dashboard is ready and your workspace is opening now.',
          data.user?.full_name || data.user?.username || 'Administrator',
          LOGIN_SUCCESS_DURATION
        );
        setTimeout(() => {
          navigate('/dashboard');
        }, LOGIN_SUCCESS_DURATION);
      } else {
        setError('Invalid credentials. Please try again.');
        openAuthOverlay('error', 'The credentials you entered are not correct. Please check them and try again.', '', LOGIN_ERROR_DURATION);
        setLoading(false);
      }
    } catch (err) {
      const loginError =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Login failed. Please check your credentials.';
      setError(loginError);
      openAuthOverlay('error', loginError, '', LOGIN_ERROR_DURATION);
      setLoading(false);
    }
  };

  const handleAdminShortcut = () => {
    setIdentifier('admin');
    setPassword('');
    setError('');
    setInfo('Administrator username has been selected. Enter the admin password to continue.');
  };

  const handleCopyAdminEmail = async () => {
    try {
      await navigator.clipboard.writeText(adminContactEmail);
      setContactCopied(true);
      setInfo('Administrator email copied. Send your access request when ready.');
      setTimeout(() => setContactCopied(false), 2200);
    } catch (_) {
      window.location.href = adminContactLinks.accessRequest;
    }
  };

  return (
    <div className="copilot-login-shell">
      <AuthActionOverlay
        open={authOverlay.open}
        variant={authOverlay.variant}
        message={authOverlay.message}
        userName={authOverlay.userName}
        duration={authOverlay.variant === 'success' ? LOGIN_SUCCESS_DURATION : LOGIN_ERROR_DURATION}
      />
      <div className="copilot-login-card">
        <div className="copilot-login-left">
          <div className="copilot-login-overlay" />
          <div className="copilot-login-branding">
            <div className="copilot-login-logo">
              <BuildingMark />
            </div>
            <h1 className="copilot-login-title">
              UBUMWE
              <span>SYSTEM COMPANY</span>
            </h1>
            <div className="copilot-login-brand-divider" />
            <div className="copilot-login-slogan">Smart Property Management for a Better Tomorrow</div>
          </div>
          <div className="copilot-login-features">
            <div className="copilot-login-feature">
              <span className="copilot-login-feature-icon"><ShieldFeatureIcon /></span>
              <div>
                <b>Secure</b>
                <span>Your data is safe with us</span>
              </div>
            </div>
            <div className="copilot-login-feature">
              <span className="copilot-login-feature-icon"><BarsFeatureIcon /></span>
              <div>
                <b>Reliable</b>
                <span>Accurate and real-time information</span>
              </div>
            </div>
            <div className="copilot-login-feature">
              <span className="copilot-login-feature-icon"><ClockFeatureIcon /></span>
              <div>
                <b>Efficient</b>
                <span>Manage your properties with ease</span>
              </div>
            </div>
          </div>
        </div>
        <div className="copilot-login-right">
          <div className="copilot-login-formwrap">
            <div className="copilot-login-header">
              <h2 className="copilot-login-welcome">Welcome Back!</h2>
              <div className="copilot-login-welcome-sub">Please sign in to continue to your account</div>
            </div>

            <form className="copilot-login-form" onSubmit={handleSubmit} autoComplete="on">
              <div className={`copilot-form-group${error ? ' error' : ''}`}>
                <label className="copilot-field-label" htmlFor="identifier">Email Address</label>
                <div className="copilot-input-wrap">
                  <span className="copilot-input-icon"><MailIcon /></span>
                  <input
                    type="text"
                    id="identifier"
                    name="identifier"
                    required
                    autoComplete="username"
                    placeholder="Enter your email address"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    className="copilot-input"
                  />
                </div>
              </div>

              <div className="copilot-form-group">
                <label className="copilot-field-label" htmlFor="password">Password</label>
                <div className="copilot-input-wrap copilot-password-group">
                  <span className="copilot-input-icon"><LockIcon /></span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="copilot-input"
                  />
                  <button
                    type="button"
                    className="copilot-password-toggle"
                    aria-label="Toggle password visibility"
                    onClick={() => setShowPassword(v => !v)}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              {error && <div className="copilot-error-message">{error}</div>}
              {info && <div className="copilot-info-message">{info}</div>}

              <div className="copilot-form-options">
                <label className="copilot-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
                <Link to="/forgot-password" className="copilot-forgot-link">Forgot password?</Link>
              </div>

              <button type="submit" className="copilot-login-btn" disabled={loading}>
                <span className="copilot-login-btn-icon"><LoginLockIcon /></span>
                <span>{loading ? 'Signing in...' : 'Sign In'}</span>
              </button>

              <div className="copilot-login-divider"><span>OR</span></div>

              <button type="button" className="copilot-login-admin-btn" onClick={handleAdminShortcut}>
                <span className="copilot-login-admin-icon"><AdminIcon /></span>
                <span>Login as Admin</span>
              </button>

              <div className="copilot-login-contact">
                Don&apos;t have an account?{' '}
                <button type="button" className="copilot-login-contact-link" onClick={() => setContactOpen(true)}>
                  Contact Administrator
                </button>
              </div>
              <div style={styles.tenantPortalLinkWrap}>
                <Link to="/tenant-portal" style={styles.tenantPortalLink}>
                  Tenant self-service portal
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>

      {contactOpen ? (
        <div
          className="copilot-contact-modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setContactOpen(false);
          }}
        >
          <div className="copilot-contact-card" role="dialog" aria-modal="true" aria-labelledby="contact-admin-title">
            <div className="copilot-contact-header">
              <div>
                <span className="copilot-contact-kicker">Access request</span>
                <h2 id="contact-admin-title">Contact Administrator</h2>
              </div>
              <button type="button" className="copilot-contact-close" onClick={() => setContactOpen(false)} aria-label="Close contact dialog">
                x
              </button>
            </div>

            <div className="copilot-contact-body">
              <p>
                Send your name, phone number, and reason for access. The administrator will create your account if approved.
              </p>
              <div className="copilot-contact-email">
                <span>Administrator email</span>
                <strong>{adminContactEmail}</strong>
              </div>
              <div className="copilot-contact-actions">
                <a className="copilot-contact-primary" href={adminContactLinks.accessRequest} target="_blank" rel="noreferrer">
                  <MailIcon />
                  <span>Send Email Request</span>
                </a>
                <button type="button" className="copilot-contact-secondary" onClick={handleCopyAdminEmail}>
                  <CopyIcon />
                  <span>{contactCopied ? 'Copied' : 'Copy Email'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="copilot-login-copyright">
        © 2026 Ubumwe System Company. All rights reserved.
      </div>
    </div>
  );
};

const styles = {
  tenantPortalLinkWrap: {
    marginTop: '12px',
    textAlign: 'center'
  },
  tenantPortalLink: {
    color: '#1d4ed8',
    fontSize: '13px',
    fontWeight: 800,
    textDecoration: 'none'
  }
};

export default CopilotLogin;
