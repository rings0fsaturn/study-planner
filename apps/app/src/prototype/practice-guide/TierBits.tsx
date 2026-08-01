// PROTOTYPE — throwaway. Tiny shared display bits used by all three variants.
import type { HintKind, PracticeExample } from './hint-ladders';

export function KindChip({ kind }: { kind: HintKind }) {
  const label =
    kind === 'nudge' ? 'Nudge'
    : kind === 'hint' ? 'Hint'
    : kind === 'targeted' ? 'Targeted'
    : 'Reveal (gated)';
  return (
    <span className="pgp-kind" data-kind={kind}>
      {label}
    </span>
  );
}

/** Progress through the escalation ladder: filled up to and including the current tier. */
export function LadderDots({
  example,
  tierIndex,
}: {
  example: PracticeExample;
  tierIndex: number;
}) {
  return (
    <span className="pgp-ladder-dots" title={`Tier ${tierIndex + 1} of ${example.ladder.length}`}>
      {example.ladder.map((t, i) => (
        <span className="pgp-dot" key={t.tier} data-on={i <= tierIndex} />
      ))}
    </span>
  );
}
