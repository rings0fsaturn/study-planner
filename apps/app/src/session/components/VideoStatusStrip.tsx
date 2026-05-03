import type { YouTubePlayerState } from '../YouTubePlayerAdapter';

interface VideoStatusStripProps {
  durationFormatted: string;
  playerState: YouTubePlayerState;
}

function stateLabel(state: YouTubePlayerState): string {
  switch (state) {
    case 'playing': return 'PLAYING';
    case 'paused': return 'PAUSED';
    case 'ended': return 'ENDED';
    case 'buffering': return 'PLAYING';
    default: return 'LOADING';
  }
}

export function VideoStatusStrip({ durationFormatted, playerState }: VideoStatusStripProps) {
  return (
    <div className="session-yt-status-strip">
      YOUTUBE · {durationFormatted} · {stateLabel(playerState)}
    </div>
  );
}
