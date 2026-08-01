// PROTOTYPE — throwaway. Props every variant receives. The host owns the session state
// (editor text, test results, the hint engine) so switching variants compares the SAME
// underlying practice session — only the hint SURFACE changes.
import type { PracticeExample } from './hint-ladders';
import type { HintEngine } from './useHintEngine';

export interface TestResult {
  name: string;
  input: string;
  passed: boolean;
  detail: string;
}

export interface VariantProps {
  example: PracticeExample;
  value: string;
  onChange: (v: string) => void;
  onActivity: () => void;
  onStuck: () => void;
  onRun: () => void;
  running: boolean;
  results: TestResult[] | null;
  engine: HintEngine;
}
