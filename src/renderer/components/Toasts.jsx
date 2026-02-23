import React from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import './Toasts.css';

const ICONS = {
  success: <CheckCircle size={16} />,
  error: <AlertCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
};

export default function Toasts({ toasts = [], onDismiss }) {
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map(t => (
        <div key={t.id} className={`toast-item toast-${t.variant || 'info'}`} role="status" onClick={() => onDismiss && onDismiss(t.id)}>
          {ICONS[t.variant] || ICONS.info}
          <span style={{ flex: 1 }}>{t.message}</span>
          <X size={14} style={{ opacity: 0.6, cursor: 'pointer', flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); onDismiss && onDismiss(t.id); }} />
        </div>
      ))}
    </div>
  );
}
