import { describe, expect, it } from 'vitest';
import { pruneRedundantGraphEdges } from '../graphPruning';
import { rankRelatedDocumentsForConcepts } from '../ranking';
import type { GraphEdge, IndexedDocument, OntologyConcept } from '../types';

function makeDoc(id: string, title: string, body: string, concepts: string[], relatedDocs: string[] = []): IndexedDocument {
  return {
    id,
    title,
    summary: title,
    status: 'seed',
    review: 'fresh',
    categoryPath: ['AI'],
    slug: id,
    bundleRelPath: `AI/${id}`,
    frontmatter: { id, title, concepts, related_docs: relatedDocs },
    rawMarkdown: body,
    body,
    notesSection: '',
    sections: [],
    rawSources: [],
    concepts,
    mentionedConcepts: [],
    relatedDocs,
    backlinks: [],
    comments: [],
  };
}

function makeConcept(
  id: string,
  label: string,
  relations: OntologyConcept['relations'] = [],
): OntologyConcept {
  return {
    concept_id: id,
    kind: 'method',
    labels: { en: label, 'zh-Hant': label },
    aliases: [],
    contexts: { en: label, 'zh-Hant': label },
    relations,
  };
}

describe('pruneRedundantGraphEdges (weighted streaming edge pruning)', () => {
  it('prunes transitive doc->concept edge when a higher-relevance concept reaches it via strong relation', () => {
    const concepts = [
      makeConcept('concept.moe', 'Mixture of Experts', [
        { type: 'depends_on', target: 'concept.routing' },
      ]),
      makeConcept('concept.routing', 'Expert Routing', [
        { type: 'part_of', target: 'concept.moe' },
      ]),
    ];
    const docs = [
      makeDoc(
        'doc.olmoe',
        'OLMoE Mixture of Experts',
        'Mixture of Experts Mixture of Experts Mixture of Experts and Expert Routing.',
        ['concept.moe', 'concept.routing'],
      ),
    ];
    const edges: GraphEdge[] = [
      { id: 'c1', source: 'concept.moe', target: 'concept.routing', type: 'depends_on' },
      { id: 'c2', source: 'concept.routing', target: 'concept.moe', type: 'part_of' },
      { id: 'd1', source: 'doc.olmoe', target: 'concept.moe', type: 'explains' },
      { id: 'd2', source: 'doc.olmoe', target: 'concept.routing', type: 'explains' },
    ];

    const scores = rankRelatedDocumentsForConcepts(concepts, docs, docs.length);
    const result = pruneRedundantGraphEdges(edges, concepts, docs, scores);

    const moeEdge = result.find((e) => e.id === 'd1')!;
    const routingEdge = result.find((e) => e.id === 'd2')!;
    expect(moeEdge.redundant).toBeFalsy();
    expect(moeEdge.weight).toBe(1);
    expect(routingEdge.redundant).toBe(true);
    expect(routingEdge.weight).toBeGreaterThan(0);
    expect(routingEdge.weight).toBeLessThan(1);
    expect(routingEdge.prunedReason).toBe('transitive');
    expect(routingEdge.coveredBy).toBe('concept.moe');
  });

  it('prunes 2 strong hops (dist=2.0) but does NOT prune 2 weak relates_to hops (dist=3.0)', () => {
    const concepts = [
      makeConcept('concept.a', 'Alpha', [
        { type: 'is_a', target: 'concept.b' },
        { type: 'relates_to', target: 'concept.w1' },
      ]),
      makeConcept('concept.b', 'Beta', [{ type: 'part_of', target: 'concept.c' }]),
      makeConcept('concept.c', 'Gamma'),
      makeConcept('concept.w1', 'WeakOne', [{ type: 'relates_to', target: 'concept.w2' }]),
      makeConcept('concept.w2', 'WeakTwo'),
    ];
    const docs = [
      makeDoc(
        'doc.test',
        'Alpha Alpha Alpha',
        'Alpha Alpha Alpha Gamma WeakTwo',
        ['concept.a', 'concept.c', 'concept.w2'],
      ),
    ];
    const edges: GraphEdge[] = [
      { id: 'da', source: 'doc.test', target: 'concept.a', type: 'explains' },
      { id: 'dc', source: 'doc.test', target: 'concept.c', type: 'explains' },
      { id: 'dw2', source: 'doc.test', target: 'concept.w2', type: 'explains' },
    ];

    const scores = rankRelatedDocumentsForConcepts(concepts, docs, docs.length);
    const result = pruneRedundantGraphEdges(edges, concepts, docs, scores);

    expect(result.find((e) => e.id === 'da')!.redundant).toBeFalsy();
    // a --(1.0)--> b --(1.0)--> c => dist 2.0 <= 2.0 => pruned
    expect(result.find((e) => e.id === 'dc')!.redundant).toBe(true);
    // a --(1.5)--> w1 --(1.5)--> w2 => dist 3.0 > 2.0 => kept
    expect(result.find((e) => e.id === 'dw2')!.redundant).toBeFalsy();
  });

  it('enforces maxConceptEdgesPerDoc cap with prunedReason="cap"', () => {
    const concepts = Array.from({ length: 8 }, (_, i) =>
      makeConcept(`concept.k${i}`, `Concept${i}`),
    );
    const docs = [
      makeDoc(
        'doc.broad',
        'Broad Survey',
        concepts.map((c) => c.labels.en).join(' '),
        concepts.map((c) => c.concept_id),
      ),
    ];
    const edges: GraphEdge[] = concepts.map((c) => ({
      id: `e_${c.concept_id}`,
      source: 'doc.broad',
      target: c.concept_id,
      type: 'explains',
    }));

    const scores = rankRelatedDocumentsForConcepts(concepts, docs, docs.length);
    const result = pruneRedundantGraphEdges(edges, concepts, docs, scores, {
      maxConceptEdgesPerDoc: 6,
    });

    const kept = result.filter((e) => !e.redundant);
    const capped = result.filter((e) => e.redundant && e.prunedReason === 'cap');
    expect(kept).toHaveLength(6);
    expect(capped).toHaveLength(2);
  });
});
