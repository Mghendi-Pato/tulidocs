/**
 * Thin fetch wrapper over the same-origin /api proxy.
 * Unwraps `{ data }` envelopes and turns error bodies into ApiError with a human message.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function qs(query?: Query) {
  if (!query) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Set while logging out, so a background request that fails with 401 doesn't show "session ended" instead of "logged out". */
let loggingOut = false;
export function markLoggingOut() {
  loggingOut = true;
}

/** Pages anyone can open — a 401 there is normal (not signed in), so don't bounce to the login page */
function isPublicPage() {
  const p = window.location.pathname;
  return p === '/' || ['/login', '/signup', '/create', '/payment', '/pricing', '/feedback'].some((x) => p.startsWith(x));
}

async function request<T>(method: string, path: string, body?: unknown, raw = false): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0, 'NETWORK');
  }

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON (e.g. proxy error page) */
  }

  if (!res.ok) {
    const err = (json ?? {}) as { message?: string; code?: string; details?: unknown };
    if (res.status === 401 && !loggingOut && typeof window !== 'undefined' && !path.startsWith('/auth/') && !isPublicPage()) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login/?expired=1&next=${next}`;
    }
    const fallback = res.status >= 500 ? 'Something went wrong on the server. Please try again.' : 'Request failed';
    throw new ApiError(err.message ?? fallback, res.status, err.code ?? 'ERROR', err.details);
  }
  if (raw) return json as T;
  return (json as { data: T } | null)?.data as T;
}

/** Binary download (e.g. a PDF). Errors are parsed like any other API error. */
async function blob(path: string): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { credentials: 'same-origin' });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0, 'NETWORK');
  }
  if (res.ok) return res.blob();
  let err: { message?: string; code?: string } = {};
  try {
    err = await res.json();
  } catch {
    /* non-JSON */
  }
  throw new ApiError(err.message ?? 'Could not download the file', res.status, err.code ?? 'ERROR');
}

/** POST that returns a binary (the live preview image). Aborts cleanly when a newer preview starts. */
async function blobPost(path: string, body: unknown, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (res.ok) return res.blob();
  let err: { message?: string; code?: string; details?: unknown } = {};
  try {
    err = await res.json();
  } catch {
    /* non-JSON */
  }
  throw new ApiError(err.message ?? 'Preview failed', res.status, err.code ?? 'ERROR', err.details);
}

/** Saves a downloaded blob as a file */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', `${path}${qs(query)}`),
  /** Returns the full envelope — for paginated lists that need `meta`. */
  page: <T>(path: string, query?: Query) => request<T>('GET', `${path}${qs(query)}`, undefined, true),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, form),
  blob,
  blobPost,
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
