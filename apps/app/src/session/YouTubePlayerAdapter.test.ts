import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YouTubePlayerAdapter, type YouTubePlayerAdapterDeps, type YouTubePlayerState } from './YouTubePlayerAdapter';

let capturedOptions: YTPlayerOptions | null = null;
let fakePlayerInstance: Record<string, unknown>;

function installFakeYT() {
  fakePlayerInstance = {
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    seekTo: vi.fn(),
    getCurrentTime: vi.fn(() => 42),
    getDuration: vi.fn(() => 252),
    destroy: vi.fn(),
  };

  Object.defineProperty(globalThis, 'YT', {
    configurable: true,
    writable: true,
    value: {
      Player: class FakePlayer {
        constructor(_el: string, opts: YTPlayerOptions) {
          capturedOptions = opts;
          Object.assign(this, fakePlayerInstance);
        }
      },
    },
  });
}

function makeDeps(overrides?: Partial<YouTubePlayerAdapterDeps>): YouTubePlayerAdapterDeps {
  return {
    containerId: 'yt-container',
    videoId: 'dQw4w9WgXcQ',
    ...overrides,
  };
}

describe('YouTubePlayerAdapter', () => {
  beforeEach(() => {
    capturedOptions = null;
    installFakeYT();
  });

  it('create() instantiates YT.Player with correct videoId and autoplay', () => {
    const adapter = new YouTubePlayerAdapter(makeDeps());
    adapter.create();

    expect(capturedOptions).not.toBeNull();
    expect(capturedOptions!.videoId).toBe('dQw4w9WgXcQ');
    expect(capturedOptions!.playerVars?.autoplay).toBe(1);
    expect(capturedOptions!.playerVars?.rel).toBe(0);

    adapter.destroy();
  });

  it('create() passes startSeconds when provided', () => {
    const adapter = new YouTubePlayerAdapter(makeDeps({ startSeconds: 130.7 }));
    adapter.create();

    expect(capturedOptions!.playerVars?.start).toBe(130);

    adapter.destroy();
  });

  it('play() calls playVideo on the player', () => {
    const adapter = new YouTubePlayerAdapter(makeDeps());
    adapter.create();
    adapter.play();

    expect(fakePlayerInstance.playVideo).toHaveBeenCalledOnce();

    adapter.destroy();
  });

  it('pause() calls pauseVideo on the player', () => {
    const adapter = new YouTubePlayerAdapter(makeDeps());
    adapter.create();
    adapter.pause();

    expect(fakePlayerInstance.pauseVideo).toHaveBeenCalledOnce();

    adapter.destroy();
  });

  it('seekTo() calls seekTo with allowSeekAhead=true', () => {
    const adapter = new YouTubePlayerAdapter(makeDeps());
    adapter.create();
    adapter.seekTo(90);

    expect(fakePlayerInstance.seekTo).toHaveBeenCalledWith(90, true);

    adapter.destroy();
  });

  it('getCurrentTime() returns player value', () => {
    const adapter = new YouTubePlayerAdapter(makeDeps());
    adapter.create();

    expect(adapter.getCurrentTime()).toBe(42);

    adapter.destroy();
  });

  it('getCurrentTime() returns 0 before create', () => {
    const adapter = new YouTubePlayerAdapter(makeDeps());
    expect(adapter.getCurrentTime()).toBe(0);
  });

  it('getDuration() returns player value', () => {
    const adapter = new YouTubePlayerAdapter(makeDeps());
    adapter.create();

    expect(adapter.getDuration()).toBe(252);

    adapter.destroy();
  });

  it('onReady callback fires when player is ready', () => {
    const onReady = vi.fn();
    const adapter = new YouTubePlayerAdapter(makeDeps({ onReady }));
    adapter.create();

    capturedOptions!.events!.onReady!();
    expect(onReady).toHaveBeenCalledOnce();

    adapter.destroy();
  });

  it('onStateChange maps YT state codes to string states', () => {
    const states: YouTubePlayerState[] = [];
    const adapter = new YouTubePlayerAdapter(makeDeps({
      onStateChange: (s) => states.push(s),
    }));
    adapter.create();

    const fire = (code: number) =>
      capturedOptions!.events!.onStateChange!({ data: code });

    fire(-1); // unstarted
    fire(1);  // playing
    fire(2);  // paused
    fire(3);  // buffering
    fire(0);  // ended
    fire(5);  // cued

    expect(states).toEqual([
      'unstarted', 'playing', 'paused', 'buffering', 'ended', 'cued',
    ]);

    adapter.destroy();
  });

  it('onError callback fires with error code', () => {
    const onError = vi.fn();
    const adapter = new YouTubePlayerAdapter(makeDeps({ onError }));
    adapter.create();

    capturedOptions!.events!.onError!({ data: 150 });
    expect(onError).toHaveBeenCalledWith(150);

    adapter.destroy();
  });

  it('destroy() calls player.destroy()', () => {
    const adapter = new YouTubePlayerAdapter(makeDeps());
    adapter.create();
    adapter.destroy();

    expect(fakePlayerInstance.destroy).toHaveBeenCalledOnce();
  });

  describe('video play time tracking', () => {
    it('accumulates play time while state is PLAYING', () => {
      let now = 1000;
      const adapter = new YouTubePlayerAdapter(makeDeps(), () => now);
      adapter.create();

      const fire = (code: number) =>
        capturedOptions!.events!.onStateChange!({ data: code });

      fire(1); // playing at t=1000
      now = 11_000; // 10s later
      fire(2); // paused at t=11000

      expect(adapter.getVideoPlayTimeMs()).toBe(10_000);

      adapter.destroy();
    });

    it('does not accumulate time while paused', () => {
      let now = 1000;
      const adapter = new YouTubePlayerAdapter(makeDeps(), () => now);
      adapter.create();

      const fire = (code: number) =>
        capturedOptions!.events!.onStateChange!({ data: code });

      fire(1); // playing
      now = 6_000; // 5s playing
      fire(2); // paused

      now = 20_000; // 14s paused — should not count
      expect(adapter.getVideoPlayTimeMs()).toBe(5_000);

      adapter.destroy();
    });

    it('accumulates across multiple play/pause cycles', () => {
      let now = 0;
      const adapter = new YouTubePlayerAdapter(makeDeps(), () => now);
      adapter.create();

      const fire = (code: number) =>
        capturedOptions!.events!.onStateChange!({ data: code });

      fire(1); now = 5_000; fire(2);  // 5s play
      now = 10_000;                    // 5s pause
      fire(1); now = 18_000; fire(2); // 8s play

      expect(adapter.getVideoPlayTimeMs()).toBe(13_000);

      adapter.destroy();
    });

    it('getVideoPlayTimeMs includes in-flight play time', () => {
      let now = 0;
      const adapter = new YouTubePlayerAdapter(makeDeps(), () => now);
      adapter.create();

      capturedOptions!.events!.onStateChange!({ data: 1 }); // playing
      now = 3_000;

      expect(adapter.getVideoPlayTimeMs()).toBe(3_000);

      adapter.destroy();
    });

    it('destroy flushes in-flight play time', () => {
      let now = 0;
      const adapter = new YouTubePlayerAdapter(makeDeps(), () => now);
      adapter.create();

      capturedOptions!.events!.onStateChange!({ data: 1 }); // playing
      now = 7_000;
      adapter.destroy();

      expect(adapter.getVideoPlayTimeMs()).toBe(7_000);
    });
  });
});
