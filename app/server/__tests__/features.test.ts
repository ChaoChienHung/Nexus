import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { askNexusVault, formatUserAskMessage } from '../ask';
import { buildNexusIndex } from '../indexer';
import {
  extractDocumentSections,
  extractRawSourceRefs,
  extractWikiLinks,
  slugifyHeading,
} from '../markdown';
import { searchNexus, searchSections } from '../query';

const sampleKnowledgeDir = path.resolve(__dirname, '../../../knowledge');

describe('Section extraction, deep-links, transclusion & provenance', () => {
  it('extracts ## / ### sections while ignoring fenced code blocks', () => {
    const md = [
      '# Title',
      '',
      'Intro paragraph.',
      '',
      '## 核心概念 Core Idea',
      'First section body.',
      '',
      '```markdown',
      '## Not a real heading',
      '```',
      '',
      '### 子節 Details',
      'Nested detail line.',
      '',
      '## 總結',
      'Closing thoughts.',
    ].join('\n');

    const sections = extractDocumentSections(md);
    expect(sections).toHaveLength(3);
    expect(sections[0].heading).toBe('核心概念 Core Idea');
    expect(sections[0].slug).toBe(slugifyHeading('核心概念 Core Idea'));
    expect(sections[0].content).toContain('Nested detail line.');
    expect(sections[1].heading).toBe('子節 Details');
    expect(sections[1].level).toBe(3);
    expect(sections[2].heading).toBe('總結');
  });

  it('parses section deep-links [[doc#heading]] and transclusions ![[doc#heading]]', () => {
    const body =
      'See [[doc.alpha#Core Idea]], embed ![[doc.beta#Comparison Table]], and [[concept.noise]].';
    const links = extractWikiLinks(body);
    expect(links.conceptIds).toEqual(['concept.noise']);
    expect(links.docIds).toEqual(['doc.alpha', 'doc.beta']);
    expect(links.sectionLinks).toEqual([
      { docId: 'doc.alpha', section: 'Core Idea', transclusion: false },
      { docId: 'doc.beta', section: 'Comparison Table', transclusion: true },
    ]);
  });

  it('extracts raw/ provenance links from body and frontmatter', () => {
    const refs = extractRawSourceRefs('Read [Paper](raw/papers/attention.pdf#page=4) for proof.', {
      id: 'doc.test',
      title: 'Test',
      sources: ['raw/notes/clipping.md'],
    });
    expect(refs).toEqual(['papers/attention.pdf', 'notes/clipping.md']);
  });
});

describe('Scoped search, section BM25, and offline Ask Vault', () => {
  it('supports category-scoped searchNexus and heading-level searchSections', () => {
    const index = buildNexusIndex(sampleKnowledgeDir, { includeDrafts: true });
    expect(index.documents.length).toBeGreaterThan(0);

    const firstCategory = index.documents[0].categoryPath[0];
    const scoped = searchNexus(index, index.documents[0].title, {
      category: firstCategory,
    });
    expect(scoped.category).toBe(firstCategory);
    expect(scoped.documents.every((d) => d.categoryPath[0] === firstCategory)).toBe(true);

    const sectionHits = searchSections(index, index.documents[0].title, { limit: 5 });
    expect(sectionHits.length).toBeGreaterThan(0);
    expect(sectionHits[0].docId).toBeTruthy();
  });

  it('returns grounded citations in retrieval mode without needing an LLM', async () => {
    const index = buildNexusIndex(sampleKnowledgeDir, { includeDrafts: true });
    const firstDoc = index.documents[0];
    const res = await askNexusVault(index, {
      question: firstDoc.title,
      scope: 'doc',
      docId: firstDoc.id,
      provider: 'retrieval',
      lang: 'en',
    });

    expect(res.providerUsed).toBe('retrieval');
    expect(res.answer.length).toBeGreaterThan(0);
    expect(res.citations.length).toBeGreaterThan(0);
    expect(res.citations[0].docId).toBe(firstDoc.id);
  });

  it('formats multiple cite-ask pairs and grounds retrieval even when overall question is empty', async () => {
    const index = buildNexusIndex(sampleKnowledgeDir, { includeDrafts: true });
    const firstDoc = index.documents[0];
    const citedItems = [
      {
        id: 'c1',
        docId: firstDoc.id,
        docTitle: firstDoc.title,
        quote: firstDoc.title,
        question: 'What is the main intuition?',
      },
      {
        id: 'c2',
        docId: firstDoc.id,
        docTitle: firstDoc.title,
        quote: firstDoc.summary || firstDoc.title,
        question: '',
      },
    ];

    const formatted = formatUserAskMessage('Compare both.', citedItems, 'en');
    expect(formatted).toContain(`[Citation 1 | ${firstDoc.title}]`);
    expect(formatted).toContain('Question for this citation: What is the main intuition?');
    expect(formatted).toContain(`[Citation 2 | ${firstDoc.title}]`);
    expect(formatted).toContain('Compare both.');

    const res = await askNexusVault(index, {
      question: '',
      citedItems,
      scope: 'doc',
      docId: firstDoc.id,
      provider: 'retrieval',
      lang: 'en',
    });
    expect(res.providerUsed).toBe('retrieval');
    expect(res.citations.length).toBeGreaterThan(0);
  });
});
