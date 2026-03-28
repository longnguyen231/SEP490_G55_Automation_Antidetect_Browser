// Toast Component

import React, { useState, useEffect } from 'react';
import styles from './Toast.module.css';

/**
 * Single Toast Item
 */
function ToastItem({ id, message, type, onClose, duration }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => {
      onClose(id);
    }, 200); // Match animation duration
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path d="M16.667 5L7.5 14.167 3.333 10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'error':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path d="M15 5L5 15M5 5l10 10" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      case 'warning':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path d="M10 6v4m0 4h.01M4.93 15h10.14a2 2 0 001.73-3L11.73 4a2 2 0 00-3.46 0L3.2 12a2 2 0 001.73 3z" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      case 'info':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <circle cx="10" cy="10" r="8" strokeWidth="2"/>
            <path d="M10 10v4m0-8h.01" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`${styles.toast} ${styles[type]} ${exiting ? styles.exiting : ''}`}>
      <div className={`${styles.icon} ${styles[type]}`}>
        {getIcon()}
      </div>
      <div className={styles.content}>
        <div className={styles.message}>{message}</div>
      </div>
      <button className={styles.closeButton} onClick={handleClose} aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
          <path d="M15 5L5 15M5 5l10 10" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

/**
 * Toast Container Component
 * 
 * @param {Object} props
 * @param {Array} props.toasts - Array of toast objects { id, message, type, duration }
 * @param {function} props.onClose - Close handler
 */
export function ToastContainer({ toasts = [], onClose }) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.toastContainer}>
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration || 3000}
          onClose={onClose}
        />
      ))}
    </div>
  );
}

export default ToastContainer;
