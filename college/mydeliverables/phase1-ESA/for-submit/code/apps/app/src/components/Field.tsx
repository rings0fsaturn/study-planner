import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

interface FieldGroupProps {
  children: ReactNode;
}

export function FieldGroup({ children }: FieldGroupProps) {
  return <div className="field-group">{children}</div>;
}

interface FieldLabelProps {
  children: ReactNode;
  htmlFor?: string;
}

export function FieldLabel({ children, htmlFor }: FieldLabelProps) {
  return (
    <label className="field-label" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

interface FieldInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function FieldInput({ error, className, ...props }: FieldInputProps) {
  const classes = ['field', error && 'has-error', className].filter(Boolean).join(' ');
  return <input className={classes} {...props} />;
}

type FieldTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function FieldTextarea(props: FieldTextareaProps) {
  return <textarea className="field field-textarea" {...props} />;
}

interface FieldHelperProps {
  children: ReactNode;
  error?: boolean;
}

export function FieldHelper({ children, error }: FieldHelperProps) {
  return <p className={`field-helper ${error ? 'error' : ''}`}>{children}</p>;
}