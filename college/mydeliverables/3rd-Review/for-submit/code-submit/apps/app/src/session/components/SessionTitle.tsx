interface SessionTitleProps {
  title: string;
}

export function SessionTitle({ title }: SessionTitleProps) {
  return <div className="session-title">{title}</div>;
}
