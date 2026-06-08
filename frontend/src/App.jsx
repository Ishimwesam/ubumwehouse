import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataSyncProvider } from './context/DataSyncContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import PageLoader from './components/PageLoader';
import AppErrorBoundary from './components/AppErrorBoundary';

// Critical / public routes — eager
import CopilotLogin from './pages/CopilotLogin';
import TenantPortal from './pages/TenantPortal';

// Lazy-loaded pages — each becomes its own async chunk
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tenants = lazy(() => import('./pages/Tenants'));
const TenantLedger = lazy(() => import('./pages/TenantLedger'));
const Buildings = lazy(() => import('./pages/Buildings'));
const BuildingDetails = lazy(() => import('./pages/BuildingDetails'));
const Units = lazy(() => import('./pages/Units'));
const Contracts = lazy(() => import('./pages/Contracts'));
const Expenses = lazy(() => import('./pages/Expenses'));
const PaymentsEnhanced = lazy(() => import('./pages/PaymentsEnhanced'));
const AdvancedReports = lazy(() => import('./pages/AdvancedReports'));
const PaymentHistoryPerTenant = lazy(() => import('./pages/PaymentHistoryPerTenant'));
const ManualPaymentConfirmation = lazy(() => import('./pages/ManualPaymentConfirmation'));
const DailyIncomeSummary = lazy(() => import('./pages/DailyIncomeSummary'));
const MonthlyRentSheet = lazy(() => import('./pages/MonthlyRentSheet'));
const CalendarEvents = lazy(() => import('./pages/CalendarEvents'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const SystemHealth = lazy(() => import('./pages/SystemHealth'));
const OperationsCenter = lazy(() => import('./pages/OperationsCenter'));
const ExportCenter = lazy(() => import('./pages/ExportCenter'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const VerifyLoginOtp = lazy(() => import('./pages/VerifyLoginOtp'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const TenantPortalPayments = lazy(() => import('./pages/TenantPortalPayments'));
const TenantPortalUpload = lazy(() => import('./pages/TenantPortalUpload'));
const TenantPortalMaintenance = lazy(() => import('./pages/TenantPortalMaintenance'));
const TenantPortalMessages = lazy(() => import('./pages/TenantPortalMessages'));
const TenantPortalAnnouncements = lazy(() => import('./pages/TenantPortalAnnouncements'));
const TenantPortalProfile = lazy(() => import('./pages/TenantPortalProfile'));
const TenantPortalControl = lazy(() => import('./pages/TenantPortalControl'));

const PageFallback = () => <PageLoader text="Loading..." minHeight="60vh" />;
import { applyAppFont, getStoredAppFont } from './utils/appFont';

import './styles/globals.css';
import './styles/layout.css';
import './styles/rent-reminders.css';
import './styles/operational-ui.css';
import './styles/responsive.css';

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
      <AppErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<PageFallback />}>
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
          <Route path="/operations" element={<OperationsCenter />} />
          <Route path="/export-center" element={<ExportCenter />} />
          <Route path="/system-health" element={<SystemHealth />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/tenant-portal-control" element={withRoles(<TenantPortalControl />, ['manager', 'admin'])} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
        </Suspense>
      </AppErrorBoundary>
    </div>
  );
};

const AppRoutes = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <PageLoader text="Loading your workspace..." minHeight="100vh" />;
  }

  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route path="/login" element={<CopilotLogin />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/verify-login-otp" element={isAuthenticated ? <Navigate to="/dashboard" /> : <VerifyLoginOtp />} />
      <Route path="/forgot-password" element={isAuthenticated ? <Navigate to="/dashboard" /> : <ForgotPassword />} />
      <Route path="/reset-password" element={isAuthenticated ? <Navigate to="/dashboard" /> : <ResetPassword />} />
      <Route path="/tenant-portal" element={<TenantPortal />} />
      <Route path="/tenant-portal/payments" element={<TenantPortalPayments />} />
      <Route path="/tenant-portal/upload" element={<TenantPortalUpload />} />
      <Route path="/tenant-portal/maintenance" element={<TenantPortalMaintenance />} />
      <Route path="/tenant-portal/messages" element={<TenantPortalMessages />} />
      <Route path="/tenant-portal/announcements" element={<TenantPortalAnnouncements />} />
      <Route path="/tenant-portal/profile" element={<TenantPortalProfile />} />
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
    </Suspense>
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
