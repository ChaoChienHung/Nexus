import type { IndexedDocument, OntologyConcept } from './types';

export interface RankedConceptDoc {
  docId: string;
  score: number;
  bm25Score: number;
  linkType: 'explains' | 'mentions' | 'semantic';
}

const BM25_K1 = 1.5;
const BM25_B = 0.75;
const EXPLAINS_BOOST = 2.5;
const MENTIONS_BOOST = 1.0;

/**
 * Bilingual tokenizer supporting ASCII words (English / identifiers) and
 * CJK overlapping character bigrams (with unigrams for single-character runs).
 */
export function tokenizeBilingual(text: string): string[] {
  if (!text) return [];
  const tokens: string[] = [];
  const lower = text.toLowerCase();

  // 1. ASCII alphanumeric words (skip 1-char noise)
  const asciiMatches = lower.match(/[a-z0-9]+/g);
  if (asciiMatches) {
    for (const w of asciiMatches) {
      if (w.length >= 2) tokens.push(w);
    }
  }

  // 2. CJK Unified Ideographs runs -> overlapping bigrams (or unigram if length 1)
  const cjkRuns = lower.match(/[\u4e00-\u9fff]+/g);
  if (cjkRuns) {
    for (const run of cjkRuns) {
      if (run.length === 1) {
        tokens.push(run);
      } else {
        for (let i = 0; i < run.length - 1; i++) {
          tokens.push(run.slice(i, i + 2));
        }
      }
    }
  }

  return tokens;
}

function buildDocumentTokens(doc: IndexedDocument): string[] {
  // Strip wiki-link brackets so raw IDs don't distort natural-language BM25
  const cleanBody = doc.body.replace(/\[\[(concept|doc)\.[a-z0-9_]+\]\]/g, ' ');
  const titleTokens = tokenizeBilingual(doc.title);
  const summaryTokens = tokenizeBilingual(doc.summary);
  const bodyTokens = tokenizeBilingual(cleanBody);

  // Field weighting: Title 3x, Summary 2x, Body 1x
  return [
    ...titleTokens,
    ...titleTokens,
    ...titleTokens,
    ...summaryTokens,
    ...summaryTokens,
    ...bodyTokens,
  ];
}

function buildConceptQueryTerms(concept: OntologyConcept): Map<string, number> {
  const weights = new Map<string, number>();

  const addTerms = (text: string | undefined, weight: number) => {
    if (!text) return;
    for (const tok of tokenizeBilingual(text)) {
      weights.set(tok, Math.max(weights.get(tok) ?? 0, weight));
    }
  };

  // High weight for canonical labels & aliases
  addTerms(concept.labels.en, 2.0);
  addTerms(concept.labels['zh-Hant'], 2.0);
  addTerms(concept.labels['zh-Hans'], 1.8);
  for (const alias of concept.aliases ?? []) {
    addTerms(alias, 1.8);
  }

  // Lower weight for descriptive context terms
  addTerms(concept.contexts.en, 0.5);
  addTerms(concept.contexts['zh-Hant'], 0.5);

  return weights;
}

/**
 * Ranks related documents for every Ontology Concept using Okapi BM25
 * combined with deterministic structural link boosts (`explains` / `mentions`),
 * returning the top `topK` documents (default 3) per concept.
 */
export function rankRelatedDocumentsForConcepts(
  concepts: OntologyConcept[],
  documents: IndexedDocument[],
  topK = 3,
): Record<string, RankedConceptDoc[]> {
  const result: Record<string, RankedConceptDoc[]> = {};
  const N = documents.length;

  if (N === 0) {
    for (const c of concepts) result[c.concept_id] = [];
    return result;
  }

  // Precompute per-document term frequencies, lengths, and corpus document frequencies
  const docTFs: Map<string, number>[] = [];
  const docLengths: number[] = [];
  const df = new Map<string, number>();
  let totalLength = 0;

  for (const doc of documents) {
    const tokens = buildDocumentTokens(doc);
    const tf = new Map<string, number>();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) ?? 0) + 1);
    }
    docTFs.push(tf);
    docLengths.push(tokens.length);
    totalLength += tokens.length;

    for (const term of tf.keys()) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }

  const avgdl = totalLength / N || 1;

  for (const concept of concepts) {
    const queryTerms = buildConceptQueryTerms(concept);
    const scored: RankedConceptDoc[] = [];

    for (let i = 0; i < N; i++) {
      const doc = documents[i];
      const tfMap = docTFs[i];
      const dl = docLengths[i];

      let bm25 = 0;
      for (const [term, qWeight] of queryTerms.entries()) {
        const tf = tfMap.get(term) ?? 0;
        if (tf === 0) continue;
        const termDf = df.get(term) ?? 0;
        const idf = Math.log((N - termDf + 0.5) / (termDf + 0.5) + 1);
        const norm = tf * (BM25_K1 + 1) / (tf + BM25_K1 * (1 - BM25_B + BM25_B * (dl / avgdl)));
        bm25 += qWeight * idf * norm;
      }

      const isExplained = doc.concepts.includes(concept.concept_id);
      const isMentioned = doc.mentionedConcepts.includes(concept.concept_id);
      const structuralBoost = isExplained ? EXPLAINS_BOOST : isMentioned ? MENTIONS_BOOST : 0;
      const totalScore = bm25 + structuralBoost;

      // Include if explicitly linked or has meaningful BM25 textual match
      if (structuralBoost > 0 || bm25 >= 0.45) {
        scored.push({
          docId: doc.id,
          score: Number(totalScore.toFixed(4)),
          bm25Score: Number(bm25.toFixed(4)),
          linkType: isExplained ? 'explains' : isMentioned ? 'mentions' : 'semantic',
        });
      }
    }

    scored.sort((a, b) => b.score - a.score || a.docId.localeCompare(b.docId));
    result[concept.concept_id] = scored.slice(0, topK);
  }

  return result;
}
