import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * AdminRoute — only allows users with role === 'admin'.
 * Unauthenticated → redirect to /login (with returnTo state).
 * Authenticated but not admin → redirect to / (landing).
 */
export const AdminRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
};

/**
 * UserRoute — requires any authenticated user (admin or regular).
 * Unauthenticated → redirect to /login (with returnTo so user comes back after login).
 */
export const UserRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuthStore();
  const location = useLocation();

  // Still restoring session — don't redirect yet
  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

/**
 * GuestRoute — redirect away if already logged in.
 * Admin → /dashboard, regular user → / (landing).
 * Used for /login and /register so authenticated users don't see them again.
 */
export const GuestRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to={user?.role === 'admin' ? '/dashboard' : '/'} replace />;
  }

  return children;
};
