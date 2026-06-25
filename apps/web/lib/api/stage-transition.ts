import type { CaseStage } from '@ko/types';

const STAGE_ORDER: CaseStage[] = [
  'ENQUIRY',
  'FACT_FIND',
  'RESEARCH',
  'DIP',
  'OFFER',
  'COMPLETION',
  'ARCHIVED',
];

/** Returns an error message when the transition is not allowed, otherwise null. */
export function validateStageTransition(from: CaseStage, to: CaseStage): string | null {
  if (from === to) return null;
  if (to === 'ARCHIVED') return null;

  const fromIdx = STAGE_ORDER.indexOf(from);
  const toIdx = STAGE_ORDER.indexOf(to);
  if (fromIdx < 0 || toIdx < 0) return 'Invalid pipeline stage';

  // Allow moving backward; block skipping forward more than one stage.
  if (toIdx > fromIdx && toIdx - fromIdx > 1) {
    return 'Cannot skip pipeline stages';
  }

  return null;
}
