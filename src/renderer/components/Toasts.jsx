import React from 'react';
import './Toasts.css';

export default function Toasts({ toasts = [], onDismiss }) {
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.variant || 'info'}`} role="status" onClick={() => onDismiss && onDismiss(t.id)}>
          <span className="toast-message">{t.message}</span>
          <button className="toast-close" aria-label="Close" onClick={(e)=>{ e.stopPropagation(); onDismiss && onDismiss(t.id); }}>×</button>
        </div>
      ))}
    </div>
  );
}
