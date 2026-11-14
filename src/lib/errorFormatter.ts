function isObjectLike(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null;
}

function cleanReadableString(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed === '[object Object]' || trimmed === '[object Error]') {
    return null;
  }
  // Never leak raw HTML error pages to user-facing text
  if (/^<!doctype\s+html|^<html[\s>]/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Recursively extracts a human-readable message from arbitrary JS errors,
 * Axios/Fetch response payloads, Vercel error objects, or Gemini API errors.
 * Never returns "[object Object]".
 */
export function extractErrorMessage(err: unknown, depth = 0): string | null {
  if (err === null || err === undefined || depth > 5) return null;

  if (typeof err === 'string') {
    return cleanReadableString(err);
  }

  if (typeof err === 'number' || typeof err === 'boolean') {
    return String(err);
  }

  if (Array.isArray(err)) {
    const parts = err
      .map((item) => extractErrorMessage(item, depth + 1))
      .filter((s): s is string => Boolean(s));
    return parts.length > 0 ? parts.join('; ') : null;
  }

  if (err instanceof Error) {
    const direct = cleanReadableString(err.message);
    if (direct) return direct;
    const errAny = err as Error & { cause?: unknown; response?: { data?: unknown }; details?: unknown };
    return (
      extractErrorMessage(errAny.cause, depth + 1) ||
      extractErrorMessage(errAny.response?.data, depth + 1) ||
      extractErrorMessage(errAny.details, depth + 1)
    );
  }

  if (isObjectLike(err)) {
    // Priority order for nested API / Vercel / Gemini error structures
    const candidates: unknown[] = [
      isObjectLike(err.error) ? err.error.message : undefined,
      err.error,
      err.message,
      isObjectLike(err.response) ? err.response.data : undefined,
      isObjectLike(err.data) ? err.data.error ?? err.data.message : undefined,
      err.details,
      err.reason,
      err.statusText,
    ];

    for (const candidate of candidates) {
      const extracted = extractErrorMessage(candidate, depth + 1);
      if (extracted) return extracted;
    }

    if (typeof err.code === 'string' && err.code.trim()) {
      return `Terjadi kendala (${err.code.trim()}).`;
    }
    if (typeof err.status === 'number' && err.status >= 400) {
      return `Permintaan server gagal (HTTP ${err.status}).`;
    }
  }

  return null;
}

export function formatSafeError(err: unknown, fallback: string): string {
  const extracted = extractErrorMessage(err);
  if (!extracted) return fallback;
  return extracted;
}

export function serializeErrorForLog(err: unknown): string {
  if (err instanceof Error) {
    return JSON.stringify({
      name: err.name,
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 4).join(' | '),
    });
  }
  try {
    return JSON.stringify(err);
  } catch {
    return extractErrorMessage(err) || 'Unserializable error object';
  }
}
