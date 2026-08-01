interface PauseResumeButtonProps {
  isPaused: boolean;
  onToggle: () => void;
}

export function PauseResumeButton({ isPaused, onToggle }: PauseResumeButtonProps) {
  return (
    <button className="session-pause-resume" onClick={onToggle}>
      {isPaused ? (
        <>
          <span className="session-pause-icon">▶</span>
          Resume
        </>
      ) : (
        <>
          <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Pause
        </>
      )}
    </button>
  );
}
