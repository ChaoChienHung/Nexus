import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveKnowledgeDir, resolveMentorionConfig } from '../config';

describe('resolveKnowledgeDir', () => {
  it('falls back to ../knowledge when unset', () => {
    const tmpApp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-cfg-'));
    try {
      const res = resolveKnowledgeDir(tmpApp, {});
      expect(res.source).toBe('default');
      expect(res.knowledgeDir).toBe(path.resolve(tmpApp, '../knowledge'));
    } finally {
      fs.rmSync(tmpApp, { recursive: true, force: true });
    }
  });

  it('reads NEXUS_KNOWLEDGE_DIR from .env.local', () => {
    const tmpApp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-cfg-'));
    try {
      fs.writeFileSync(
        path.join(tmpApp, '.env.local'),
        '# Private vault\nNEXUS_KNOWLEDGE_DIR="../Nexus-Vault"\n',
      );
      const res = resolveKnowledgeDir(tmpApp, {});
      expect(res.source).toBe('dotenv');
      expect(res.knowledgeDir).toBe(path.resolve(tmpApp, '../Nexus-Vault'));
    } finally {
      fs.rmSync(tmpApp, { recursive: true, force: true });
    }
  });

  it('prefers shell env NEXUS_KNOWLEDGE_DIR over .env.local', () => {
    const tmpApp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-cfg-'));
    try {
      fs.writeFileSync(path.join(tmpApp, '.env.local'), 'NEXUS_KNOWLEDGE_DIR="../FromFile"\n');
      const res = resolveKnowledgeDir(tmpApp, { NEXUS_KNOWLEDGE_DIR: '/tmp/custom-vault' });
      expect(res.source).toBe('env');
      expect(res.knowledgeDir).toBe(path.resolve('/tmp/custom-vault'));
    } finally {
      fs.rmSync(tmpApp, { recursive: true, force: true });
    }
  });
});

describe('resolveMentorionConfig', () => {
  it('returns unset when MENTORION_API_URL is absent', () => {
    const tmpApp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-cfg-'));
    try {
      const res = resolveMentorionConfig(tmpApp, {});
      expect(res).toEqual({ apiUrl: null, appUrl: null, source: 'unset' });
    } finally {
      fs.rmSync(tmpApp, { recursive: true, force: true });
    }
  });

  it('reads MENTORION_API_URL from .env.local and trims trailing slashes', () => {
    const tmpApp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-cfg-'));
    try {
      fs.writeFileSync(
        path.join(tmpApp, '.env.local'),
        'MENTORION_API_URL="http://localhost:8000/"\n',
      );
      const res = resolveMentorionConfig(tmpApp, {});
      expect(res).toEqual({
        apiUrl: 'http://localhost:8000',
        appUrl: 'http://localhost:5173',
        source: 'dotenv',
      });
    } finally {
      fs.rmSync(tmpApp, { recursive: true, force: true });
    }
  });

  it('prefers shell env MENTORION_API_URL over .env.local', () => {
    const tmpApp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-cfg-'));
    try {
      fs.writeFileSync(path.join(tmpApp, '.env.local'), 'MENTORION_API_URL=http://localhost:8000\n');
      const res = resolveMentorionConfig(tmpApp, {
        MENTORION_API_URL: 'http://127.0.0.1:9000/',
      });
      expect(res).toEqual({
        apiUrl: 'http://127.0.0.1:9000',
        appUrl: 'http://localhost:5173',
        source: 'env',
      });
    } finally {
      fs.rmSync(tmpApp, { recursive: true, force: true });
    }
  });
});
