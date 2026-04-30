interface EndSessionButtonProps {
  onEnd: () => void;
  disabled?: boolean;
}

export function EndSessionButton({ onEnd, disabled }: EndSessionButtonProps) {
  return (
    <button
      className="btn btn-accent btn-block btn-lg session-end-inline"
      onClick={onEnd}
      disabled={disabled}
    >
      End session
    </button>
  );
}
