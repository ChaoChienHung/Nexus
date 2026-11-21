import type { GraphEdgeType, OntologyConcept } from '../server/types';

export type UiLang = 'zh-Hant' | 'en';

export const SUPPORTED_LANGUAGES: { value: UiLang; label: string }[] = [
  { value: 'zh-Hant', label: '繁體中文' },
  { value: 'en', label: 'English' },
];

const RELATION_LABELS: Record<UiLang, Record<GraphEdgeType, string>> = {
  'zh-Hant': {
    is_a: '屬於',
    part_of: '隸屬於',
    generalizes: '泛化',
    example_of: '實例',
    depends_on: '依賴於',
    enables: '促成',
    solves: '解決',
    used_in: '應用於',
    influences: '影響',
    contrasts_with: '對照',
    relates_to: '相關',
    explains: '闡述',
    mentions: '提及',
    links_to: '連結至',
  },
  en: {
    is_a: 'is a',
    part_of: 'part of',
    generalizes: 'generalizes',
    example_of: 'example of',
    depends_on: 'depends on',
    enables: 'enables',
    solves: 'solves',
    used_in: 'used in',
    influences: 'influences',
    contrasts_with: 'contrasts with',
    relates_to: 'relates to',
    explains: 'explains',
    mentions: 'mentions',
    links_to: 'links to',
  },
};

const KIND_LABELS: Record<UiLang, Record<string, string>> = {
  'zh-Hant': {
    task: '任務',
    method: '方法',
    principle: '原則',
    architecture: '架構',
    metric: '指標',
    framework: '框架',
    concept: '概念',
  },
  en: {
    task: 'task',
    method: 'method',
    principle: 'principle',
    architecture: 'architecture',
    metric: 'metric',
    framework: 'framework',
    concept: 'concept',
  },
};

export function formatRelationLabel(type: GraphEdgeType | string, lang: UiLang): string {
  return RELATION_LABELS[lang][type as GraphEdgeType] ?? type.replace(/_/g, ' ');
}

export function formatConceptKind(kind: string | undefined, lang: UiLang): string {
  const k = kind ?? 'concept';
  return KIND_LABELS[lang][k] ?? k;
}

export function getConceptLabel(concept: OntologyConcept, lang: UiLang): string {
  return lang === 'zh-Hant'
    ? concept.labels['zh-Hant'] || concept.labels.en
    : concept.labels.en || concept.labels['zh-Hant'];
}

export function getConceptContext(concept: OntologyConcept, lang: UiLang): string {
  return lang === 'zh-Hant'
    ? concept.contexts['zh-Hant'] || concept.contexts.en
    : concept.contexts.en || concept.contexts['zh-Hant'];
}

