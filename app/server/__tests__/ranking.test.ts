import { describe, expect, it } from 'vitest';
import { rankRelatedDocumentsForConcepts, tokenizeBilingual } from '../ranking';
import type { IndexedDocument, OntologyConcept } from '../types';

function makeDoc(partial: Partial<IndexedDocument> & { id: string; title: string; body: string }): IndexedDocument {
  return {
    summary: '',
    status: 'evergreen',
    review: 'fresh',
    categoryPath: ['General'],
    slug: partial.id,
    bundleRelPath: `General/${partial.id}`,
    frontmatter: { id: partial.id, title: partial.title },
    rawMarkdown: partial.body,
    notesSection: '',
    concepts: [],
    mentionedConcepts: [],
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

  it('does not pad to topK with unrelated documents that only share context or partial label words', () => {
    const concepts: OntologyConcept[] = [
      {
        concept_id: 'concept.real_time_bidding',
        labels: { en: 'Real-Time Bidding', 'zh-Hant': '即時競價' },
        aliases: ['RTB'],
        contexts: {
          en: 'An online advertising auction mechanism that evaluates bids in real time using statistical models and distribution estimates.',
          'zh-Hant': '一種透過統計模型與分布估計在極短時間內完成出價決策的線上廣告拍賣機制。',
        },
      },
    ];

    const docs: IndexedDocument[] = [
      makeDoc({
        id: 'doc.rtb_core',
        title: 'Physics-Informed Real-Time Bidding World Models',
        summary: 'Modeling RTB auctions with heavy-tailed distributions.',
        body: 'Real-Time Bidding (RTB) requires accurate auction models under strict latency.',
        concepts: ['concept.real_time_bidding'],
      }),
      makeDoc({
        id: 'doc.visual_tokenizer',
        title: 'Visual Tokenizer Architecture',
        summary: 'Statistical models and latent distribution estimates for images.',
        body: 'This model runs in real time and uses statistical models with distribution estimates over latent tokens.',
      }),
      makeDoc({
        id: 'doc.first_principles',
        title: 'First Principles Thinking',
        summary: 'Breaking down complex mechanisms into core assumptions.',
        body: 'A mechanism for evaluating core assumptions and building better decision models over time.',
      }),
    ];

    const ranked = rankRelatedDocumentsForConcepts(concepts, docs, 3)['concept.real_time_bidding'];
    expect(ranked).toHaveLength(1);
    expect(ranked[0].docId).toBe('doc.rtb_core');
  });

  it('includes strong unlinked semantic matches that cover a canonical label and clear thresholds', () => {
    const concepts: OntologyConcept[] = [
      {
        concept_id: 'concept.noise',
        labels: { en: 'Noise', 'zh-Hant': '雜訊' },
        aliases: [],
        contexts: {
          en: 'Irrelevant or random variation in observed data.',
          'zh-Hant': '觀測資料中隨機且無關的變異。',
        },
      },
    ];

    const docs: IndexedDocument[] = [
      makeDoc({
        id: 'doc.clustering',
        title: 'Clustering and Noise',
        body: 'Noise affects clustering boundaries and distance metrics in observed data.',
        concepts: ['concept.noise'],
      }),
      makeDoc({
        id: 'doc.signal_processing',
        title: 'Noise Filtering in Signals',
        summary: 'Removing random noise from observed data.',
        body: 'Noise reduction separates signal from irrelevant random variation and noise in data.',
      }),
      makeDoc({
        id: 'doc.unrelated',
        title: 'Database Indexing',
        body: 'B-trees speed up disk lookups for structured tables.',
      }),
    ];

    const ranked = rankRelatedDocumentsForConcepts(concepts, docs, 3)['concept.noise'];
    expect(ranked.map((r) => r.docId)).toEqual(['doc.clustering', 'doc.signal_processing']);
    expect(ranked[1].linkType).toBe('semantic');
  });
});
