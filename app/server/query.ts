import { tokenizeBilingual } from './ranking';
import type {
  ConceptRankedDoc,
  DocReviewStatus,
  DocStatus,
  GraphEdge,
  IndexedDocument,
  NexusIndex,
  OntologyConcept,
  SentenceComment,
} from './types';

const BM25_K1 = 1.5;
const BM25_B = 0.75;

export interface ConceptSearchHit {
  concept_id: string;
  kind: string;
  labels: OntologyConcept['labels'];
  aliases: string[];
  contexts: OntologyConcept['contexts'];
  score: number;
  topDocs: Array<{
    docId: string;
    title: string;
    linkType: ConceptRankedDoc['linkType'];
    score: number;
  }>;
}

export interface DocumentSearchHit {
  id: string;
  title: string;
  summary: string;
  status: DocStatus;
  review: DocReviewStatus;
  categoryPath: string[];
  concepts: string[];
  score: number;
}

export interface SectionSearchHit {
  docId: string;
  docTitle: string;
  categoryPath: string[];
  heading: string;
  slug: string;
  level: number;
  snippet: string;
  score: number;
}

export interface SearchResult {
  query: string;
  category?: string;
  concepts: ConceptSearchHit[];
  documents: DocumentSearchHit[];
}

export interface SubgraphConceptNode {
  concept_id: string;
  kind: string;
  labels: OntologyConcept['labels'];
  aliases: string[];
  contexts: OntologyConcept['contexts'];
  distance: number;
}

export interface SubgraphDocumentSummary {
  id: string;
  title: string;
  summary: string;
  status: DocStatus;
  review: DocReviewStatus;
  categoryPath: string[];
  linkTypes: Array<'explains' | 'mentions' | 'semantic'>;
}

export interface ConceptSubgraphResult {
  center: SubgraphConceptNode & {
    topDocs: Array<{
      docId: string;
      title: string;
      linkType: ConceptRankedDoc['linkType'];
      score: number;
    }>;
  };
  hops: number;
  concepts: SubgraphConceptNode[];
  edges: GraphEdge[];
  documents: SubgraphDocumentSummary[];
}

export interface PathStep {
  from: string;
  to: string;
  edgeType: GraphEdge['type'];
  direction: 'forward' | 'reverse';
}

export interface PathNodeSummary {
  id: string;
  type: 'concept' | 'document';
  label: string;
  sublabel?: string;
}

export interface ConceptPathResult {
  from: string;
  to: string;
  found: boolean;
  length: number;
  nodes: PathNodeSummary[];
  steps: PathStep[];
}

export interface DocumentDetailResult {
  id: string;
  title: string;
  summary: string;
  status: DocStatus;
  review: DocReviewStatus;
  categoryPath: string[];
  bundleRelPath: string;
  concepts: string[];
  mentionedConcepts: string[];
  relatedDocs: string[];
  backlinks: string[];
  created?: string;
  updated?: string;
  body: string;
  notesSection: string;
  comments?: SentenceComment[];
  rawMarkdown?: string;
}

export interface DocumentAnnotationItem {
  docId: string;
  title: string;
  bundleRelPath: string;
  notesSection: string;
  comments: SentenceComment[];
}

export interface AnnotationsResult {
  totalUnresolvedComments: number;
  totalDocsWithNotes: number;
  items: DocumentAnnotationItem[];
}

export interface GraphOverviewResult {
  generatedAt: string;
  counts: {
    documents: number;
    concepts: number;
    edges: number;
    warnings: number;
  };
  categories: string[];
  concepts: Array<{
    concept_id: string;
    kind: string;
    en: string;
    zhHant: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    status: DocStatus;
    review: DocReviewStatus;
    categoryPath: string[];
  }>;
  warnings: string[];
}

function buildDocLookup(index: NexusIndex): Map<string, IndexedDocument> {
  return new Map(index.documents.map((d) => [d.id, d]));
}

function buildConceptLookup(index: NexusIndex): Map<string, OntologyConcept> {
  return new Map(index.concepts.map((c) => [c.concept_id, c]));
}

