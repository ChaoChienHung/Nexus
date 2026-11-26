import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }

  return out;
}

function expandPath(rawPath: string, baseDir: string): string {
  const expanded = rawPath.startsWith('~/')
    ? path.join(os.homedir(), rawPath.slice(2))
    : rawPath === '~'
      ? os.homedir()
      : rawPath;
  return path.resolve(baseDir, expanded);
}

/**
 * Resolves the active Nexus knowledge directory in priority order:
 * 1. Shell environment variable `NEXUS_KNOWLEDGE_DIR`
 * 2. `NEXUS_KNOWLEDGE_DIR` inside `app/.env.local` (or `app/.env`)
 * 3. Default built-in `../knowledge` relative to `appDir`
 */
export function resolveKnowledgeDir(
  appDir: string,
  env: NodeJS.ProcessEnv = process.env,
): { knowledgeDir: string; source: 'env' | 'dotenv' | 'default' } {
  const envVal = env.NEXUS_KNOWLEDGE_DIR?.trim();
  if (envVal) {
    return {
      knowledgeDir: expandPath(envVal, appDir),
      source: 'env',
    };
  }

  for (const filename of ['.env.local', '.env']) {
    const parsed = parseEnvFile(path.join(appDir, filename));
    const fileVal = parsed.NEXUS_KNOWLEDGE_DIR?.trim();
    if (fileVal) {
      return {
        knowledgeDir: expandPath(fileVal, appDir),
        source: 'dotenv',
      };
    }
  }

  return {
    knowledgeDir: path.resolve(appDir, '../knowledge'),
    source: 'default',
  };
}

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

/**
 * Resolves the optional Mentorion API base URL in priority order:
 * 1. Shell environment variable `MENTORION_API_URL`
 * 2. `MENTORION_API_URL` inside `app/.env.local` (or `app/.env`)
 * 3. `null` (standalone Nexus mode)
 */
export function resolveMentorionConfig(
  appDir: string,
  env: NodeJS.ProcessEnv = process.env,
): { apiUrl: string | null; source: 'env' | 'dotenv' | 'unset' } {
  const envVal = env.MENTORION_API_URL?.trim();
  if (envVal) {
    return { apiUrl: normalizeBaseUrl(envVal), source: 'env' };
  }
  const envPort = env.MENTORION_PORT?.trim();
  if (envPort) {
    return { apiUrl: `http://localhost:${envPort}`, source: 'env' };
  }

  for (const filename of ['.env.local', '.env']) {
    const parsed = parseEnvFile(path.join(appDir, filename));
    const fileVal = parsed.MENTORION_API_URL?.trim();
    if (fileVal) {
      return { apiUrl: normalizeBaseUrl(fileVal), source: 'dotenv' };
    }
    const filePort = parsed.MENTORION_PORT?.trim();
    if (filePort) {
      return { apiUrl: `http://localhost:${filePort}`, source: 'dotenv' };
    }
  }

  return { apiUrl: null, source: 'unset' };
}
