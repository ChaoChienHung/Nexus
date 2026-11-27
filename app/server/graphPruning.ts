import type {
  ConceptRelationType,
  GraphEdge,
  IndexedDocument,
  OntologyConcept,
} from './types';
import type { RankedConceptDoc } from './ranking';

export interface GraphPruningOptions {
  strongEdgeWeight: number;
  weakEdgeWeight: number;
  redundancyThreshold: number;
  maxConceptEdgesPerDoc: number;
  maxTotalEdgesPerDoc: number;
  softmaxTemperature: number;
}

export const GRAPH_PRUNING_DEFAULTS: GraphPruningOptions = {
  strongEdgeWeight: 1.0,
  weakEdgeWeight: 1.5,
  redundancyThreshold: 2.0,
  maxConceptEdgesPerDoc: 6,
  maxTotalEdgesPerDoc: 12,
  softmaxTemperature: 2.5,
};

const STRONG_CONCEPT_RELATIONS = new Set<ConceptRelationType>([
  'is_a',
  'part_of',
  'generalizes',
  'example_of',
  'depends_on',
  'enables',
  'solves',
  'used_in',
]);

function getConceptRelationWeight(
  type: ConceptRelationType,
  opts: GraphPruningOptions,
): number {
  return STRONG_CONCEPT_RELATIONS.has(type)
    ? opts.strongEdgeWeight
    : opts.weakEdgeWeight;
}

/**
 * Computes shortest weighted distances in the undirected Concept-only subgraph
 * starting from `sources`, stopping early once distance exceeds `maxDist`.
 */
function findReachableWithinThreshold(
  sources: string[],
  adj: Map<string, Array<{ target: string; weight: number }>>,
  maxDist: number,
): Map<string, { dist: number; anchor: string }> {
  const best = new Map<string, { dist: number; anchor: string }>();
  const queue: Array<{ node: string; dist: number; anchor: string }> = [];

  for (const src of sources) {
    best.set(src, { dist: 0, anchor: src });
    queue.push({ node: src, dist: 0, anchor: src });
  }

  // Graph is small (tens to hundreds of concepts); simple min-extract Dijkstra is exact & fast
  while (queue.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].dist < queue[minIdx].dist) minIdx = i;
    }
    const current = queue.splice(minIdx, 1)[0];
    const known = best.get(current.node);
    if (!known || current.dist > known.dist + 1e-9) continue;

    for (const neighbor of adj.get(current.node) ?? []) {
      const nextDist = current.dist + neighbor.weight;
      if (nextDist > maxDist + 1e-9) continue;
      const prev = best.get(neighbor.target);
      if (!prev || nextDist < prev.dist - 1e-9) {
        best.set(neighbor.target, { dist: nextDist, anchor: current.anchor });
        queue.push({ node: neighbor.target, dist: nextDist, anchor: current.anchor });
      }
    }
  }

  return best;
}

/**
 * Annotates redundant `document -> concept` (and overflow `document -> document`) edges
 * using greedy streaming edge selection over the weighted Concept subgraph.
 *
 * SSOT links are never deleted; pruned edges are marked `redundant: true` with
 * `prunedReason` (`'transitive' | 'cap'`) and optional `coveredBy` anchor concept ID.
 */
