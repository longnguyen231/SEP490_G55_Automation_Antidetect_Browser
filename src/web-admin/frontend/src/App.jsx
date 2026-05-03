import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ConfigProvider } from 'antd';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/Dashboard';
import OrdersPage from './pages/Orders';
import LicensesPage from './pages/Licenses';
import UsersPage from './pages/Users';
import ConfigPage from './pages/Config';
import ReleasesPage from './pages/Releases';
import LandingPage from './pages/Landing';
import LoginPage from './pages/Auth/Login';
import RegisterPage from './pages/Auth/Register';
import ForgotPasswordPage from './pages/Auth/ForgotPassword';
import { AdminRoute, GuestRoute, UserRoute } from './components/ProtectedRoute';
import { useAuthStore } from './store/authStore';
import CheckoutPage from './pages/Checkout';
import CheckoutSuccessPage from './pages/Checkout/Success';
import MyLicensePage from './pages/MyLicense';

// ─── Full-screen maintenance page ─────────────────────────────────────────────
function MaintenancePage({ banner }) {
  return (
    <div className="min-h-screen bg-[#080a0c] flex items-center justify-center p-4 font-sans">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-amber-400 text-5xl">construction</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Under Maintenance</h1>
        <p className="text-white/50 text-sm leading-relaxed">
          {banner || 'We are performing scheduled maintenance. Please check back soon.'}
        </p>
        <p className="text-white/20 text-xs mt-6">HL-MCK Browser</p>
      </div>
    </div>
  );
}

function App() {
  const { user, isAuthenticated, loading } = useAuthStore();
  const [maintenance, setMaintenance] = useState({ maintenanceMode: false, maintenanceBanner: '' });

  useEffect(() => {
    const check = () =>
      fetch('/api/status').then(r => r.json()).then(setMaintenance).catch(() => {});
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  // Block authenticated non-admin users when maintenance is on
  // (unauthenticated users still reach /login so admin can sign in)
  if (!loading && maintenance.maintenanceMode && isAuthenticated && user?.role !== 'admin') {
    return <MaintenancePage banner={maintenance.maintenanceBanner} />;
  }

  return (
    <ConfigProvider theme={{ token: { fontFamily: '"Inter", sans-serif' } }}>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{ className: 'dark:bg-slate-800 dark:text-white border border-primary/20' }}
        />
        <Routes>
          {/* ── Public ───────────────────────────────────────────────────── */}
          <Route path="/" element={<LandingPage />} />

          {/* ── Checkout (requires login) ───────────────────────────────── */}
          <Route path="/checkout" element={<UserRoute><CheckoutPage /></UserRoute>} />
          <Route path="/checkout/success" element={<UserRoute><CheckoutSuccessPage /></UserRoute>} />
          <Route path="/my-license" element={<UserRoute><MyLicensePage /></UserRoute>} />

          {/* ── Auth (guest-only, redirect if already logged in) ─────────── */}
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />

          {/* ── Admin dashboard (requires role === 'admin') ──────────────── */}
          <Route path="/dashboard" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="licenses" element={<LicensesPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="releases" element={<ReleasesPage />} />
            <Route path="config" element={<ConfigPage />} />
          </Route>

          {/* ── Fallback ──────────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
