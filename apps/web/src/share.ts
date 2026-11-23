/**
 * Text received through the Web Share Target (Google Maps "Share" -> this app).
 * Reads it once and removes the query so a reload does not re-trigger it.
 */
export function takeSharedText(): string | null {
  const params = new URLSearchParams(window.location.search);
  const parts: string[] = [];
  for (const k of ['title', 'text', 'url']) {
    const v = params.get(k)?.trim();
    if (v && !parts.some((p) => p.includes(v))) parts.push(v);
  }
  if (parts.length === 0) return null;
  history.replaceState(null, '', window.location.pathname + window.location.hash);
  return parts.join('\n');
}
