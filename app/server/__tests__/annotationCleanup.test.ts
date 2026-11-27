import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanupResolvedComments } from '../annotationCleanup';

describe('cleanupResolvedComments', () => {
  it('deletes only valid empty or fully resolved bundle sidecars', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-comments-'));
    try {
      const wiki = path.join(root, 'wiki');
      for (const [name, content] of Object.entries({ empty: '{"comments":[]}', done: '{"comments":[{"resolved":true}]}', open: '{"comments":[{"resolved":false}]}', missing: '{"comments":[{}]}', bad: '{', wrong: '{}' })) {
        const dir = path.join(wiki, name); fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'index.md'), '# Note'); fs.writeFileSync(path.join(dir, 'comments.json'), content);
      }
      const preview = cleanupResolvedComments(root, true);
      expect(preview.eligible).toHaveLength(2); expect(preview.deleted).toHaveLength(0);
      const result = cleanupResolvedComments(root);
      expect(result.deleted).toHaveLength(2); expect(result.skipped).toHaveLength(4);
      expect(fs.existsSync(path.join(wiki, 'open', 'comments.json'))).toBe(true);
      expect(fs.existsSync(path.join(wiki, 'bad', 'comments.json'))).toBe(true);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
