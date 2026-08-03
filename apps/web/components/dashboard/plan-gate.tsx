/**
 * ARCHIVED — legacy plan-gate wrapper for old React dashboard section pages.
 * Plan gating for live features remains in LiveDemoPage / hooks.
 * Full prior implementation is preserved in git history.
 */
export function PlanGate({
  children,
}: {
  feature?: string;
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
