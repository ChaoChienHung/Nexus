export type DocStatus = 'draft' | 'seed' | 'evergreen';
export type DocReviewStatus = 'fresh' | 'reviewed';

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
  related_docs?: string[];
  status?: DocStatus;
  review?: DocReviewStatus;
  created?: string;
  updated?: string;
  [key: string]: unknown;
}

export interface DocumentSection {
  heading: string;
  slug: string;
  level: number;
  content: string;
}

export interface RawFileEntry {
  relPath: string;
  name: string;
  ext: string;
  size: number;
  modified: string;
  referencedBy: Array<{ docId: string; title: string }>;
  status: 'pending' | 'compiled';
}

export interface VaultOption {
  label: string;
  path: string;
  exists: boolean;
  isDefault?: boolean;
}

export interface IndexedDocument {
  id: string;
  title: string;
  summary: string;
  status: DocStatus;
  review: DocReviewStatus;
  categoryPath: string[];
  slug: string;
  bundleRelPath: string;
  frontmatter: DocumentFrontmatter;
  rawMarkdown: string;
  body: string;
  notesSection: string;
  sections: DocumentSection[];
  rawSources: string[];
  concepts: string[];
  mentionedConcepts: string[];
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
  review?: DocReviewStatus;
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
  weight?: number;
  redundant?: boolean;
  prunedReason?: 'transitive' | 'cap';
  coveredBy?: string;
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
  rawFiles: RawFileEntry[];
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  warnings: string[];
}

export interface MentorionCapability {
  configured: boolean;
  online: boolean;
  apiUrl: string | null;
  appUrl?: string | null;
  checkedAt: string;
  error?: string;
}

export interface NexusCapabilities {
  vault: {
    source: 'env' | 'dotenv' | 'default' | 'runtime';
    path?: string;
    label?: string;
  };
  mentorion: MentorionCapability;
}
