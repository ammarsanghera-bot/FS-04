export function positionBetween(before: number | null, after: number | null) {
  if (before == null && after == null) return 1024;
  if (before == null) return (after as number) - 1024;
  if (after == null) return before + 1024;
  return (before + after) / 2;
}
