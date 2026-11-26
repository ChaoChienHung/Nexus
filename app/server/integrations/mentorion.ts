import type { MentorionCapability } from '../types';

export type FetchLike = (
  input: string,
  init?: { method?: string; signal?: AbortSignal; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number }>;

async function pingEndpoint(
  url: string,
  timeoutMs: number,
  fetchImpl: FetchLike,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { method: 'GET', signal: controller.signal });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probes a configured Mentorion backend with a short timeout so Nexus startup
 * never blocks when Mentorion is offline.
 * Checks `/health` first and falls back to `/` for compatibility with Mentorion v1.
 */
export async function probeMentorion(
  apiUrl: string | null,
  options: { timeoutMs?: number; fetchImpl?: FetchLike } = {},
): Promise<MentorionCapability> {
  const checkedAt = new Date().toISOString();
  if (!apiUrl) {
    return {
      configured: false,
      online: false,
      apiUrl: null,
      checkedAt,
    };
  }

  const timeoutMs = options.timeoutMs ?? 400;
  const fetchImpl: FetchLike = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const base = apiUrl.replace(/\/+$/, '');

  const healthRes = await pingEndpoint(`${base}/health`, timeoutMs, fetchImpl);
  if (healthRes.ok) {
    return {
      configured: true,
      online: true,
      apiUrl: base,
      checkedAt,
    };
  }

  // Fallback to root `/` when `/health` returns 404 (e.g. current Mentorion FastAPI root)
  if (healthRes.status === 404) {
    const rootRes = await pingEndpoint(`${base}/`, timeoutMs, fetchImpl);
    if (rootRes.ok) {
      return {
        configured: true,
        online: true,
        apiUrl: base,
        checkedAt,
      };
    }
    return {
      configured: true,
      online: false,
      apiUrl: base,
      checkedAt,
      error: rootRes.error ?? `HTTP ${rootRes.status}`,
    };
  }

  return {
    configured: true,
    online: false,
    apiUrl: base,
    checkedAt,
    error: healthRes.error ?? (healthRes.status ? `HTTP ${healthRes.status}` : 'Unreachable'),
  };
}
