function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Keep selected keys when a later fact-find save replaces the JSON object. */
export function preserveJsonKeys(
  existing: unknown,
  incoming: Record<string, unknown> | undefined,
  keys: string[],
): Record<string, unknown> | undefined {
  if (!incoming) return incoming;
  const previous = asRecord(existing);
  if (!previous) return incoming;
  const next: Record<string, unknown> = { ...incoming };
  for (const key of keys) {
    if (next[key] === undefined && previous[key] !== undefined) next[key] = previous[key];
  }
  return next;
}
