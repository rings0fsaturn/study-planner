import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'accent' | 'primary' | 'secondary' | 'ghost' | 'ghost-dark' | 'destructive';
  size?: 'sm' | 'lg';
  block?: boolean;
  children: ReactNode;
}

export default function Button({
  variant = 'primary',
  size,
  block = false,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size && `btn-${size}`,
    block && 'btn-block',
    className
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}