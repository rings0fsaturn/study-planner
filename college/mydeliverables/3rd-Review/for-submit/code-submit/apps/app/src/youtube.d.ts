interface YTPlayerOptions {
  videoId: string;
  playerVars?: {
    autoplay?: number;
    modestbranding?: number;
    rel?: number;
    start?: number;
  };
  events?: {
    onReady?: () => void;
    onStateChange?: (event: YT.OnStateChangeEvent) => void;
    onError?: (event: YT.OnErrorEvent) => void;
  };
}

declare namespace YT {
  class Player {
    constructor(elementId: string, options: YTPlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    getCurrentTime(): number;
    getDuration(): number;
    destroy(): void;
  }
  interface OnStateChangeEvent {
    data: number;
  }
  interface OnErrorEvent {
    data: number;
  }
}

interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
