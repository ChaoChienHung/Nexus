import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildNexusIndex } from '../indexer';

const REPO_KNOWLEDGE_DIR = path.resolve(__dirname, '../../../knowledge');

describe('Nexus recursive indexer', () => {
  it('indexes the repository knowledge base with depth-agnostic bundles and graph edges', () => {
    const idx = buildNexusIndex(REPO_KNOWLEDGE_DIR, { includeDrafts: true });

    expect(idx.documents.length).toBeGreaterThanOrEqual(2);
    expect(idx.concepts.length).toBeGreaterThanOrEqual(8);
    expect(idx.references.length).toBeGreaterThanOrEqual(3);
    expect(idx.warnings).toEqual([]);

    const clustering = idx.documents.find((d) => d.id === 'doc.clustering_foundations');
    expect(clustering).toBeDefined();
    expect(clustering?.categoryPath).toEqual(['Artificial Intelligence', 'Machine Learning']);
    expect(clustering?.comments.length).toBe(1);
    expect(clustering?.backlinks).toContain('doc.first_principles_and_reverse_engineering');

    // Graph contains explains, mentions, cites, links_to, and concept relations
    const edgeTypes = new Set(idx.graph.edges.map((e) => e.type));
    expect(edgeTypes.has('explains')).toBe(true);
    expect(edgeTypes.has('mentions')).toBe(true);
    expect(edgeTypes.has('cites')).toBe(true);
    expect(edgeTypes.has('links_to')).toBe(true);
    expect(edgeTypes.has('is_a')).toBe(true);
  });

  it('excludes draft documents when includeDrafts is false', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-test-'));
    try {
      fs.mkdirSync(path.join(tmpDir, 'data', 'ontology'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'data', 'ontology', 'concepts.json'), '{"version":1,"concepts":[]}');
      fs.writeFileSync(path.join(tmpDir, 'data', 'references.json'), '{"version":1,"references":[]}');

      const draftDir = path.join(tmpDir, 'notes', 'Private', 'secret-draft');
      fs.mkdirSync(draftDir, { recursive: true });
      fs.writeFileSync(
        path.join(draftDir, 'index.md'),
        '---\nid: doc.secret_draft\ntitle: Secret\nstatus: draft\n---\n\n# Secret\n',
      );

      const pubIdx = buildNexusIndex(tmpDir, { includeDrafts: false });
      expect(pubIdx.documents).toHaveLength(0);
      expect(pubIdx.graph.nodes).toHaveLength(0);

      const devIdx = buildNexusIndex(tmpDir, { includeDrafts: true });
      expect(devIdx.documents).toHaveLength(1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
