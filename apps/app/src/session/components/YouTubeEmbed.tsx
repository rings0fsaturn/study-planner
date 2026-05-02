import { useRef, useEffect, useCallback } from 'react';

interface YTPlayer {
  destroy(): void;
  pauseVideo(): void;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
}

interface YTPlayerEvent {
  target: YTPlayer;
}

interface YTOnStateChangeEvent {
  data: number;
}

interface YTPlayerConstructorOptions {
  videoId: string;
  playerVars?: Record<string, number>;
  events?: {
    onReady?: (event: YTPlayerEvent) => void;
    onStateChange?: (event: YTOnStateChangeEvent) => void;
  };
}

interface YTNamespace {
  Player: new (element: HTMLElement, options: YTPlayerConstructorOptions) => YTPlayer;
  PlayerState: { PAUSED: number };
}

declare global {
  interface Window {
    YT: YTNamespace;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

const apiLoadQueue: Array<() => void> = [];
let scriptInjected = false;

function isApiReady(): boolean {
  return !!(window.YT?.Player);
}

interface YouTubeEmbedProps {
  videoId: string;
  initialSeekPosition?: number;
  onTimeUpdate?: (seconds: number) => void;
  paused?: boolean;
}

export function YouTubeEmbed({
  videoId,
  initialSeekPosition,
  onTimeUpdate,
  paused = false,
}: YouTubeEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

  const createPlayer = useCallback(() => {
    if (!containerRef.current || playerRef.current) return;

    playerRef.current = new window.YT.Player(containerRef.current, {
      videoId,
      playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: (event: YTPlayerEvent) => {
          if (initialSeekPosition && initialSeekPosition > 0) {
            event.target.seekTo(initialSeekPosition, true);
          }

          pollingRef.current = setInterval(() => {
            if (playerRef.current) {
              const time = playerRef.current.getCurrentTime?.();
              if (time != null) onTimeUpdateRef.current?.(time);
            }
          }, 1000);
        },
        onStateChange: (event: YTOnStateChangeEvent) => {
          if (event.data === window.YT.PlayerState.PAUSED && playerRef.current) {
            const time = playerRef.current.getCurrentTime?.();
            if (time != null) onTimeUpdateRef.current?.(time);
          }
        },
      },
    });
  }, [videoId, initialSeekPosition]);

  useEffect(() => {
    if (isApiReady()) {
      createPlayer();
    } else {
      apiLoadQueue.push(createPlayer);

      if (!scriptInjected && !window.YT) {
        const existingCallback = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          existingCallback?.();
          apiLoadQueue.forEach(fn => fn());
          apiLoadQueue.length = 0;
        };

        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
        scriptInjected = true;
      }
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [createPlayer]);

  useEffect(() => {
    if (!playerRef.current) return;
    if (paused) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, [paused]);

  return <div ref={containerRef} className="video-embed" />;
}
