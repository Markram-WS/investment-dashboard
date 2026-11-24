/** Backend `detail` text from a failed request, or `fallback`. */
export function apiErrorDetail(error: unknown, fallback: string): string {
  const body = (error as { body?: unknown } | null)?.body;
  if (typeof body === 'string' && body) {
    try {
      const parsed = JSON.parse(body) as { detail?: unknown };
      if (typeof parsed.detail === 'string' && parsed.detail.trim()) {
        return parsed.detail;
      }
    } catch {
      // Non-JSON body: fall through to the fallback.
    }
  }
  return fallback;
}