function enrichTopDocs(
  index: NexusIndex,
  docMap: Map<string, IndexedDocument>,
  conceptId: string,
): ConceptSearchHit['topDocs'] {
  const ranked = index.conceptTopDocs[conceptId] ?? [];
  return ranked.map((r) => ({
    docId: r.docId,
    title: docMap.get(r.docId)?.title ?? r.docId,
    linkType: r.linkType,
    score: r.score,
  }));
}

function scoreConcept(concept: OntologyConcept, rawQuery: string, queryTokens: string[]): number {
  const qLower = rawQuery.trim().toLowerCase();
  if (!qLower) return 0;

  let score = 0;

  const idLower = concept.concept_id.toLowerCase();
  const labels = [
    concept.labels.en,
    concept.labels['zh-Hant'],
    concept.labels['zh-Hans'],
  ].filter((v): v is string => Boolean(v));
  const aliases = concept.aliases ?? [];

  if (idLower === qLower) score += 12;
  else if (idLower.includes(qLower)) score += 6;

  for (const label of labels) {
    const lLower = label.toLowerCase();
    if (lLower === qLower) score += 10;
    else if (lLower.includes(qLower)) score += 5;
  }

  for (const alias of aliases) {
    const aLower = alias.toLowerCase();
    if (aLower === qLower) score += 8;
    else if (aLower.includes(qLower)) score += 4;
  }

  if (queryTokens.length > 0) {
    const labelTokens = new Set(
      [...labels, ...aliases].flatMap((t) => tokenizeBilingual(t)),
    );
    const contextTokens = new Set(
      [concept.contexts.en, concept.contexts['zh-Hant'], concept.contexts['zh-Hans'] ?? '']
        .flatMap((t) => tokenizeBilingual(t)),
    );

    let labelHits = 0;
    let contextHits = 0;
    for (const tok of queryTokens) {
      if (labelTokens.has(tok)) labelHits += 1;
      if (contextTokens.has(tok)) contextHits += 1;
    }

    score += (labelHits / queryTokens.length) * 4;
    score += (contextHits / queryTokens.length) * 1.5;
  }

  return Number(score.toFixed(4));
}

function scoreDocumentsBM25(
  documents: IndexedDocument[],
  rawQuery: string,
  queryTokens: string[],
): Map<string, number> {
  const scores = new Map<string, number>();
  const N = documents.length;
  if (N === 0) return scores;

  const qLower = rawQuery.trim().toLowerCase();
  const uniqueQueryTokens = Array.from(new Set(queryTokens));

  const docTFs: Map<string, number>[] = [];
  const docLengths: number[] = [];
  const df = new Map<string, number>();
  let totalLength = 0;

  for (const doc of documents) {
    const cleanBody = doc.body.replace(/\[\[(concept|doc)\.[a-z0-9_]+\]\]/g, ' ');
    const titleToks = tokenizeBilingual(doc.title);
    const summaryToks = tokenizeBilingual(doc.summary);
    const bodyToks = tokenizeBilingual(cleanBody);
    const tokens = [
      ...titleToks, ...titleToks, ...titleToks,
      ...summaryToks, ...summaryToks,
      ...bodyToks,
    ];

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

  for (let i = 0; i < N; i++) {
    const doc = documents[i];
    const tfMap = docTFs[i];
    const dl = docLengths[i];

    let bm25 = 0;
    for (const term of uniqueQueryTokens) {
      const tf = tfMap.get(term) ?? 0;
      if (tf === 0) continue;
      const termDf = df.get(term) ?? 0;
      const idf = Math.log((N - termDf + 0.5) / (termDf + 0.5) + 1);
      const norm = (tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + BM25_B * (dl / avgdl)));
      bm25 += idf * norm;
    }

    let boost = 0;
    if (qLower) {
      if (doc.id.toLowerCase() === qLower) boost += 10;
      else if (doc.id.toLowerCase().includes(qLower)) boost += 4;
      if (doc.title.toLowerCase().includes(qLower)) boost += 4;
      if (doc.summary.toLowerCase().includes(qLower)) boost += 1.5;
    }

    const total = bm25 + boost;
    if (total > 0) {
      scores.set(doc.id, Number(total.toFixed(4)));
    }
  }

  return scores;
}

