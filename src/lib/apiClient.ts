export class ApiClientError extends Error {
  status: number;
  endpoint: string;
  code?: string;
  needsConfig?: boolean;

  constructor(
    message: string,
    opts: { status: number; endpoint: string; code?: string; needsConfig?: boolean }
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = opts.status;
    this.endpoint = opts.endpoint;
    this.code = opts.code;
    this.needsConfig = opts.needsConfig;
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

function mapStatusToFriendlyMessage(status: number, isNonJson: boolean): string {
  if (status === 404) {
    return 'Koneksi ke server sedang bermasalah (layanan belum ditemukan). Coba lagi, ya!';
  }
  if (status === 429) {
    return 'Wah, kuota request AI lagi padat nih! Silakan coba beberapa saat lagi.';
  }
  if (status === 503) {
    return isNonJson
      ? 'Server AI sedang belum tersedia sementara. Silakan coba beberapa saat lagi.'
      : 'Konfigurasi AI belum tersedia. Hubungi administrator aplikasi.';
  }
  if (status === 502 || status === 504) {
    return 'AI belum bisa memproses permintaanmu tepat waktu. Silakan coba beberapa saat lagi.';
  }
  if (status >= 500) {
    return 'Koneksi ke server sedang bermasalah. Coba lagi, ya!';
  }
  return 'AI belum bisa memproses permintaanmu. Silakan coba beberapa saat lagi.';
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, timeoutMs = 45000 } = options;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new ApiClientError('Kamu sedang offline nih. Cek koneksi internetmu lalu coba lagi, ya!', {
      status: 0,
      endpoint,
      code: 'OFFLINE',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        Accept: 'application/json',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    console.error('[PINDAMAI API Network Error]', {
      endpoint,
      method,
      timeout: isAbort,
      error: err,
    });
    throw new ApiClientError(
      isAbort
        ? 'Permintaan ke AI memakan waktu terlalu lama. Coba lagi, ya!'
        : 'Koneksi ke server sedang bermasalah. Coba lagi, ya!',
      {
        status: 0,
        endpoint,
        code: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
      }
    );
  } finally {
    clearTimeout(timer);
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const rawText = await res.text();
  const trimmed = rawText.trim();

  if (!trimmed) {
    console.error('[PINDAMAI API Empty Response]', {
      endpoint,
      status: res.status,
      contentType,
    });
    throw new ApiClientError(mapStatusToFriendlyMessage(res.status, true), {
      status: res.status,
      endpoint,
      code: 'EMPTY_RESPONSE',
    });
  }

  const looksLikeJson =
    contentType.includes('application/json') ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[');

  if (!looksLikeJson) {
    console.error('[PINDAMAI API Non-JSON Response]', {
      endpoint,
      status: res.status,
      contentType,
      bodyPreview: trimmed.slice(0, 300),
    });
    throw new ApiClientError(mapStatusToFriendlyMessage(res.status, true), {
      status: res.status,
      endpoint,
      code: 'NON_JSON_RESPONSE',
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (parseErr) {
    console.error('[PINDAMAI API Malformed JSON]', {
      endpoint,
      status: res.status,
      contentType,
      parseError: parseErr,
      bodyPreview: trimmed.slice(0, 300),
    });
    throw new ApiClientError('Koneksi ke server sedang bermasalah. Coba lagi, ya!', {
      status: res.status,
      endpoint,
      code: 'MALFORMED_JSON',
    });
  }

  if (!res.ok) {
    const errPayload = parsed as { error?: string; code?: string; needsConfig?: boolean };
    console.error('[PINDAMAI API Error Response]', {
      endpoint,
      status: res.status,
      code: errPayload?.code,
      error: errPayload?.error,
    });
    const friendly =
      errPayload?.code === 'GEMINI_API_KEY_MISSING'
        ? 'Konfigurasi AI belum tersedia. Hubungi administrator aplikasi.'
        : errPayload?.error || mapStatusToFriendlyMessage(res.status, false);

    throw new ApiClientError(friendly, {
      status: res.status,
      endpoint,
      code: errPayload?.code,
      needsConfig: errPayload?.needsConfig,
    });
  }

  return parsed as T;
}
