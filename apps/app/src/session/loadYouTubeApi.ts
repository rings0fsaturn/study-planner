let loadPromise: Promise<void> | null = null;

export function loadYouTubeApi(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('loadYouTubeApi requires a browser environment'));
      return;
    }

    if (window.YT?.Player) {
      resolve();
      return;
    }

    const existing = document.getElementById('youtube-iframe-api');
    if (existing) {
      const prev = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      return;
    }

    (window as any).onYouTubeIframeAPIReady = () => resolve();

    const script = document.createElement('script');
    script.id = 'youtube-iframe-api';
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load YouTube IFrame API'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