function matchesCategoryScope(categoryPath: string[], category?: string): boolean {
  if (!category?.trim()) return true;
  const scope = category.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
  const docCat = categoryPath.join('/').toLowerCase();
  return docCat === scope || docCat.startsWith(`${scope}/`);
}

export function searchNexus(
  index: NexusIndex,
  query: string,
  options: { limit?: number; type?: 'all' | 'concept' | 'document'; category?: string } = {},
): SearchResult {
  const limit = Math.max(1, Math.min(options.limit ?? 8, 50));
  const type = options.type ?? 'all';
  const category = options.category?.trim() || undefined;
  const trimmed = query.trim();
  const queryTokens = tokenizeBilingual(trimmed);
  const scopedDocs = category
    ? index.documents.filter((d) => matchesCategoryScope(d.categoryPath, category))
    : index.documents;
  const scopedConceptIds = category
    ? new Set(scopedDocs.flatMap((d) => [...d.concepts, ...d.mentionedConcepts]))
    : null;
  const docMap = buildDocLookup(index);

  let concepts: ConceptSearchHit[] = [];
  if (type === 'all' || type === 'concept') {
    const candidateConcepts = scopedConceptIds
      ? index.concepts.filter((c) => scopedConceptIds.has(c.concept_id))
      : index.concepts;
    concepts = candidateConcepts
      .map((c) => ({
        concept_id: c.concept_id,
        kind: c.kind ?? 'concept',
        labels: c.labels,
        aliases: c.aliases ?? [],
        contexts: c.contexts,
        score: scoreConcept(c, trimmed, queryTokens),
        topDocs: enrichTopDocs(index, docMap, c.concept_id),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score || a.concept_id.localeCompare(b.concept_id))
      .slice(0, limit);
  }

  let documents: DocumentSearchHit[] = [];
  if (type === 'all' || type === 'document') {
    const docScores = scoreDocumentsBM25(scopedDocs, trimmed, queryTokens);
    documents = scopedDocs
      .map((d) => ({
        id: d.id,
        title: d.title,
        summary: d.summary,
        status: d.status,
        review: d.review,
        categoryPath: d.categoryPath,
        concepts: d.concepts,
        score: docScores.get(d.id) ?? 0,
      }))
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, limit);
  }

  return { query: trimmed, ...(category ? { category } : {}), concepts, documents };
}

/**
 * Ranks natural Markdown sections (## / ### / ####) via BM25 for fine-grained retrieval.
 */
export function searchSections(
  index: NexusIndex,
  query: string,
  options: { limit?: number; category?: string; docId?: string } = {},
): SectionSearchHit[] {
  const limit = Math.max(1, Math.min(options.limit ?? 8, 30));
  const trimmed = query.trim();
  if (!trimmed) return [];
  const queryTokens = Array.from(new Set(tokenizeBilingual(trimmed)));
  const qLower = trimmed.toLowerCase();

  let docs = index.documents;
  if (options.docId) {
    docs = docs.filter((d) => d.id === options.docId);
  } else if (options.category?.trim()) {
    docs = docs.filter((d) => matchesCategoryScope(d.categoryPath, options.category));
  }

  interface FlatSection {
    doc: IndexedDocument;
    heading: string;
    slug: string;
    level: number;
    content: string;
    tf: Map<string, number>;
    length: number;
  }

  const chunks: FlatSection[] = [];
  const df = new Map<string, number>();
  let totalLen = 0;

  for (const doc of docs) {
    const sections =
      doc.sections.length > 0
        ? doc.sections
        : [{ heading: doc.title, slug: '', level: 2, content: doc.body }];

    for (const sec of sections) {
      const cleanContent = sec.content.replace(/!?\[\[(concept|doc)\.[a-z0-9_]+(?:#[^\]]+)?\]\]/g, ' ');
      const headingToks = tokenizeBilingual(sec.heading);
      const bodyToks = tokenizeBilingual(cleanContent);
      const tokens = [...headingToks, ...headingToks, ...headingToks, ...bodyToks];
      const tf = new Map<string, number>();
      for (const tok of tokens) tf.set(tok, (tf.get(tok) ?? 0) + 1);
      for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
      totalLen += tokens.length;
      chunks.push({
        doc,
        heading: sec.heading,
        slug: sec.slug,
        level: sec.level,
        content: sec.content,
        tf,
        length: tokens.length,
      });
    }
  }

  const N = chunks.length;
  if (N === 0) return [];
  const avgdl = totalLen / N || 1;

  const hits: SectionSearchHit[] = [];
  for (const ch of chunks) {
    let bm25 = 0;
    for (const term of queryTokens) {
      const tf = ch.tf.get(term) ?? 0;
      if (tf === 0) continue;
      const termDf = df.get(term) ?? 0;
      const idf = Math.log((N - termDf + 0.5) / (termDf + 0.5) + 1);
      const norm = (tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + BM25_B * (ch.length / avgdl)));
      bm25 += idf * norm;
    }
    let boost = 0;
    if (ch.heading.toLowerCase().includes(qLower)) boost += 3.5;
    if (ch.content.toLowerCase().includes(qLower)) boost += 1.5;

    const score = Number((bm25 + boost).toFixed(4));
    if (score > 0) {
      const plain = ch.content.replace(/\s+/g, ' ').trim();
      hits.push({
        docId: ch.doc.id,
        docTitle: ch.doc.title,
        categoryPath: ch.doc.categoryPath,
        heading: ch.heading,
        slug: ch.slug,
        level: ch.level,
        snippet: plain.length > 260 ? `${plain.slice(0, 260)}...` : plain,
        score,
      });
    }
  }

  return hits
    .sort((a, b) => b.score - a.score || a.docId.localeCompare(b.docId))
    .slice(0, limit);
}

export function getConceptSubgraph(
  index: NexusIndex,
  conceptId: string,
  options: { hops?: number; includeDocs?: boolean } = {},
): ConceptSubgraphResult {
  const hops = Math.max(1, Math.min(options.hops ?? 1, 3));
  const includeDocs = options.includeDocs ?? true;
  const conceptMap = buildConceptLookup(index);
  const docMap = buildDocLookup(index);

  const centerConcept = conceptMap.get(conceptId);
  if (!centerConcept) {
    throw new Error(`Concept not found: ${conceptId}`);
  }

  // Undirected adjacency over concept-to-concept edges for BFS discovery
  const conceptEdges = index.graph.edges.filter(
    (e) => conceptMap.has(e.source) && conceptMap.has(e.target),
  );
  const adjacency = new Map<string, Set<string>>();
  for (const e of conceptEdges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, new Set());
    if (!adjacency.has(e.target)) adjacency.set(e.target, new Set());
    adjacency.get(e.source)!.add(e.target);
    adjacency.get(e.target)!.add(e.source);
  }

  const distances = new Map<string, number>([[conceptId, 0]]);
  const queue: string[] = [conceptId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dist = distances.get(current)!;
    if (dist >= hops) continue;

    for (const neighbor of adjacency.get(current) ?? []) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, dist + 1);
        queue.push(neighbor);
      }
    }
  }

  const discoveredConceptIds = new Set(distances.keys());
  const toNode = (c: OntologyConcept, distance: number): SubgraphConceptNode => ({
    concept_id: c.concept_id,
    kind: c.kind ?? 'concept',
    labels: c.labels,
    aliases: c.aliases ?? [],
    contexts: c.contexts,
    distance,
  });

  const concepts = Array.from(discoveredConceptIds)
    .map((id) => toNode(conceptMap.get(id)!, distances.get(id)!))
    .sort((a, b) => a.distance - b.distance || a.concept_id.localeCompare(b.concept_id));

  const subgraphEdges = conceptEdges.filter(
    (e) => discoveredConceptIds.has(e.source) && discoveredConceptIds.has(e.target),
  );

  const documents: SubgraphDocumentSummary[] = [];
  if (includeDocs) {
    const docLinks = new Map<string, Set<'explains' | 'mentions' | 'semantic'>>();

    const addDocLink = (docId: string, linkType: 'explains' | 'mentions' | 'semantic') => {
      if (!docMap.has(docId)) return;
      if (!docLinks.has(docId)) docLinks.set(docId, new Set());
      docLinks.get(docId)!.add(linkType);
    };

    for (const e of index.graph.edges) {
      if (
        (e.type === 'explains' || e.type === 'mentions') &&
        discoveredConceptIds.has(e.target) &&
        docMap.has(e.source)
      ) {
        addDocLink(e.source, e.type);
        subgraphEdges.push(e);
      }
    }

    // Also include BM25 topDocs for the center concept
    for (const ranked of index.conceptTopDocs[conceptId] ?? []) {
      addDocLink(ranked.docId, ranked.linkType);
    }

    for (const [docId, linkTypeSet] of docLinks.entries()) {
      const doc = docMap.get(docId)!;
      documents.push({
        id: doc.id,
        title: doc.title,
        summary: doc.summary,
        status: doc.status,
        review: doc.review,
        categoryPath: doc.categoryPath,
        linkTypes: Array.from(linkTypeSet),
      });
    }
    documents.sort((a, b) => a.id.localeCompare(b.id));
  }

  return {
    center: {
      ...toNode(centerConcept, 0),
      topDocs: enrichTopDocs(index, docMap, conceptId),
    },
    hops,
    concepts,
    edges: subgraphEdges,
    documents,
  };
}