export function pruneRedundantGraphEdges(
  edges: GraphEdge[],
  concepts: OntologyConcept[],
  documents: IndexedDocument[],
  conceptTopDocsAll: Record<string, RankedConceptDoc[]>,
  options: Partial<GraphPruningOptions> = {},
): GraphEdge[] {
  const opts: GraphPruningOptions = { ...GRAPH_PRUNING_DEFAULTS, ...options };

  // 1. Build undirected weighted adjacency list of Concept-to-Concept edges
  const conceptAdj = new Map<string, Array<{ target: string; weight: number }>>();
  const conceptSet = new Set(concepts.map((c) => c.concept_id));

  const addUndirected = (a: string, b: string, weight: number) => {
    if (!conceptAdj.has(a)) conceptAdj.set(a, []);
    if (!conceptAdj.has(b)) conceptAdj.set(b, []);
    conceptAdj.get(a)!.push({ target: b, weight });
    conceptAdj.get(b)!.push({ target: a, weight });
  };

  for (const c of concepts) {
    for (const rel of c.relations ?? []) {
      if (!conceptSet.has(rel.target) || rel.target === c.concept_id) continue;
      addUndirected(c.concept_id, rel.target, getConceptRelationWeight(rel.type, opts));
    }
  }

  // 2. Index relevance scores per (docId, conceptId) from BM25 + structural boost
  const scoreMap = new Map<string, number>();
  for (const [conceptId, rankedDocs] of Object.entries(conceptTopDocsAll)) {
    for (const r of rankedDocs) {
      scoreMap.set(`${r.docId}|${conceptId}`, r.score);
    }
  }

  // Preserve original frontmatter concept order as deterministic tie-breaker
  const docConceptOrder = new Map<string, Map<string, number>>();
  for (const d of documents) {
    const order = new Map<string, number>();
    d.concepts.forEach((cid, i) => order.set(cid, i));
    d.mentionedConcepts.forEach((cid, i) => {
      if (!order.has(cid)) order.set(cid, d.concepts.length + i);
    });
    docConceptOrder.set(d.id, order);
  }

  // 3. Group outgoing document edges by source document
  const docConceptEdges = new Map<string, GraphEdge[]>();
  const docLinkEdges = new Map<string, GraphEdge[]>();

  for (const e of edges) {
    if (e.type === 'explains' || e.type === 'mentions') {
      if (!docConceptEdges.has(e.source)) docConceptEdges.set(e.source, []);
      docConceptEdges.get(e.source)!.push(e);
    } else if (e.type === 'links_to') {
      if (!docLinkEdges.has(e.source)) docLinkEdges.set(e.source, []);
      docLinkEdges.get(e.source)!.push(e);
    }
  }

  const prunedMeta = new Map<
    string,
    { redundant: true; prunedReason: 'transitive' | 'cap'; coveredBy?: string }
  >();
  const edgeWeights = new Map<string, number>();

  // Assign deterministic semantic strength weights to concept-to-concept & doc-to-doc edges
  for (const e of edges) {
    if (e.type === 'links_to') {
      edgeWeights.set(e.id, 0.75);
    } else if (e.type !== 'explains' && e.type !== 'mentions') {
      edgeWeights.set(
        e.id,
        STRONG_CONCEPT_RELATIONS.has(e.type as ConceptRelationType) ? 0.9 : 0.55,
      );
    }
  }

  // 4. Streaming selection + peak-normalized softmax weight per document
  const temp = Math.max(0.1, opts.softmaxTemperature);
  for (const d of documents) {
    const candidates = [...(docConceptEdges.get(d.id) ?? [])];
    const orderMap = docConceptOrder.get(d.id);

    // Peak-normalized softmax over this document's concept relevance scores:
    // p_i / max_j p_j = exp((s_i - s_max) / T) in (0, 1]
    if (candidates.length > 0) {
      const rawScores = candidates.map((edge) => {
        const base = scoreMap.get(`${d.id}|${edge.target}`) ?? 0;
        return edge.type === 'explains' ? base + 1.0 : base;
      });
      const maxScore = Math.max(...rawScores);
      candidates.forEach((edge, idx) => {
        const norm = Math.exp((rawScores[idx] - maxScore) / temp);
        edgeWeights.set(edge.id, Math.round(norm * 1000) / 1000);
      });
    }

    candidates.sort((a, b) => {
      // `explains` always outranks `mentions`
      const typeRankA = a.type === 'explains' ? 1 : 0;
      const typeRankB = b.type === 'explains' ? 1 : 0;
      if (typeRankA !== typeRankB) return typeRankB - typeRankA;

      // Higher BM25 + structural relevance first
      const scoreA = scoreMap.get(`${d.id}|${a.target}`) ?? 0;
      const scoreB = scoreMap.get(`${d.id}|${b.target}`) ?? 0;
      if (Math.abs(scoreA - scoreB) > 1e-6) return scoreB - scoreA;

      // Deterministic tie-breaker: frontmatter order then ID
      const ordA = orderMap?.get(a.target) ?? Number.MAX_SAFE_INTEGER;
      const ordB = orderMap?.get(b.target) ?? Number.MAX_SAFE_INTEGER;
      if (ordA !== ordB) return ordA - ordB;
      return a.target.localeCompare(b.target);
    });

    const keptAnchors: string[] = [];
    for (const edge of candidates) {
      if (keptAnchors.length >= opts.maxConceptEdgesPerDoc) {
        prunedMeta.set(edge.id, { redundant: true, prunedReason: 'cap' });
        continue;
      }

      if (keptAnchors.length > 0) {
        const reachable = findReachableWithinThreshold(
          keptAnchors,
          conceptAdj,
          opts.redundancyThreshold,
        );
        const hit = reachable.get(edge.target);
        if (hit) {
          prunedMeta.set(edge.id, {
            redundant: true,
            prunedReason: 'transitive',
            coveredBy: hit.anchor,
          });
          continue;
        }
      }

      keptAnchors.push(edge.target);
    }

    // Apply total outgoing edge cap across doc -> doc `links_to` edges
    const remainingBudget = Math.max(0, opts.maxTotalEdgesPerDoc - keptAnchors.length);
    const links = docLinkEdges.get(d.id) ?? [];
    links.forEach((edge, idx) => {
      if (idx >= remainingBudget) {
        prunedMeta.set(edge.id, { redundant: true, prunedReason: 'cap' });
      }
    });
  }

  return edges.map((e) => {
    const meta = prunedMeta.get(e.id);
    const weight = edgeWeights.get(e.id);
    return {
      ...e,
      ...(weight !== undefined ? { weight } : {}),
      ...(meta ?? {}),
    };
  });
}
