import React from 'react';
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
import CheckoutPage from './pages/Checkout';
import CheckoutSuccessPage from './pages/Checkout/Success';
import MyLicensePage from './pages/MyLicense';

function App() {
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
