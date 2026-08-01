// PROTOTYPE — throwaway. Answers wayfinder ticket #17 (inline-hint live guide).
// Scripted tiered-Socratic hint ladders. In production these come from the LLM guide
// (grounded via RAG, #18) — here they are canned so the prototype answers a UX question,
// not a model-quality one. The LADDER SHAPE is the real contract: every tier escalates
// but NEVER hands the answer until the final `reveal` tier, which is explicitly gated.

export type HintKind = 'nudge' | 'hint' | 'targeted' | 'reveal';

export interface HintTier {
  tier: number;
  kind: HintKind;
  /** Full Socratic text — shown in the rail (B) and popover (C). */
  text: string;
  /** Short inline form — the ghost text that renders in the editor (A). A question/nudge, never code. */
  ghost: string;
  /** For the reveal tier only: the concrete answer, framed as "one way", shown after the gate. */
  revealBody?: string;
}

export interface PracticeExample {
  id: 'coding' | 'written';
  family: string; // #11 question family
  label: string;
  prompt: string;
  /** Editor seed — a plausible learner attempt that is wrong / incomplete. */
  starter: string;
  language?: string;
  lineNumbers: boolean;
  /** The line the learner is most likely stuck on — where the guide anchors first. */
  defaultActiveLine: number;
  /** Coding only: the mock test run outcome that fires the failed-test trigger. */
  testRun?: {
    cases: { name: string; input: string; passed: boolean; detail: string }[];
  };
  ladder: HintTier[];
}

export const CODING_EXAMPLE: PracticeExample = {
  id: 'coding',
  family: 'coding · implement_fn',
  label: 'Coding',
  prompt:
    'Write is_palindrome(s) — return True if the string reads the same forwards and backwards, ignoring letter case and any non-alphanumeric characters.',
  language: 'python',
  lineNumbers: true,
  defaultActiveLine: 4, // the `cleaned += c` line — where the bug lives
  starter: `def is_palindrome(s):
    cleaned = ""
    for c in s:
        cleaned += c
    return cleaned == cleaned[::-1]
`,
  testRun: {
    cases: [
      { name: 'racecar', input: "'racecar'", passed: true, detail: 'True == True' },
      { name: 'hello', input: "'hello'", passed: true, detail: 'False == False' },
      {
        name: 'phrase',
        input: "'A man, a plan, a canal: Panama'",
        passed: false,
        detail: 'got False, expected True',
      },
      {
        name: 'mixed case',
        input: "'Noon'",
        passed: false,
        detail: 'got False, expected True',
      },
    ],
  },
  ladder: [
    {
      tier: 0,
      kind: 'nudge',
      text: "For 'A man, a plan, a canal: Panama', cleaned keeps every space, comma and capital letter — so it can't match its reverse. The fix is on this line. What does it currently do to each character c?",
      ghost: "Line 4 keeps every character — spaces, commas, capitals. That's why it can't match its reverse.",
    },
    {
      tier: 1,
      kind: 'hint',
      text: "Two kinds of characters break it: punctuation and spaces, which should be dropped; and capitals like the 'A' in 'Panama', which should be lowercased so 'A' counts the same as 'a'. This line does neither yet — it just copies c straight in.",
      ghost: "Drop spaces & punctuation, and lowercase capitals so 'A' matches 'a'. This line does neither yet.",
    },
    {
      tier: 2,
      kind: 'targeted',
      text: 'So before you add c, do two things: skip it unless it is a letter or digit, and lowercase it. Python gives you c.isalnum() (True for letters and digits) and c.lower(). Wrap the append in an if, and lowercase what you add.',
      ghost: 'Before adding c: skip it unless c.isalnum(), and add c.lower(). Wrap the append in an if.',
    },
    {
      tier: 3,
      kind: 'reveal',
      text: 'You have the two steps. If you want to check your version against one worked loop, you can reveal it — but try writing it yourself first.',
      ghost: 'Reveal one worked version of this loop? (try it yourself first)',
      revealBody: `    for c in s:
        if c.isalnum():
            cleaned += c.lower()
    return cleaned == cleaned[::-1]`,
    },
  ],
};

export const WRITTEN_EXAMPLE: PracticeExample = {
  id: 'written',
  family: 'written · short_answer',
  label: 'Written',
  prompt:
    'Explain why binary search requires the array to be sorted. Answer in 3-4 sentences.',
  lineNumbers: false,
  defaultActiveLine: 1,
  starter: 'Binary search needs sorted data because it is faster that way.',
  ladder: [
    {
      tier: 0,
      kind: 'nudge',
      text: "Your sentence says it is faster, but the question is why sorting is *required for it to work at all*. Focus on the one move binary search makes each step: it checks the middle element, then throws away half the array.",
      ghost: "You've said why it's faster; the question is why sorting is *required to work*. Think about the 'throw away half' step.",
    },
    {
      tier: 1,
      kind: 'hint',
      text: 'When it discards half the range, it is assuming the target cannot possibly be in that half. That assumption is only safe if the array has one particular property. What property lets you rule out a whole half after a single comparison?',
      ghost: 'Discarding half assumes the target is not there. That is only safe given one property — which?',
    },
    {
      tier: 2,
      kind: 'targeted',
      text: 'That property is order. In a sorted array, everything left of the middle is smaller and everything right is larger, so one comparison safely rules out a whole side. Now say what would break if it were unsorted — and you have answered the "why".',
      ghost: 'The property is order: sorted means left is smaller, right is larger, so a side is safe to drop. Say what breaks unsorted.',
    },
    {
      tier: 3,
      kind: 'reveal',
      text: 'You have the pieces. If you want to compare against one strong reference answer, you can reveal it — this is a model to check your reasoning against, not to copy.',
      ghost: 'Reveal one strong reference answer? (a model to check against, not to copy)',
      revealBody:
        'Binary search works by repeatedly comparing the target to the middle element and discarding the half that cannot contain it. This discard step is only valid if the array is sorted, because sorting guarantees every element left of the middle is smaller and every element to the right is larger. Without that ordering, a smaller target could still lie in the discarded half, so the algorithm would miss it. Sorting is therefore not an optimization but a correctness precondition.',
    },
  ],
};

export const EXAMPLES: PracticeExample[] = [CODING_EXAMPLE, WRITTEN_EXAMPLE];
