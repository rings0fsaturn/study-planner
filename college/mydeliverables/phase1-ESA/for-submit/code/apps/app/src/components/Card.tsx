import { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'large' | 'inverted';
  children: ReactNode;
}

export default function Card({
  variant = 'default',
  children,
  className = '',
  ...props
}: CardProps) {
  const classes = [
    'card',
    variant !== 'default' && `card-${variant}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}