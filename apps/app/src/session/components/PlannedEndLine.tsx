interface PlannedEndLineProps {
  plannedMinutes: number;
  endsAt: Date;
  overrun?: boolean;
}

function formatTimeShort(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
}

export function PlannedEndLine({ plannedMinutes, endsAt, overrun }: PlannedEndLineProps) {
  const text = overrun
    ? `over ${plannedMinutes} min planned · ended ${formatTimeShort(endsAt)}`
    : `of ${plannedMinutes} min planned · ends ${formatTimeShort(endsAt)}`;

  return (
    <div className={`session-timer-of${overrun ? ' session-timer-of-overrun' : ''}`}>
      {text}
    </div>
  );
}
