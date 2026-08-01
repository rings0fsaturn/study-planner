// PROTOTYPE — throwaway. The shared trigger + escalation state machine that all three
// variants drive. This IS the behavioural contract the #17 decision locks:
//   - hybrid on-demand triggers: explicit "I'm stuck" + cheap signals (idle timer, failed test)
//     that OFFER a hint (never force one).
//   - tiered-Socratic escalation: nudge -> hint -> targeted -> reveal.
//   - the guide NEVER hands over the answer: the final `reveal` tier is gated behind an
//     explicit confirm, so no variant can show finished code/prose without a deliberate act.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PracticeExample, HintTier } from './hint-ladders';

export type EngineStatus =
  | 'idle' // nothing on screen
  | 'offered' // a trigger fired; we are OFFERING a hint, user hasn't accepted
  | 'active'; // user accepted; a tier is showing

export type TriggerKind = 'idle' | 'failedRun' | 'stuck';

const IDLE_MS = 12000; // demo-friendly; production would tune this

export interface HintEngine {
  status: EngineStatus;
  trigger: TriggerKind | null;
  tier: HintTier | null;
  tierIndex: number;
  atReveal: boolean; // current tier is the gated reveal tier
  revealed: boolean; // user passed the gate; revealBody may show
  lastCount: number; // how many tiers remain to escalate through
  // trigger sources
  offer: (t: TriggerKind) => void;
  poke: () => void; // called on user activity — resets the idle timer, clears a stale idle-offer
  // user actions on the hint surface
  accept: () => void; // offered -> active (tier 0)
  next: () => void; // escalate one tier (won't cross the reveal gate)
  confirmReveal: () => void; // the explicit gate for the final tier
  dismiss: () => void; // back to idle
}

export function useHintEngine(example: PracticeExample): HintEngine {
  const [status, setStatus] = useState<EngineStatus>('idle');
  const [trigger, setTrigger] = useState<TriggerKind | null>(null);
  const [tierIndex, setTierIndex] = useState(-1);
  const [revealed, setRevealed] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // reset everything when the example changes
  useEffect(() => {
    setStatus('idle');
    setTrigger(null);
    setTierIndex(-1);
    setRevealed(false);
  }, [example.id]);

  const clearIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
  }, []);

  const offer = useCallback(
    (t: TriggerKind) => {
      setStatus((s) => {
        // only OFFER if nothing is already on screen (an active hint isn't interrupted)
        if (s === 'idle') {
          setTrigger(t);
          return 'offered';
        }
        return s;
      });
    },
    [],
  );

  const armIdle = useCallback(() => {
    clearIdle();
    idleTimer.current = setTimeout(() => offer('idle'), IDLE_MS);
  }, [clearIdle, offer]);

  // arm the idle timer on mount / example change
  useEffect(() => {
    armIdle();
    return clearIdle;
  }, [armIdle, clearIdle, example.id]);

  const poke = useCallback(() => {
    // user is active again: dismiss a stale idle-offer, re-arm the timer
    setStatus((s) => (s === 'offered' && trigger === 'idle' ? 'idle' : s));
    armIdle();
  }, [armIdle, trigger]);

  const accept = useCallback(() => {
    clearIdle();
    setStatus('active');
    setTierIndex(0);
    setRevealed(false);
  }, [clearIdle]);

  const next = useCallback(() => {
    setTierIndex((i) => {
      const lastIndex = example.ladder.length - 1;
      // stop AT the reveal tier — crossing into showing its body needs confirmReveal()
      return Math.min(i + 1, lastIndex);
    });
  }, [example.ladder.length]);

  const confirmReveal = useCallback(() => setRevealed(true), []);

  const dismiss = useCallback(() => {
    setStatus('idle');
    setTrigger(null);
    setTierIndex(-1);
    setRevealed(false);
    armIdle();
  }, [armIdle]);

  const tier = tierIndex >= 0 ? example.ladder[tierIndex] : null;
  const atReveal = tier?.kind === 'reveal';

  return {
    status,
    trigger,
    tier,
    tierIndex,
    atReveal,
    revealed,
    lastCount: example.ladder.length - 1 - tierIndex,
    offer,
    poke,
    accept,
    next,
    confirmReveal,
    dismiss,
  };
}

export function triggerLabel(t: TriggerKind | null): string {
  switch (t) {
    case 'idle':
      return "You've paused for a bit";
    case 'failedRun':
      return 'Two tests just failed';
    case 'stuck':
      return 'You asked for a hand';
    default:
      return '';
  }
}
