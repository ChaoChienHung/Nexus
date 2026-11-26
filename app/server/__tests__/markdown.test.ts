import { describe, expect, it } from 'vitest';
import {
  extractNotesSection,
  extractWikiLinks,
  updateDocumentReviewStatus,
  updateNotesSection,
} from '../markdown';

const SAMPLE_MD = `---
id: doc.sample
title: Sample Doc
concepts:
  - concept.clustering
status: evergreen
---

# Sample Doc

Body paragraph mentioning [[concept.noise]] and [[doc.other]].

## Details

Keep this exact formatting.

## 備註

- Initial note line.
`;

describe('markdown round-trip utilities', () => {
  it('extracts existing ## 備註 section cleanly', () => {
    const res = extractNotesSection(SAMPLE_MD);
    expect(res.exists).toBe(true);
    expect(res.heading).toBe('## 備註');
    expect(res.content).toBe('- Initial note line.');
  });

  it('updates ## 備註 surgically without altering frontmatter or body byte-for-byte', () => {
    const updated = updateNotesSection(SAMPLE_MD, '- Updated note 1.\n- Updated note 2.');
    const beforeNotesOrig = SAMPLE_MD.split('## 備註')[0];
    const beforeNotesUpdated = updated.split('## 備註')[0];

    expect(beforeNotesUpdated).toBe(beforeNotesOrig);
    expect(extractNotesSection(updated).content).toBe('- Updated note 1.\n- Updated note 2.');
  });

  it('appends ## 備註 when absent without touching existing content', () => {
    const withoutNotes = `---\nid: doc.no_notes\ntitle: No Notes\n---\n\n# Hello\n\nParagraph.\n`;
    const updated = updateNotesSection(withoutNotes, '- Added marginalia.');
    expect(updated).toContain('## 備註\n\n- Added marginalia.\n');
    expect(updated.startsWith('---\nid: doc.no_notes\ntitle: No Notes\n---\n\n# Hello\n\nParagraph.')).toBe(true);
  });

  it('extracts wiki-links for concepts and docs', () => {
    const links = extractWikiLinks(SAMPLE_MD);
    expect(links.conceptIds).toEqual(['concept.noise']);
    expect(links.docIds).toEqual(['doc.other']);
  });

  it('inserts review after status without altering unrelated frontmatter or body byte-for-byte', () => {
    const updated = updateDocumentReviewStatus(SAMPLE_MD, 'reviewed');
    const origBody = SAMPLE_MD.split('---\n\n')[1];
    const updatedBody = updated.split('---\n\n')[1];

    expect(updatedBody).toBe(origBody);
    expect(updated).toContain('status: evergreen\nreview: reviewed\n---');
  });

  it('updates an existing review field in-place cleanly', () => {
    const withReview = updateDocumentReviewStatus(SAMPLE_MD, 'reviewed');
    const toggledBack = updateDocumentReviewStatus(withReview, 'fresh');

    expect(toggledBack).toContain('status: evergreen\nreview: fresh\n---');
    expect(toggledBack.match(/^review:/gm)).toHaveLength(1);
    expect(toggledBack.split('---\n\n')[1]).toBe(SAMPLE_MD.split('---\n\n')[1]);
  });
});
