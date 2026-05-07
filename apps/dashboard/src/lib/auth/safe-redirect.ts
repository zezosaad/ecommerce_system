/**
 * Returns `path` only if it is a same-origin relative URL (e.g. `/foo` or
 * `/en/users`). Anything else — protocol-relative `//evil.com`, absolute
 * `https://evil.com`, or empty — falls back to `fallback`. Prevents open
 * redirect via the `?return=` query param after login.
 */
export function safeReturnPath(
  path: string | null | undefined,
  fallback: string,
): string {
  if (!path) return fallback;
  if (!path.startsWith('/')) return fallback;
  if (path.startsWith('//')) return fallback;
  // Reject control characters or whitespace that could trick downstream
  // routers.
  if (/[\s\\]/.test(path)) return fallback;
  return path;
}
