import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveKnowledgeDir } from '../config';

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