export function findConceptPath(
  index: NexusIndex,
  fromId: string,
  toId: string,
  options: { maxDepth?: number; includeDocs?: boolean } = {},
): ConceptPathResult {
  const maxDepth = Math.max(1, Math.min(options.maxDepth ?? 6, 12));
  const nodeMap = new Map(index.graph.nodes.map((n) => [n.id, n]));

  if (!nodeMap.has(fromId)) throw new Error(`Node not found: ${fromId}`);
  if (!nodeMap.has(toId)) throw new Error(`Node not found: ${toId}`);

  const allowDocs =
    options.includeDocs ??
    (nodeMap.get(fromId)!.type === 'document' || nodeMap.get(toId)!.type === 'document');

  const toSummary = (id: string): PathNodeSummary => {
    const n = nodeMap.get(id)!;
    return {
      id: n.id,
      type: n.type,
      label: n.label,
      sublabel: n.sublabel,
    };
  };

  if (fromId === toId) {
    return {
      from: fromId,
      to: toId,
      found: true,
      length: 0,
      nodes: [toSummary(fromId)],
      steps: [],
    };
  }

  const adj = new Map<string, Array<{ next: string; edge: GraphEdge; direction: 'forward' | 'reverse' }>>();
  for (const edge of index.graph.edges) {
    const srcNode = nodeMap.get(edge.source);
    const dstNode = nodeMap.get(edge.target);
    if (!srcNode || !dstNode) continue;
    if (!allowDocs && (srcNode.type === 'document' || dstNode.type === 'document')) continue;

    if (!adj.has(edge.source)) adj.set(edge.source, []);
    if (!adj.has(edge.target)) adj.set(edge.target, []);
    adj.get(edge.source)!.push({ next: edge.target, edge, direction: 'forward' });
    adj.get(edge.target)!.push({ next: edge.source, edge, direction: 'reverse' });
  }

  const visited = new Set<string>([fromId]);
  const parent = new Map<string, { prev: string; step: PathStep }>();
  const depth = new Map<string, number>([[fromId, 0]]);
  const queue: string[] = [fromId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const d = depth.get(current)!;
    if (d >= maxDepth) continue;

    for (const item of adj.get(current) ?? []) {
      if (visited.has(item.next)) continue;
      visited.add(item.next);
      depth.set(item.next, d + 1);
      parent.set(item.next, {
        prev: current,
        step: {
          from: current,
          to: item.next,
          edgeType: item.edge.type,
          direction: item.direction,
        },
      });

      if (item.next === toId) {
        const steps: PathStep[] = [];
        const nodeIds: string[] = [toId];
        let cursor = toId;
        while (parent.has(cursor)) {
          const p = parent.get(cursor)!;
          steps.push(p.step);
          nodeIds.push(p.prev);
          cursor = p.prev;
        }
        steps.reverse();
        nodeIds.reverse();
        return {
          from: fromId,
          to: toId,
          found: true,
          length: steps.length,
          nodes: nodeIds.map(toSummary),
          steps,
        };
      }

      queue.push(item.next);
    }
  }

  return {
    from: fromId,
    to: toId,
    found: false,
    length: -1,
    nodes: [],
    steps: [],
  };
}

