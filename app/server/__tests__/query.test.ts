import { describe, expect, it } from 'vitest';
import {
  findConceptPath,
  getConceptSubgraph,
  getDocumentDetail,
  getGraphOverview,
  listAnnotations,
  searchNexus,
} from '../query';
import { rankRelatedDocumentsForConcepts } from '../ranking';
import type { IndexedDocument, NexusIndex, OntologyConcept } from '../types';

function makeFixtureIndex(): NexusIndex {
  const concepts: OntologyConcept[] = [
    {
      concept_id: 'concept.ontology',
      kind: 'method',
      labels: { en: 'Ontology', 'zh-Hant': '本體論' },
      aliases: ['概念本體', 'terminology'],
      contexts: {
        en: 'An Ontology defines canonical concepts and typed semantic relations.',
        'zh-Hant': '本體論定義標準化的核心概念與語意關係。',
      },
      relations: [{ type: 'enables', target: 'concept.knowledge_graph' }],
    },
    {
      concept_id: 'concept.knowledge_graph',
      kind: 'architecture',
      labels: { en: 'Knowledge Graph', 'zh-Hant': '知識圖譜' },
      aliases: ['概念圖譜', 'KG'],
      contexts: {
        en: 'A Knowledge Graph compiles concepts and documents into a connected web.',
        'zh-Hant': '知識圖譜把概念與文件編譯成具方向性的關聯網。',
      },
      relations: [{ type: 'part_of', target: 'concept.knowledge_base' }],
    },
    {
      concept_id: 'concept.knowledge_base',
      kind: 'framework',
      labels: { en: 'Knowledge Base', 'zh-Hant': '知識庫' },
      aliases: ['PKM', '個人知識庫'],
      contexts: {
        en: 'A Knowledge Base stores evergreen notes in plain text.',
        'zh-Hant': '知識庫以純文字保存長期累積的筆記。',
      },
      relations: [],
    },
    {
      concept_id: 'concept.isolated',
      kind: 'concept',
      labels: { en: 'Isolated Idea', 'zh-Hant': '孤立概念' },
      aliases: [],
      contexts: {
        en: 'An isolated concept with no edges.',
        'zh-Hant': '沒有任何連線的孤立概念。',
      },
      relations: [],
    },
  ];

  const documents: IndexedDocument[] = [
    {
      id: 'doc.ontology_guide',
      title: 'Ontology & Knowledge Graph Guide',
      summary: 'How Ontology enables a personal Knowledge Graph.',
      status: 'evergreen',
      review: 'reviewed',
      categoryPath: ['Architecture'],
      slug: 'ontology-guide',
      bundleRelPath: 'Architecture/ontology-guide',
      frontmatter: { id: 'doc.ontology_guide', title: 'Ontology & Knowledge Graph Guide' },
      rawMarkdown: '---\nid: doc.ontology_guide\n---\nBody text\n\n## 備註\nRemember to link examples.',
      body: 'Ontology defines canonical concepts and enables the Knowledge Graph for personal PKM.',
      notesSection: 'Remember to link examples.',
      sections: [],
      rawSources: [],
      concepts: ['concept.ontology'],
      mentionedConcepts: ['concept.knowledge_graph'],
      relatedDocs: ['doc.pkm_notes'],
      backlinks: [],
      comments: [
        {
          id: 'cmt_1',
          quote: 'Ontology defines canonical concepts',
          prefix: '',
          suffix: '',
          body: 'Expand with controlled vocabulary comparison.',
          resolved: false,
          created_at: '2026-11-21T00:00:00Z',
          updated_at: '2026-11-21T00:00:00Z',
        },
        {
          id: 'cmt_2',
          quote: 'personal PKM',
          prefix: '',
          suffix: '',
          body: 'Already fixed.',
          resolved: true,
          created_at: '2026-11-21T00:00:00Z',
          updated_at: '2026-11-21T00:00:00Z',
        },
      ],
    },
    {
      id: 'doc.pkm_notes',
      title: 'Personal Knowledge Base Setup',
      summary: 'Organizing evergreen notes in plain text.',
      status: 'seed',
      review: 'fresh',
      categoryPath: ['Workflow'],
      slug: 'pkm-notes',
      bundleRelPath: 'Workflow/pkm-notes',
      frontmatter: { id: 'doc.pkm_notes', title: 'Personal Knowledge Base Setup' },
      rawMarkdown: '---\nid: doc.pkm_notes\n---\nPlain text PKM.',
      body: 'A Knowledge Base stores evergreen notes in plain text Markdown files.',
      notesSection: '',
      sections: [],
      rawSources: [],
      concepts: ['concept.knowledge_base'],
      mentionedConcepts: [],
      relatedDocs: [],
      backlinks: ['doc.ontology_guide'],
      comments: [],
    },
  ];

  const conceptTopDocs = rankRelatedDocumentsForConcepts(concepts, documents, 3);

  return {
    generatedAt: '2026-11-23T00:00:00Z',
    tree: [
      { name: 'Architecture', path: 'Architecture', type: 'category', children: [] },
      { name: 'Workflow', path: 'Workflow', type: 'category', children: [] },
    ],
    documents,
    concepts,
    conceptTopDocs,
    rawFiles: [],
    graph: {
      nodes: [
        { id: 'concept.ontology', type: 'concept', label: '本體論', sublabel: 'Ontology', kind: 'method' },
        { id: 'concept.knowledge_graph', type: 'concept', label: '知識圖譜', sublabel: 'Knowledge Graph', kind: 'architecture' },
        { id: 'concept.knowledge_base', type: 'concept', label: '知識庫', sublabel: 'Knowledge Base', kind: 'framework' },
        { id: 'concept.isolated', type: 'concept', label: '孤立概念', sublabel: 'Isolated Idea', kind: 'concept' },
        { id: 'doc.ontology_guide', type: 'document', label: 'Ontology & Knowledge Graph Guide', status: 'evergreen' },
        { id: 'doc.pkm_notes', type: 'document', label: 'Personal Knowledge Base Setup', status: 'seed' },
      ],
      edges: [
        { id: 'e1', source: 'concept.ontology', target: 'concept.knowledge_graph', type: 'enables' },
        { id: 'e2', source: 'concept.knowledge_graph', target: 'concept.knowledge_base', type: 'part_of' },
        { id: 'e3', source: 'doc.ontology_guide', target: 'concept.ontology', type: 'explains' },
        { id: 'e4', source: 'doc.ontology_guide', target: 'concept.knowledge_graph', type: 'mentions' },
        { id: 'e5', source: 'doc.pkm_notes', target: 'concept.knowledge_base', type: 'explains' },
        { id: 'e6', source: 'doc.ontology_guide', target: 'doc.pkm_notes', type: 'links_to' },
      ],
    },
    warnings: [],
  };
}

