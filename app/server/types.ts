export type DocStatus = 'draft' | 'seed' | 'evergreen';

export type ConceptRelationType =
  | 'is_a'
  | 'part_of'
  | 'generalizes'
  | 'example_of'
  | 'depends_on'
  | 'enables'
  | 'solves'
  | 'used_in'
  | 'influences'
  | 'contrasts_with'
  | 'relates_to';

export interface ConceptRelation {
  type: ConceptRelationType;
  target: string;
}

export interface OntologyConcept {
  concept_id: string;
  kind?: 'task' | 'method' | 'principle' | 'architecture' | 'metric' | 'framework' | 'concept';
  labels: {
    en: string;
    'zh-Hant': string;
    'zh-Hans'?: string;
  };
  aliases?: string[];
  contexts: {
    en: string;
    'zh-Hant': string;
    'zh-Hans'?: string;
  };
  relations?: ConceptRelation[];
  references?: string[];
}

export interface ReferenceItem {
  ref_id: string;
  type: string;
  title: string;
  authors?: string[];
  year?: number;
  url?: string;
  notes?: string;
}

export interface SentenceComment {
  id: string;
  quote: string;
  prefix: string;
  suffix: string;
  body: string;
  resolved: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommentsFile {
  version: number;
  doc_id: string;
  comments: SentenceComment[];
}

export interface DocumentFrontmatter {
  id: string;
  title: string;
  summary?: string;
  concepts?: string[];
  references?: string[];
  related_docs?: string[];
  status?: DocStatus;
  created?: string;
  updated?: string;
  [key: string]: unknown;
}

export interface IndexedDocument {
  id: string;
  title: string;
  summary: string;
  status: DocStatus;
  categoryPath: string[];
  slug: string;
  bundleRelPath: string;
  frontmatter: DocumentFrontmatter;
  rawMarkdown: string;
  body: string;
  notesSection: string;
  concepts: string[];
  mentionedConcepts: string[];
  references: string[];
  relatedDocs: string[];
  backlinks: string[];
  comments: SentenceComment[];
  created?: string;
  updated?: string;
}

export interface CategoryTreeNode {
  name: string;
  path: string;
  type: 'category' | 'document';
  docId?: string;
  title?: string;
  status?: DocStatus;
  children?: CategoryTreeNode[];
}

export type GraphNodeType = 'concept' | 'document';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  sublabel?: string;
  kind?: string;
  status?: DocStatus;
}

export type GraphEdgeType =
  | ConceptRelationType
  | 'explains'
  | 'mentions'
  | 'links_to';

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
}

export interface ConceptRankedDoc {
  docId: string;
  score: number;
  bm25Score: number;
  linkType: 'explains' | 'mentions' | 'semantic';
}

export interface NexusIndex {
  generatedAt: string;
  tree: CategoryTreeNode[];
  documents: IndexedDocument[];
  concepts: OntologyConcept[];
  conceptTopDocs: Record<string, ConceptRankedDoc[]>;
  references: ReferenceItem[];
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  warnings: string[];
}