export const UI_COPY = {
  'zh-Hant': {
    search: '搜尋',
    searchPlaceholder: '搜尋文件、術語或參考文獻...',
    knowledgeGraph: '知識圖譜',
    terminology: '術語庫',
    documents: '文件',
    docsCount: (n: number) => `${n} 篇文件`,
    termsCount: (n: number) => `${n} 個術語`,
    settings: '設定',
    appearance: '外觀主題',
    light: '淺色',
    dark: '深色',
    language: '語言',
    languageHint: '統一控制介面、術語概念與知識圖譜關係語言（文章正文維持原文）',
    edit: '編輯',
    save: '儲存',
    saving: '儲存中...',
    cancel: '取消',
    relatedTermsCount: (n: number) => `${n} 個相關術語`,
    references: '參考文獻',
    relatedDocuments: '相關文件',
    topRelatedDocuments: '最相關文件',
    comments: '評論',
    notes: '備註',
    termsTab: '術語',
    noComments: '選取文章中任意句子即可新增評論。',
    addComment: '新增評論',
    commentPlaceholder: '寫下針對這句話的想法...',
    notesPlaceholder: '寫下這篇文件的延伸想法或備註...',
    saveNotes: '儲存備註',
    noLinkedTerms: '本篇文件尚未連結任何術語。',
    keyConcepts: '核心概念',
    alsoMentioned: '內文提及',
    allDocTerms: (n: number) => `本篇所有術語 (${n})`,
    relations: '概念關係',
    fullNexus: '完整圖譜',
    conceptsOnly: '僅概念',
    localGraph: '局部視角',
    legend: '圖例',
    conceptNode: '概念',
    documentNode: '文件',
    readDoc: (title: string) => `閱讀「${title}」`,
    noLinkedDocs: '尚無相關文件。',
    terminologySub: (n: number) => `知識庫中共收錄 ${n} 個核心概念`,
    filterTerms: '篩選術語...',
    noSearchResults: '找不到符合的文件、術語或參考文獻。',
    copyMarkdown: '複製 Markdown',
    copiedMarkdown: '已複製 Markdown',
    downloadMarkdown: '下載 Markdown',
    legendNodes: '節點',
    legendRelations: '關係線型',
    edgeHierarchy: '階層（屬於 / 隸屬）',
    edgeCausal: '因果（依賴 / 促成）',
    edgeContrast: '對照（雙向）',
    edgeAssociation: '關聯 / 提及',
    edgeExplains: '闡述概念',
    edgeDocLink: '文件互連',
  },
  en: {
    search: 'Search',
    searchPlaceholder: 'Search documents, terminology, or references...',
    knowledgeGraph: 'Knowledge Graph',
    terminology: 'Terminology',
    documents: 'Documents',
    docsCount: (n: number) => `${n} docs`,
    termsCount: (n: number) => `${n} terms`,
    settings: 'Settings',
    appearance: 'Appearance',
    light: 'Light',
    dark: 'Dark',
    language: 'Language',
    languageHint: 'Controls UI, Ontology concepts, and Knowledge Graph relations (articles keep their original language)',
    edit: 'Edit',
    save: 'Save',
    saving: 'Saving...',
    cancel: 'Cancel',
    relatedTermsCount: (n: number) => `${n} related terms`,
    references: 'References',
    relatedDocuments: 'Related Documents',
    topRelatedDocuments: 'Top Related Documents',
    comments: 'Comments',
    notes: 'Notes',
    termsTab: 'Terms',
    noComments: 'Select text in the article to leave a comment.',
    addComment: 'Comment',
    commentPlaceholder: 'Write a comment anchored to this sentence...',
    notesPlaceholder: 'Write notes or marginalia...',
    saveNotes: 'Save Notes',
    noLinkedTerms: 'No linked terms in this document yet.',
    keyConcepts: 'Key Concepts',
    alsoMentioned: 'Also Mentioned',
    allDocTerms: (n: number) => `All terms in document (${n})`,
    relations: 'Relations',
    fullNexus: 'Full Nexus',
    conceptsOnly: 'Concepts',
    localGraph: 'Local',
    legend: 'Legend',
    conceptNode: 'Concept',
    documentNode: 'Document',
    readDoc: (title: string) => `Read “${title}”`,
    noLinkedDocs: 'No linked documents yet.',
    terminologySub: (n: number) => `${n} canonical concepts across your knowledge base`,
    filterTerms: 'Filter terms...',
    noSearchResults: 'No matching documents, terminology, or references.',
    copyMarkdown: 'Copy Markdown',
    copiedMarkdown: 'Copied Markdown',
    downloadMarkdown: 'Download Markdown',
    legendNodes: 'Nodes',
    legendRelations: 'Relations',
    edgeHierarchy: 'Hierarchy (is a / part of)',
    edgeCausal: 'Causal (depends / enables)',
    edgeContrast: 'Contrast (bidirectional)',
    edgeAssociation: 'Related / Mentions',
    edgeExplains: 'Explains concept',
    edgeDocLink: 'Document link',
  },
} as const;