export function getDocumentDetail(
  index: NexusIndex,
  docId: string,
  options: { includeComments?: boolean; includeRaw?: boolean } = {},
): DocumentDetailResult {
  const doc = index.documents.find((d) => d.id === docId);
  if (!doc) {
    throw new Error(`Document not found: ${docId}`);
  }

  const detail: DocumentDetailResult = {
    id: doc.id,
    title: doc.title,
    summary: doc.summary,
    status: doc.status,
    review: doc.review,
    categoryPath: doc.categoryPath,
    bundleRelPath: doc.bundleRelPath,
    concepts: doc.concepts,
    mentionedConcepts: doc.mentionedConcepts,
    relatedDocs: doc.relatedDocs,
    backlinks: doc.backlinks,
    created: doc.created,
    updated: doc.updated,
    body: doc.body,
    notesSection: doc.notesSection,
  };

  if (options.includeComments) {
    detail.comments = doc.comments;
  }
  if (options.includeRaw) {
    detail.rawMarkdown = doc.rawMarkdown;
  }

  return detail;
}

export function listAnnotations(
  index: NexusIndex,
  options: { includeResolved?: boolean } = {},
): AnnotationsResult {
  const includeResolved = options.includeResolved ?? false;
  const items: DocumentAnnotationItem[] = [];
  let totalUnresolvedComments = 0;
  let totalDocsWithNotes = 0;

  for (const doc of index.documents) {
    const unresolvedCount = doc.comments.filter((c) => !c.resolved).length;
    totalUnresolvedComments += unresolvedCount;

    const filteredComments = includeResolved
      ? doc.comments
      : doc.comments.filter((c) => !c.resolved);

    const trimmedNotes = doc.notesSection.trim();
    if (trimmedNotes) totalDocsWithNotes += 1;

    if (filteredComments.length > 0 || trimmedNotes) {
      items.push({
        docId: doc.id,
        title: doc.title,
        bundleRelPath: doc.bundleRelPath,
        notesSection: trimmedNotes,
        comments: filteredComments,
      });
    }
  }

  return {
    totalUnresolvedComments,
    totalDocsWithNotes,
    items,
  };
}

export function getGraphOverview(index: NexusIndex): GraphOverviewResult {
  const topCategories = index.tree
    .filter((n) => n.type === 'category')
    .map((n) => n.name);

  return {
    generatedAt: index.generatedAt,
    counts: {
      documents: index.documents.length,
      concepts: index.concepts.length,
      edges: index.graph.edges.length,
      warnings: index.warnings.length,
    },
    categories: topCategories,
    concepts: index.concepts.map((c) => ({
      concept_id: c.concept_id,
      kind: c.kind ?? 'concept',
      en: c.labels.en,
      zhHant: c.labels['zh-Hant'],
    })),
    documents: index.documents.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      review: d.review,
      categoryPath: d.categoryPath,
    })),
    warnings: index.warnings,
  };
}
