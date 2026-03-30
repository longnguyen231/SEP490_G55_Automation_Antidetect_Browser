// Card Component

import React from 'react';
import styles from './Card.module.css';

/**
 * Card Component
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Card content
 * @param {string} props.title - Card title
 * @param {string} props.subtitle - Card subtitle
 * @param {React.ReactNode} props.header - Custom header content
 * @param {React.ReactNode} props.footer - Footer content
 * @param {boolean} props.interactive - Make card clickable
 * @param {function} props.onClick - Click handler
 * @param {'outlined'|'elevated'|'flat'} props.variant - Card style variant
 * @param {boolean} props.compact - Compact padding
 * @param {string} props.className - Additional CSS classes
 */
export function Card({
  children,
  title,
  subtitle,
  header,
  footer,
  interactive = false,
  onClick,
  variant = 'outlined',
  compact = false,
  className = '',
  ...props
}) {
  const cardClasses = [
    styles.card,
    styles[variant],
    interactive && styles.interactive,
    className
  ].filter(Boolean).join(' ');

  const handleClick = () => {
    if (interactive && onClick) {
      onClick();
    }
  };

  return (
    <div 
      className={cardClasses} 
      onClick={handleClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      {...props}
    >
      {(header || title) && (
        <div className={styles.header}>
          {header || (
            <>
              {title && <h3 className={styles.title}>{title}</h3>}
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </>
          )}
        </div>
      )}
      
      <div className={`${styles.body} ${compact ? styles.compact : ''}`}>
        {children}
      </div>
      
      {footer && (
        <div className={styles.footer}>
          {footer}
        </div>
      )}
    </div>
  );
}

export default Card;
