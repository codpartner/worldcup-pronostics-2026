export function maskName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "*****";

  const visibleChars = Math.max(1, Math.min(3, Math.ceil(trimmed.length / 4)));
  return `${trimmed.slice(0, visibleChars)}*****`;
}
