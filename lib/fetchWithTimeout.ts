/**
 * Shared request-timeout helper for the customer app.
 *
 * React Native uses `whatwg-fetch` (via XHR) for the global `fetch()`. When the
 * backend is unreachable or the network is down, that XHR can hang for a very
 * long time before finally rejecting with a generic "Network request failed",
 * which leaves screens stuck in an endless loading state.
 *
 * This wrapper binds a hard timeout to every API request via `AbortController`
 * so a broken connection fails fast instead of hanging indefinitely. On a
 * healthy network the timeout is far above a normal API response time and never
 * fires, so production behavior is unchanged.
 *
 * The timeout is controlled by `EXPO_PUBLIC_API_TIMEOUT` (milliseconds) and
 * defaults to 30000ms (30s) when unset or invalid.
 */

const DEFAULT_API_TIMEOUT_MS = 30000;

function parseTimeoutMs(value: string | undefined, fallbackMs: number): number {
  if (!value) {
    return fallbackMs;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackMs;
  }

  return Math.round(parsed);
}

// Read once at startup (Expo inlines EXPO_PUBLIC_* env vars at build time, so
// the value is static for a given build).
const API_REQ_TIMEOUT_MS = parseTimeoutMs(
  process.env.EXPO_PUBLIC_API_TIMEOUT,
  DEFAULT_API_TIMEOUT_MS
);

/**
 * Runs the global `fetch()` with a hard timeout.
 *
 * Returns the same `Response` as `fetch()` when the request completes normally.
 * On timeout the underlying XHR is aborted, which surfaces as a thrown error so
 * callers can fail fast into a user-facing error state.
 */
export async function fetchWithTimeout(
  input: string | RequestInfo,
  init?: RequestInit
): Promise<Response> {
  if (typeof AbortController === 'undefined') {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_REQ_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}