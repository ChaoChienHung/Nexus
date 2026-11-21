import fs from 'node:fs';
import path from 'node:path';
import { extractWikiLinks, parseDocumentMarkdown } from './markdown';
import type {
  CategoryTreeNode,
  CommentsFile,
  DocStatus,
  GraphEdge,
  GraphNode,
  IndexedDocument,
  NexusIndex,
  OntologyConcept,
  ReferenceItem,
  SentenceComment,
} from './types';

export interface IndexerOptions {
  includeDrafts?: boolean;
}

function readJsonSafe<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

function normalizeDate(val: unknown): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val);
}

function normalizeStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map((v) => String(v).trim()).filter(Boolean);
}

export function buildNexusIndex(
  knowledgeDir: string,
  options: IndexerOptions = {},
): NexusIndex {
  const includeDrafts = options.includeDrafts ?? true;
  const warnings: string[] = [];

  const conceptsPath = path.join(knowledgeDir, 'data', 'ontology', 'concepts.json');
  const referencesPath = path.join(knowledgeDir, 'data', 'references.json');
  const docsRoot = path.join(knowledgeDir, 'docs');

  const conceptsFile = readJsonSafe<{ concepts?: OntologyConcept[] }>(conceptsPath, { concepts: [] });
  const referencesFile = readJsonSafe<{ references?: ReferenceItem[] }>(referencesPath, { references: [] });

  const concepts = conceptsFile.concepts ?? [];
  const references = referencesFile.references ?? [];

  const conceptMap = new Map(concepts.map((c) => [c.concept_id, c]));
  const refMap = new Map(references.map((r) => [r.ref_id, r]));

  const documents: IndexedDocument[] = [];
  const seenDocIds = new Set<string>();

  function walkDir(dirPath: string, relSegments: string[]): CategoryTreeNode[] {
    if (!fs.existsSync(dirPath)) return [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name));

    const nodes: CategoryTreeNode[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const nextSegments = [...relSegments, entry.name];
      const indexMdPath = path.join(fullPath, 'index.md');

      if (fs.existsSync(indexMdPath)) {
        const rawMarkdown = fs.readFileSync(indexMdPath, 'utf-8');
        const parsed = parseDocumentMarkdown(rawMarkdown);
        const fm = parsed.frontmatter;
        const status = (fm.status ?? 'seed') as DocStatus;

        if (!includeDrafts && status === 'draft') {
          continue;
        }

        const docId = fm.id ? String(fm.id) : `doc.${entry.name.replace(/-/g, '_')}`;
        if (!fm.id) {
          warnings.push(`Document at ${nextSegments.join('/')} is missing frontmatter id; inferred ${docId}.`);
        }
        if (seenDocIds.has(docId)) {
          warnings.push(`Duplicate document id detected: ${docId} (${nextSegments.join('/')}).`);
        }
        seenDocIds.add(docId);

        const commentsPath = path.join(fullPath, 'comments.json');
        const commentsFile = readJsonSafe<CommentsFile | null>(commentsPath, null);
        const comments: SentenceComment[] = commentsFile?.comments ?? [];

        const fmConcepts = normalizeStringArray(fm.concepts);
        const fmRefs = normalizeStringArray(fm.references);
        const fmRelatedDocs = normalizeStringArray(fm.related_docs);
        const wikiLinks = extractWikiLinks(parsed.body);

        const mentionedConcepts = wikiLinks.conceptIds.filter((c) => !fmConcepts.includes(c));
        const allRelatedDocs = Array.from(new Set([...fmRelatedDocs, ...wikiLinks.docIds]))
          .filter((d) => d !== docId);

        for (const cid of [...fmConcepts, ...mentionedConcepts]) {
          if (!conceptMap.has(cid)) {
            warnings.push(`Document ${docId} references unknown concept: ${cid}`);
          }
        }
        for (const rid of fmRefs) {
          if (!refMap.has(rid)) {
            warnings.push(`Document ${docId} cites unknown reference: ${rid}`);
          }
        }

        const doc: IndexedDocument = {
          id: docId,
          title: fm.title ? String(fm.title) : entry.name,
          summary: fm.summary ? String(fm.summary) : '',
          status,
          categoryPath: relSegments,
          slug: entry.name,
          bundleRelPath: nextSegments.join('/'),
          frontmatter: fm,
          rawMarkdown,
          body: parsed.body,
          notesSection: parsed.notesSection,
          concepts: fmConcepts,
          mentionedConcepts,
          references: fmRefs,
          relatedDocs: allRelatedDocs,
          backlinks: [],
          comments,
          created: normalizeDate(fm.created),
          updated: normalizeDate(fm.updated),
        };

        documents.push(doc);
        nodes.push({
          name: entry.name,
          path: nextSegments.join('/'),
          type: 'document',
          docId: doc.id,
          title: doc.title,
          status: doc.status,
        });
      } else {
        const children = walkDir(fullPath, nextSegments);
        if (children.length > 0) {
          nodes.push({
            name: entry.name,
            path: nextSegments.join('/'),
            type: 'category',
            children,
          });
        }
      }
    }

    return nodes;
  }

  const tree = walkDir(docsRoot, []);

  // Compute backlinks
  const docMap = new Map(documents.map((d) => [d.id, d]));
  for (const doc of documents) {
    for (const targetDocId of doc.relatedDocs) {
      const target = docMap.get(targetDocId);
      if (target && !target.backlinks.includes(doc.id)) {
        target.backlinks.push(doc.id);
      } else if (!target) {
        warnings.push(`Document ${doc.id} links to unknown document: ${targetDocId}`);
      }
    }
  }

  // Build Knowledge Graph
  const graphNodes: GraphNode[] = [];
  const graphEdges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();

  function addEdge(source: string, target: string, type: GraphEdge['type']) {
    const key = `${source}|${type}|${target}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    graphEdges.push({ id: key, source, target, type });
  }

  for (const c of concepts) {
    graphNodes.push({
      id: c.concept_id,
      type: 'concept',
      label: c.labels['zh-Hant'] || c.labels.en,
      sublabel: c.labels.en,
      kind: c.kind ?? 'concept',
    });
  }

  for (const c of concepts) {
    for (const rel of c.relations ?? []) {
      if (conceptMap.has(rel.target)) {
        addEdge(c.concept_id, rel.target, rel.type);
      } else {
        warnings.push(`Concept ${c.concept_id} has relation to unknown target: ${rel.target}`);
      }
    }
  }

  for (const r of references) {
    graphNodes.push({
      id: r.ref_id,
      type: 'reference',
      label: r.title,
      sublabel: r.year ? `${r.authors?.[0] ?? ''} (${r.year})`.trim() : r.authors?.[0],
      kind: r.type,
    });
  }

  for (const d of documents) {
    graphNodes.push({
      id: d.id,
      type: 'document',
      label: d.title,
      sublabel: d.categoryPath.join(' / '),
      status: d.status,
    });

    for (const cid of d.concepts) {
      if (conceptMap.has(cid)) addEdge(d.id, cid, 'explains');
    }
    for (const cid of d.mentionedConcepts) {
      if (conceptMap.has(cid)) addEdge(d.id, cid, 'mentions');
    }
    for (const targetDocId of d.relatedDocs) {
      if (docMap.has(targetDocId)) addEdge(d.id, targetDocId, 'links_to');
    }
    for (const rid of d.references) {
      if (refMap.has(rid)) addEdge(d.id, rid, 'cites');
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    tree,
    documents,
    concepts,
    references,
    graph: {
      nodes: graphNodes,
      edges: graphEdges,
    },
    warnings,
  };
}