describe('query engine', () => {
  it('searches bilingual concepts by alias and documents by BM25', () => {
    const index = makeFixtureIndex();

    const pkmRes = searchNexus(index, 'PKM');
    expect(pkmRes.concepts[0]?.concept_id).toBe('concept.knowledge_base');
    expect(pkmRes.documents.length).toBeGreaterThan(0);

    const zhRes = searchNexus(index, '本體論', { type: 'concept' });
    expect(zhRes.concepts[0]?.concept_id).toBe('concept.ontology');
    expect(zhRes.documents).toHaveLength(0);
  });

  it('extracts 1-hop and 2-hop concept subgraphs with related doc summaries', () => {
    const index = makeFixtureIndex();

    const oneHop = getConceptSubgraph(index, 'concept.ontology', { hops: 1 });
    expect(oneHop.concepts.map((c) => c.concept_id)).toEqual([
      'concept.ontology',
      'concept.knowledge_graph',
    ]);
    expect(oneHop.documents.map((d) => d.id)).toEqual(['doc.ontology_guide']);

    const twoHop = getConceptSubgraph(index, 'concept.ontology', { hops: 2 });
    expect(twoHop.concepts.map((c) => c.concept_id)).toEqual([
      'concept.ontology',
      'concept.knowledge_graph',
      'concept.knowledge_base',
    ]);
    expect(twoHop.documents.map((d) => d.id)).toEqual(['doc.ontology_guide', 'doc.pkm_notes']);

    expect(() => getConceptSubgraph(index, 'concept.missing')).toThrow(/Concept not found/);
  });

  it('finds shortest semantic paths and reports disconnected nodes', () => {
    const index = makeFixtureIndex();

    const path = findConceptPath(index, 'concept.ontology', 'concept.knowledge_base');
    expect(path.found).toBe(true);
    expect(path.length).toBe(2);
    expect(path.steps.map((s) => s.edgeType)).toEqual(['enables', 'part_of']);

    const reversePath = findConceptPath(index, 'concept.knowledge_base', 'concept.ontology');
    expect(reversePath.found).toBe(true);
    expect(reversePath.steps.map((s) => s.direction)).toEqual(['reverse', 'reverse']);

    const disconnected = findConceptPath(index, 'concept.ontology', 'concept.isolated');
    expect(disconnected.found).toBe(false);
    expect(disconnected.length).toBe(-1);
  });

  it('reads single document detail and filters annotations', () => {
    const index = makeFixtureIndex();

    const detail = getDocumentDetail(index, 'doc.ontology_guide', { includeComments: true });
    expect(detail.title).toBe('Ontology & Knowledge Graph Guide');
    expect(detail.comments).toHaveLength(2);
    expect(detail.notesSection).toBe('Remember to link examples.');

    const unresolvedOnly = listAnnotations(index);
    expect(unresolvedOnly.totalUnresolvedComments).toBe(1);
    expect(unresolvedOnly.totalDocsWithNotes).toBe(1);
    expect(unresolvedOnly.items[0]?.comments.map((c) => c.id)).toEqual(['cmt_1']);

    const allAnnotations = listAnnotations(index, { includeResolved: true });
    expect(allAnnotations.items[0]?.comments).toHaveLength(2);
  });

  it('returns compact graph overview', () => {
    const index = makeFixtureIndex();
    const overview = getGraphOverview(index);
    expect(overview.counts).toEqual({ documents: 2, concepts: 4, edges: 6, warnings: 0 });
    expect(overview.categories).toEqual(['Architecture', 'Workflow']);
  });
});
