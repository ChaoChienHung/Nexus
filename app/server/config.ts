import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { VaultOption } from './types';

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
): { apiUrl: string | null; appUrl: string | null; source: 'env' | 'dotenv' | 'unset' } {
  const readAppUrl = (parsedDotenv?: Record<string, string>) => {
    const raw = env.MENTORION_APP_URL?.trim() || parsedDotenv?.MENTORION_APP_URL?.trim();
    return raw ? normalizeBaseUrl(raw) : 'http://localhost:5173';
  };

  const envVal = env.MENTORION_API_URL?.trim();
  if (envVal) {
    return { apiUrl: normalizeBaseUrl(envVal), appUrl: readAppUrl(), source: 'env' };
  }
  const envPort = env.MENTORION_PORT?.trim();
  if (envPort) {
    return { apiUrl: `http://localhost:${envPort}`, appUrl: readAppUrl(), source: 'env' };
  }

  for (const filename of ['.env.local', '.env']) {
    const parsed = parseEnvFile(path.join(appDir, filename));
    const fileVal = parsed.MENTORION_API_URL?.trim();
    if (fileVal) {
      return { apiUrl: normalizeBaseUrl(fileVal), appUrl: readAppUrl(parsed), source: 'dotenv' };
    }
    const filePort = parsed.MENTORION_PORT?.trim();
    if (filePort) {
      return {
        apiUrl: `http://localhost:${filePort}`,
        appUrl: readAppUrl(parsed),
        source: 'dotenv',
      };
    }
  }

  return { apiUrl: null, appUrl: null, source: 'unset' };
}

interface StoredVaultEntry {
  label: string;
  path: string;
}

function getCustomVaultsFile(appDir: string): string {
  return path.join(appDir, '.generated', 'vaults.json');
}

function readCustomVaults(appDir: string): StoredVaultEntry[] {
  const filePath = getCustomVaultsFile(appDir);
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as StoredVaultEntry[];
    return Array.isArray(parsed) ? parsed.filter((v) => v && typeof v.path === 'string') : [];
  } catch {
    return [];
  }
}

export function saveCustomVault(appDir: string, vaultPath: string, label?: string): VaultOption {
  const resolved = expandPath(vaultPath.trim(), appDir);
  const resolvedLabel = label?.trim() || path.basename(resolved) || resolved;
  const existing = readCustomVaults(appDir).filter((v) => path.resolve(v.path) !== resolved);
  existing.push({ label: resolvedLabel, path: resolved });

  const filePath = getCustomVaultsFile(appDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(existing, null, 2)}\n`, 'utf-8');

  return {
    label: resolvedLabel,
    path: resolved,
    exists: fs.existsSync(resolved),
  };
}

/**
 * Lists all known Nexus vaults: active vault, env/dotenv NEXUS_VAULTS, saved custom vaults,
 * and the built-in demo `../knowledge` dataset.
 */
export function resolveVaultOptions(
  appDir: string,
  activeKnowledgeDir: string,
  env: NodeJS.ProcessEnv = process.env,
): VaultOption[] {
  const seen = new Map<string, VaultOption>();
  const defaultDemoDir = path.resolve(appDir, '../knowledge');

  const addOption = (rawPath: string, label?: string, isDefault = false) => {
    const resolved = expandPath(rawPath, appDir);
    if (seen.has(resolved)) return;
    seen.set(resolved, {
      label: label?.trim() || (resolved === defaultDemoDir ? 'Nexus Demo (knowledge/)' : path.basename(resolved)),
      path: resolved,
      exists: fs.existsSync(resolved),
      isDefault,
    });
  };

  addOption(activeKnowledgeDir, activeKnowledgeDir === defaultDemoDir ? 'Nexus Demo (knowledge/)' : path.basename(activeKnowledgeDir));

  // Parse optional NEXUS_VAULTS="Work=/path/a,Personal=/path/b" from env or .env.local/.env
  const vaultStrings: string[] = [];
  if (env.NEXUS_VAULTS?.trim()) vaultStrings.push(env.NEXUS_VAULTS.trim());
  for (const filename of ['.env.local', '.env']) {
    const parsed = parseEnvFile(path.join(appDir, filename));
    if (parsed.NEXUS_VAULTS?.trim()) vaultStrings.push(parsed.NEXUS_VAULTS.trim());
  }
  for (const rawList of vaultStrings) {
    for (const part of rawList.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        addOption(trimmed.slice(eq + 1).trim(), trimmed.slice(0, eq).trim());
      } else {
        addOption(trimmed);
      }
    }
  }

  for (const entry of readCustomVaults(appDir)) {
    addOption(entry.path, entry.label);
  }

  addOption(defaultDemoDir, 'Nexus Demo (knowledge/)', true);

  return Array.from(seen.values());
}
