// useToast Hook - Toast notification management

import { useState, useCallback } from 'react';
import { TOAST_TYPES } from '@utils/constants';

/**
 * Hook for managing toast notifications
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  /**
   * Add toast notification
   */
  const addToast = useCallback((message, type = TOAST_TYPES.SUCCESS, duration = 3000) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type, createdAt: Date.now() };
    
    setToasts(prev => [...prev, toast]);
    
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    
    return id;
  }, []);

  /**
   * Remove toast by ID
   */
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  /**
   * Clear all toasts
   */
  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  /**
   * Convenience methods
   */
  const success = useCallback((message, duration) => {
    return addToast(message, TOAST_TYPES.SUCCESS, duration);
  }, [addToast]);

  const error = useCallback((message, duration) => {
    return addToast(message, TOAST_TYPES.ERROR, duration);
  }, [addToast]);

  const warning = useCallback((message, duration) => {
    return addToast(message, TOAST_TYPES.WARNING, duration);
  }, [addToast]);

  const info = useCallback((message, duration) => {
    return addToast(message, TOAST_TYPES.INFO, duration);
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts,
    success,
    error,
    warning,
    info
  };
}
