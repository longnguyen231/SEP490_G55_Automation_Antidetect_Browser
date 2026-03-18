// Button Component

import React from 'react';
import styles from './Button.module.css';

/**
 * Button Component
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Button content
 * @param {'primary'|'secondary'|'success'|'danger'|'ghost'} props.variant - Button style variant
 * @param {'small'|'medium'|'large'} props.size - Button size
 * @param {boolean} props.disabled - Disable button
 * @param {boolean} props.loading - Show loading spinner
 * @param {boolean} props.fullWidth - Full width button
 * @param {boolean} props.iconOnly - Icon only button (no text)
 * @param {React.ReactNode} props.icon - Icon element
 * @param {function} props.onClick - Click handler
 * @param {string} props.type - Button type (button|submit|reset)
 * @param {string} props.className - Additional CSS classes
 */
export function Button({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  iconOnly = false,
  icon,
  onClick,
  type = 'button',
  className = '',
  ...props
}) {
  const buttonClasses = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    iconOnly && styles.iconOnly,
    loading && styles.loading,
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={buttonClasses}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      {!iconOnly && children}
    </button>
  );
}

export default Button;
