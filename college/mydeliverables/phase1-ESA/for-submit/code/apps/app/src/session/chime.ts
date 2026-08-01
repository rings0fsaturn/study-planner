/**
 * Web Audio API chime for Pomodoro transitions.
 *
 * AudioContext must be created from a user gesture (session start click).
 * Call createChime() once at session start, then playWorkToBreak() and
 * playBreakToWork() at transitions.
 */

interface Chime {
  playWorkToBreak: () => void;
  playBreakToWork: () => void;
}

function playTone(ctx: AudioContext, frequency: number, durationMs: number, startDelay = 0): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = frequency;

  gain.gain.setValueAtTime(0.15, ctx.currentTime + startDelay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + durationMs / 1000);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime + startDelay);
  osc.stop(ctx.currentTime + startDelay + durationMs / 1000);
}

export function createChime(ctx: AudioContext): Chime {
  return {
    playWorkToBreak() {
      // Descending two-note chime: time to rest
      playTone(ctx, 659, 300, 0);     // E5
      playTone(ctx, 523, 400, 0.15);  // C5
    },
    playBreakToWork() {
      // Ascending two-note chime: time to focus
      playTone(ctx, 523, 300, 0);     // C5
      playTone(ctx, 659, 400, 0.15);  // E5
    },
  };
}
