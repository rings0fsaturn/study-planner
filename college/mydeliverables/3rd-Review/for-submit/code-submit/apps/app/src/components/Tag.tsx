import { HTMLAttributes, ReactNode } from 'react';

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'moss' | 'rust' | 'terracotta';
  size?: 'sm';
  children: ReactNode;
}

export default function Tag({
  variant = 'default',
  size,
  children,
  className = '',
  ...props
}: TagProps) {
  const classes = [
    'tag',
    variant !== 'default' && `tag-${variant}`,
    size && `tag-${size}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}