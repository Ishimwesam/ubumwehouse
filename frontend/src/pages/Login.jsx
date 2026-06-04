
import React, { useState, useEffect } from 'react';
import '../styles/neuromorphic-login.css';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { clearStoredAuthToken, resolveBackendUrl } from '../services/api';


const Login = () => {
  // Add neuromorphic background class on mount, remove on unmount
  useEffect(() => {
    document.body.classList.add('neuromorphic-bg');
    return () => {
      document.body.classList.remove('neuromorphic-bg');
    };
  }, []);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success] = useState(location.state?.success || '');

  // Handle Google OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const oauthError = params.get('error');
    if (token) {
      // Store token and reload profile
      clearStoredAuthToken();
      localStorage.setItem('token', token);
      window.history.replaceState({}, document.title, window.location.pathname); // Clean URL
      window.location.href = '/dashboard';
    } else if (oauthError) {
      if (oauthError === 'notfound') {
        setError('Your Google account is not registered. Please contact the admin for account creation.');
      } else {
        setError('Google login failed. Please try again.');
      }
      window.history.replaceState({}, document.title, window.location.pathname); // Clean URL
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {loading && <div className="generic-spinner" style={{width:72, height:72, margin:'0 auto', border:'6px solid #e0e7ef', borderTop:'6px solid #6366f1', borderRadius:'50%', animation:'spin 1s linear infinite'}} />}
      <div className="neuromorphic-login-wrapper exact-match">
        <div className="neuromorphic-login-card">
          <div className="neuromorphic-login-left">
            <h2 style={{ marginBottom: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.01em', fontWeight: 800 }}>SIGN IN TO UBUMWE HOUSE Ltd</h2>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.7rem' }}>
              <button
                className="neuromorphic-social-btn"
                title="Sign in with Google"
                onClick={async (e) => {
                  e.preventDefault();
                  setError('');
                  setLoading(true);
                  try {
                    window.location.href = resolveBackendUrl('/api/auth/google');
                  } catch (err) {
                    setError('Google login failed.');
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg" alt="Google" style={{ width: 22, height: 22 }} />
              </button>
            </div>
            {/* Only Google login is available. */}
            {/* If Google login fails or email not found, show error below */}
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
            {error && <div className="error-message">{error}</div>}
            <form className="neuromorphic-login-form" onSubmit={handleSubmit}>
              <input
                className="neuromorphic-input"
                type="email"
                placeholder="Email"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
              <input
                className="neuromorphic-input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.95rem', color: '#64748b' }}>Forgot your password?</span>
                <button type="submit" className="neuromorphic-login-btn" style={{ minWidth: 90, padding: '0.7rem 1.2rem', margin: 0 }} disabled={loading}>
                  {loading ? '...' : 'SIGN IN'}
                </button>
              </div>
            </form>
            <div className="login-links" style={{ marginTop: '0.5rem', textAlign: 'left', width: '100%' }}>
              <Link to="/forgot-password" style={{ color: '#2563eb', textDecoration: 'underline', fontSize: '0.98rem' }}>Reset here</Link>
            </div>
          </div>
          <div className="neuromorphic-login-right">
            <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1.5rem', color: '#fff' }}>Hello, Friend!</div>
             <div style={{marginTop:16, color:'#888', textAlign:'center'}}>To request access, contact the system administrator.</div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
