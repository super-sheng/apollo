import React, { ButtonHTMLAttributes } from 'react';

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const GradientButton: React.FC<GradientButtonProps> = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...rest
}) => {
  return (
    <button
      type={type}
      className={`gradient-button ${variant} ${size} ${fullWidth ? 'full-width' : ''} ${className}`}
      {...rest}
    >
      <div className="gradient-button-background"></div>
      <span className="gradient-button-text">{children}</span>
      <div className="gradient-button-shine"></div>
    </button>
  );
};

export default GradientButton;