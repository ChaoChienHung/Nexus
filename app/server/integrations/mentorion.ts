import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { MentorionCapability } from '../types';

export const DEFAULT_MENTORION_RUNTIME_FILE = path.join(
  os.homedir(),
  '.mentorion',
  'runtime.json',
);

export interface MentorionRuntimeInfo {
  apiUrl: string | null;
  appUrl: string | null;
}

export function readMentorionRuntimeFile(
  runtimeFilePath: string = DEFAULT_MENTORION_RUNTIME_FILE,
): MentorionRuntimeInfo | null {
  try {
    if (!fs.existsSync(runtimeFilePath)) return null;
    const raw = JSON.parse(fs.readFileSync(runtimeFilePath, 'utf-8')) as {
      api_url?: string;
      app_url?: string;
    };
    const apiUrl = raw.api_url?.trim().replace(/\/+$/, '') || null;
    const appUrl = raw.app_url?.trim().replace(/\/+$/, '') || null;
    if (!apiUrl && !appUrl) return null;
    return { apiUrl, appUrl };
  } catch {
    return null;
  }
}

export function resolveLiveMentorionEndpoints(
  fallbackApiUrl: string | null,
  fallbackAppUrl: string | null,
  runtimeFilePath: string = DEFAULT_MENTORION_RUNTIME_FILE,
): MentorionRuntimeInfo {
  const runtime = readMentorionRuntimeFile(runtimeFilePath);
  return {
    apiUrl: runtime?.apiUrl ?? fallbackApiUrl ?? null,
    appUrl: runtime?.appUrl ?? fallbackAppUrl ?? null,
  };
}

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
