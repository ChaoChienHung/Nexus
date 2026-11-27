import fs from 'node:fs';
import path from 'node:path';

export interface CleanupResult { deleted: string[]; eligible: string[]; skipped: Array<{ path: string; reason: string }> }

/** Scan only real document bundles under wiki. Never follow symlinks. */
export function cleanupResolvedComments(knowledgeDir: string, dryRun = false): CleanupResult {
  const wiki = path.join(knowledgeDir, 'wiki');
  const result: CleanupResult = { deleted: [], eligible: [], skipped: [] };
  function visit(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) visit(path.join(dir, entry.name));
    }
    const markdown = path.join(dir, 'index.md');
    const sidecar = path.join(dir, 'comments.json');
    if (!fs.existsSync(markdown) || !fs.existsSync(sidecar)) return;
    const relative = path.relative(knowledgeDir, sidecar).split(path.sep).join('/');
    try {
      if (!fs.lstatSync(markdown).isFile() || !fs.lstatSync(sidecar).isFile()) throw new Error('not a regular file');
      const data: unknown = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
      if (!data || typeof data !== 'object' || !Array.isArray((data as { comments?: unknown }).comments)) throw new Error('invalid comments array');
      const comments = (data as { comments: unknown[] }).comments;
      if (!comments.every(c => c !== null && typeof c === 'object' && (c as { resolved?: unknown }).resolved === true)) {
        result.skipped.push({ path: relative, reason: 'unresolved or invalid comment' });
        return;
      }
      result.eligible.push(relative);
      if (!dryRun) { fs.unlinkSync(sidecar); result.deleted.push(relative); }
    } catch (error) {
      result.skipped.push({ path: relative, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  if (fs.existsSync(wiki)) visit(wiki);
  return result;
}
