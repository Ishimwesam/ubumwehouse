import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataSyncProvider } from './context/DataSyncContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import CopilotLogin from './pages/CopilotLogin';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Tenants from './pages/Tenants';
import TenantLedger from './pages/TenantLedger';
import Buildings from './pages/Buildings';
import BuildingDetails from './pages/BuildingDetails';
import Units from './pages/Units';
import Contracts from './pages/Contracts';
import Expenses from './pages/Expenses';
import PaymentsEnhanced from './pages/PaymentsEnhanced';
import AdvancedReports from './pages/AdvancedReports';
import PaymentHistoryPerTenant from './pages/PaymentHistoryPerTenant';
import ManualPaymentConfirmation from './pages/ManualPaymentConfirmation';
import DailyIncomeSummary from './pages/DailyIncomeSummary';
import MonthlyRentSheet from './pages/MonthlyRentSheet';
import CalendarEvents from './pages/CalendarEvents';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import VerifyEmail from './pages/VerifyEmail';
import VerifyLoginOtp from './pages/VerifyLoginOtp';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { applyAppFont, getStoredAppFont } from './utils/appFont';

import './styles/globals.css';
import './styles/layout.css';
import './styles/rent-reminders.css';
import './styles/operational-ui.css';

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
};

const ProtectedPageRoutes = () => {
  const location = useLocation();

  const withRoles = (element, allowedRoles) => (
    <ProtectedRoute allowedRoles={allowedRoles}>
      {element}
    </ProtectedRoute>
  );

  return (
    <div className="page-transition-shell">
      <Routes location={location}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tenants" element={<Tenants />} />
        <Route path="/tenants/reminders" element={<Tenants reminderWindowOnly />} />
        <Route path="/tenants/:id/ledger" element={<TenantLedger />} />
        <Route path="/buildings" element={<Buildings />} />
        <Route path="/buildings/:id" element={<BuildingDetails />} />
        <Route path="/units" element={<Units />} />
        <Route path="/contracts" element={<Contracts />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/payments" element={<PaymentsEnhanced />} />
        <Route path="/advanced-reports" element={<AdvancedReports />} />
        <Route path="/payment-history" element={<PaymentHistoryPerTenant />} />
        <Route path="/manual-confirmation" element={withRoles(<ManualPaymentConfirmation />, ['manager', 'admin'])} />
        <Route path="/daily-income" element={withRoles(<DailyIncomeSummary />, ['manager', 'admin'])} />
        <Route path="/monthly-rent-sheet" element={<MonthlyRentSheet />} />
        <Route path="/calendar-events" element={<CalendarEvents />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </div>
  );
};

const AppRoutes = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<CopilotLogin />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/verify-login-otp" element={isAuthenticated ? <Navigate to="/dashboard" /> : <VerifyLoginOtp />} />
      <Route path="/forgot-password" element={isAuthenticated ? <Navigate to="/dashboard" /> : <ForgotPassword />} />
      <Route path="/reset-password" element={isAuthenticated ? <Navigate to="/dashboard" /> : <ResetPassword />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <ProtectedPageRoutes />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const App = () => {
  React.useEffect(() => {
    applyAppFont(getStoredAppFont());
  }, []);

  return (
    <Router future={routerFuture}>
      <AuthProvider>
        <ToastProvider>
          <DataSyncProvider>
            <AppRoutes />
          </DataSyncProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
