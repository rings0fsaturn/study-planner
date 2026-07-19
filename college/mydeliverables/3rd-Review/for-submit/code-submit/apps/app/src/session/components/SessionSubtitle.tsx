interface SessionSubtitleProps {
  subtitle: string;
}

export function SessionSubtitle({ subtitle }: SessionSubtitleProps) {
  return <div className="session-subtitle">{subtitle}</div>;
}
