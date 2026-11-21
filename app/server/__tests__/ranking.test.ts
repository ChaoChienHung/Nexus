import { describe, expect, it } from 'vitest';
import { rankRelatedDocumentsForConcepts, tokenizeBilingual } from '../ranking';
import type { IndexedDocument, OntologyConcept } from '../types';

function makeDoc(partial: Partial<IndexedDocument> & { id: string; title: string; body: string }): IndexedDocument {
  return {
    summary: '',
    status: 'evergreen',
    categoryPath: ['General'],
    slug: partial.id,
    bundleRelPath: `General/${partial.id}`,
    frontmatter: { id: partial.id, title: partial.title },
    rawMarkdown: partial.body,
    notesSection: '',
    concepts: [],
    mentionedConcepts: [],
    references: [],
    relatedDocs: [],
    backlinks: [],
    comments: [],
    ...partial,
  };
}

describe('BM25 concept-to-document ranking', () => {
  it('tokenizes English words and CJK bigrams cleanly', () => {
    const tokens = tokenizeBilingual('Clustering 分群分析 is great');
    expect(tokens).toContain('clustering');
    expect(tokens).toContain('分群');
    expect(tokens).toContain('群分');
    expect(tokens).toContain('分析');
  });

  it('ranks top 3 related documents by BM25 + structural link boost', () => {
    const concepts: OntologyConcept[] = [
      {
        concept_id: 'concept.clustering',
        labels: { en: 'Clustering', 'zh-Hant': '分群' },
        aliases: ['cluster analysis'],
        contexts: {
          en: 'Clustering groups similar data points together.',
          'zh-Hant': '分群把相似資料點歸在一起。',
        },
      },
    ];

    const docs: IndexedDocument[] = [
      makeDoc({
        id: 'doc.deep_clustering',
        title: 'Clustering Foundations',
        summary: 'Unsupervised clustering and cluster analysis.',
        body: 'Clustering groups similar points using distance metrics. Clustering is fundamental.',
        concepts: ['concept.clustering'],
      }),
      makeDoc({
        id: 'doc.kmeans',
        title: 'K-Means and Clustering',
        body: 'K-means is a popular clustering method for cluster analysis.',
        concepts: ['concept.clustering'],
      }),
      makeDoc({
        id: 'doc.mention_only',
        title: 'Embedding Notes',
        body: 'Embeddings help downstream clustering tasks.',
        mentionedConcepts: ['concept.clustering'],
      }),
      makeDoc({
        id: 'doc.fourth_clustering',
        title: 'Brief Clustering Note',
        body: 'Just a short mention of clustering.',
      }),
      makeDoc({
        id: 'doc.unrelated',
        title: 'Cooking Pasta',
        body: 'Boil water, add salt, and cook al dente.',
      }),
    ];

    const ranked = rankRelatedDocumentsForConcepts(concepts, docs, 3)['concept.clustering'];
    expect(ranked).toHaveLength(3);
    expect(ranked[0].docId).toBe('doc.deep_clustering');
    expect(ranked.map((r) => r.docId)).not.toContain('doc.unrelated');
  });
});
