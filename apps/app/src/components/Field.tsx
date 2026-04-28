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

type FieldInputProps = InputHTMLAttributes<HTMLInputElement>;

export function FieldInput(props: FieldInputProps) {
  return <input className="field" {...props} />;
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