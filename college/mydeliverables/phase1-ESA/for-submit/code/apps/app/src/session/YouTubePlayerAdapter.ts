export type YouTubePlayerState = 'unstarted' | 'playing' | 'paused' | 'buffering' | 'ended' | 'cued';

export interface YouTubePlayerAdapterDeps {
  containerId: string;
  videoId: string;
  startSeconds?: number;
  onStateChange?: (state: YouTubePlayerState) => void;
  onReady?: () => void;
  onError?: (errorCode: number) => void;
}

const YT_STATE_MAP: Record<number, YouTubePlayerState> = {
  [-1]: 'unstarted',
  [0]: 'ended',
  [1]: 'playing',
  [2]: 'paused',
  [3]: 'buffering',
  [5]: 'cued',
};

export class YouTubePlayerAdapter {
  private player: YT.Player | null = null;
  private readonly deps: YouTubePlayerAdapterDeps;
  private videoPlayTimeMs = 0;
  private lastPlayStartedAt: number | null = null;
  private nowFn: () => number;

  constructor(deps: YouTubePlayerAdapterDeps, nowFn?: () => number) {
    this.deps = deps;
    this.nowFn = nowFn ?? (() => Date.now());
  }

  create(): void {
    this.player = new YT.Player(this.deps.containerId, {
      videoId: this.deps.videoId,
      playerVars: {
        autoplay: 1,
        modestbranding: 1,
        rel: 0,
        start: this.deps.startSeconds ? Math.floor(this.deps.startSeconds) : undefined,
      },
      events: {
        onReady: () => this.deps.onReady?.(),
        onStateChange: (event: YT.OnStateChangeEvent) => {
          const state = YT_STATE_MAP[event.data] ?? 'unstarted';
          this.trackPlayTime(state);
          this.deps.onStateChange?.(state);
        },
        onError: (event: YT.OnErrorEvent) => {
          this.deps.onError?.(event.data);
        },
      },
    });
  }

  play(): void {
    this.player?.playVideo();
  }

  pause(): void {
    this.player?.pauseVideo();
  }

  seekTo(seconds: number): void {
    this.player?.seekTo(seconds, true);
  }

  getCurrentTime(): number {
    return this.player?.getCurrentTime() ?? 0;
  }

  getDuration(): number {
    return this.player?.getDuration() ?? 0;
  }

  getVideoPlayTimeMs(): number {
    if (this.lastPlayStartedAt !== null) {
      return this.videoPlayTimeMs + (this.nowFn() - this.lastPlayStartedAt);
    }
    return this.videoPlayTimeMs;
  }

  destroy(): void {
    this.flushPlayTime();
    this.player?.destroy();
    this.player = null;
  }

  private trackPlayTime(state: YouTubePlayerState): void {
    if (state === 'playing') {
      this.lastPlayStartedAt = this.nowFn();
    } else if (this.lastPlayStartedAt !== null) {
      this.flushPlayTime();
    }
  }

  private flushPlayTime(): void {
    if (this.lastPlayStartedAt !== null) {
      this.videoPlayTimeMs += this.nowFn() - this.lastPlayStartedAt;
      this.lastPlayStartedAt = null;
    }
  }
}
