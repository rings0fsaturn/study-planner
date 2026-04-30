interface ComeBackLaterButtonProps {
  onComeBackLater: () => void;
}

export function ComeBackLaterButton({ onComeBackLater }: ComeBackLaterButtonProps) {
  return (
    <button
      className="btn btn-ghost btn-block session-come-back"
      onClick={onComeBackLater}
    >
      I'll come back later
    </button>
  );
}
