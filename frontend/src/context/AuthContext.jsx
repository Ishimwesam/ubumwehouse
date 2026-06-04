import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, clearStoredAuthToken, getReadableApiError, getStoredAuthToken } from '../services/api';
import { emitAppToast } from './ToastContext';
import LogoutFarewellOverlay from '../components/LogoutFarewellOverlay';

const AuthContext = createContext();

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_TIME = 5 * 60 * 1000; // 5 minutes before timeout
const LOGOUT_FAREWELL_DURATION = 3200;

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getStoredAuthToken() || null);
  const [loading, setLoading] = useState(true);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [farewellOpen, setFarewellOpen] = useState(false);
  const [farewellUserName, setFarewellUserName] = useState('');
  const logoutTimerRef = useRef(null);

  const refreshProfile = useCallback(async () => {
    if (!getStoredAuthToken()) return null;

    const response = await authService.getProfile();
    setUser(response.data);
    return response.data;
  }, []);

  // Activity tracking
  const updateActivity = useCallback(() => {
    setLastActivity(Date.now());
    if (sessionWarning) {
      setSessionWarning(false);
    }
  }, [sessionWarning]);

  // Session timeout logic
  useEffect(() => {
    if (!token) return;

    const checkSession = () => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;

      if (timeSinceActivity >= SESSION_TIMEOUT) {
        // Session expired
        logout();
        emitAppToast('Your session has expired due to inactivity. Please sign in again.', 'warning');
      } else if (timeSinceActivity >= (SESSION_TIMEOUT - WARNING_TIME)) {
        // Show warning
        setSessionWarning(true);
      }
    };

    const interval = setInterval(checkSession, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [token, lastActivity]);

  // Activity event listeners
  useEffect(() => {
    if (!token) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => updateActivity();

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [token, updateActivity]);

  useEffect(() => {
    if (token) {
      // Fetch user profile
      refreshProfile()
        .then(() => {})
        .catch(() => {
          clearStoredAuthToken();
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, refreshProfile]);

  const login = async (identifier, password, rememberMe = false) => {
    try {
      // Backend expects { username: identifier, password }
      const response = await authService.login({ username: identifier, password });
      if (response.data?.requires_otp) {
        return response.data;
      }

      const { token: newToken, user: userData } = response.data;
      clearStoredAuthToken();
      if (rememberMe) {
        localStorage.setItem('token', newToken);
      } else {
        sessionStorage.setItem('token', newToken);
      }
      setToken(newToken);
      setUser(userData);
      return response.data;
    } catch (error) {
      const errorMsg = getReadableApiError(error, 'Login failed.');
      console.error('❌ AuthContext: Login error:', errorMsg);
      throw new Error(errorMsg);
    }
  };

  const verifyLoginOtp = async (identifier, otp, rememberMe = false) => {
    try {
      const response = await authService.verifyLoginOtp({ username: identifier, otp });
      const { token: newToken, user: userData } = response.data;

      clearStoredAuthToken();
      if (rememberMe) {
        localStorage.setItem('token', newToken);
      } else {
        sessionStorage.setItem('token', newToken);
      }
      setToken(newToken);
      setUser(userData);
      return response.data;
    } catch (error) {
      const errorMsg = getReadableApiError(error, 'OTP verification failed.');
      throw new Error(errorMsg);
    }
  };

  const register = async (username, email, password, full_name, phone = '') => {
    try {
      const response = await authService.register({
        username,
        email,
        password,
        full_name,
        phone
      });

      const { token: newToken, user: userData } = response.data;

      if (newToken) {
        clearStoredAuthToken();
        localStorage.setItem('token', newToken);
        setToken(newToken);
        setUser(userData);
      }

      return response.data;
    } catch (error) {
      const errorMsg = getReadableApiError(error, 'Registration failed.');
      console.error('❌ AuthContext: Register error:', errorMsg);
      throw new Error(errorMsg);
    }
  };

  const logout = useCallback(() => {
    clearStoredAuthToken();
    setToken(null);
    setUser(null);
    setSessionWarning(false);
    setLastActivity(Date.now());
  }, []);

  const logoutWithFarewell = useCallback(() => {
    if (logoutTimerRef.current) return;

    setFarewellUserName(user?.full_name || user?.username || 'Administrator');
    setFarewellOpen(true);
    setSessionWarning(false);

    logoutTimerRef.current = setTimeout(() => {
      logout();
      setFarewellOpen(false);
      setFarewellUserName('');
      logoutTimerRef.current = null;
      navigate('/login', { replace: true });
      emitAppToast('Signed out successfully. We hope to see you again soon.', 'info');
    }, LOGOUT_FAREWELL_DURATION);
  }, [logout, navigate, user]);

  const extendSession = useCallback(() => {
    setLastActivity(Date.now());
    setSessionWarning(false);
  }, []);

  useEffect(() => () => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }
  }, []);

  // Role checking functions
  const hasRole = (role) => user?.role === role;
  const hasAnyRole = (roles) => roles.includes(user?.role);
  const isAdmin = () => user?.role === 'admin';
  const isManager = () => user?.role === 'manager' || user?.role === 'admin';
  const isUser = () => user?.role === 'user' || user?.role === 'manager' || user?.role === 'admin';

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      login, 
      verifyLoginOtp,
      register, 
      logout, 
      logoutWithFarewell,
      isAuthenticated,
      sessionWarning,
      extendSession,
      timeRemaining: token ? Math.max(0, SESSION_TIMEOUT - (Date.now() - lastActivity)) : 0,
      hasRole,
      hasAnyRole,
      isAdmin,
      isManager,
      isUser,
      refreshProfile
    }}>
      {children}
      <LogoutFarewellOverlay open={farewellOpen} userName={farewellUserName} />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
