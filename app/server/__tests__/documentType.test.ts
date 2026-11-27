import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { buildNexusIndex } from '../indexer';

it('classifies document nodes and preserves legacy documents', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-role-'));
  try {
    fs.mkdirSync(path.join(dir, 'data/ontology'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'data/ontology/concepts.json'), '{"version":1,"concepts":[]}');
    for (const [name, role] of [['source', 'source'], ['synthesis', 'synthesis'], ['legacy', ''], ['invalid', 'other']]) {
      const bundle = path.join(dir, 'wiki', name);
      fs.mkdirSync(bundle, { recursive: true });
      fs.writeFileSync(path.join(bundle, 'index.md'), `---\nid: doc.${name}\ntitle: ${name}\n${role ? `type: ${role}\n` : ''}---\n\n# ${name}\n`);
    }
    const index = buildNexusIndex(dir, { includeDrafts: true });
    const nodes = Object.fromEntries(index.graph.nodes.map((n) => [n.id, n.documentType]));
    expect(nodes['doc.source']).toBe('source');
    expect(nodes['doc.synthesis']).toBe('synthesis');
    expect(nodes['doc.legacy']).toBeUndefined();
    expect(nodes['doc.invalid']).toBeUndefined();
    expect(index.warnings).toHaveLength(1);
    expect(index.warnings[0]).toContain('unknown type');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
