import { useEffect, useRef } from 'react';
import { YouTubePlayerAdapter, type YouTubePlayerState } from '../YouTubePlayerAdapter';
import { loadYouTubeApi } from '../loadYouTubeApi';

interface YouTubeEmbedProps {
  videoId: string;
  startSeconds?: number;
  onStateChange?: (state: YouTubePlayerState) => void;
  onReady?: () => void;
  onError?: (errorCode: number) => void;
  adapterRef?: React.MutableRefObject<YouTubePlayerAdapter | null>;
}

let embedCounter = 0;

export function YouTubeEmbed({
  videoId,
  startSeconds,
  onStateChange,
  onReady,
  onError,
  adapterRef,
}: YouTubeEmbedProps) {
  const containerIdRef = useRef(`yt-embed-${++embedCounter}`);

  useEffect(() => {
    let adapter: YouTubePlayerAdapter | null = null;
    let destroyed = false;

    const init = async () => {
      try {
        await loadYouTubeApi();
      } catch {
        onError?.(0);
        return;
      }

      if (destroyed) return;

      adapter = new YouTubePlayerAdapter({
        containerId: containerIdRef.current,
        videoId,
        startSeconds,
        onStateChange,
        onReady,
        onError,
      });

      if (adapterRef) {
        adapterRef.current = adapter;
      }

      adapter.create();
    };

    init();

    return () => {
      destroyed = true;
      adapter?.destroy();
      if (adapterRef) {
        adapterRef.current = null;
      }
    };
  }, [videoId]);

  return (
    <div className="session-yt-embed-container">
      <div id={containerIdRef.current} />
    </div>
  );
}
