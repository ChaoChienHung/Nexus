import matter from 'gray-matter';
import type { DocumentFrontmatter } from './types';

export interface ParsedDocument {
  frontmatter: DocumentFrontmatter;
  body: string;
  notesSection: string;
}

const NOTES_HEADING_RE = /^##[ \t]+(備註|Notes)[ \t]*$/m;

function findFrontmatterEndOffset(raw: string): number {
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  return match ? match[0].length : 0;
}

export function extractNotesSection(raw: string): {
  exists: boolean;
  heading: string;
  content: string;
} {
  const fmEnd = findFrontmatterEndOffset(raw);
  const bodyPart = raw.slice(fmEnd);
  const headingMatch = bodyPart.match(NOTES_HEADING_RE);

  if (!headingMatch || headingMatch.index === undefined) {
    return { exists: false, heading: '## 備註', content: '' };
  }

  const headingLine = headingMatch[0];
  const afterHeadingIdx = headingMatch.index + headingLine.length;
  const remainder = bodyPart.slice(afterHeadingIdx);

  // Stop at the next level-2 heading if one exists
  const nextH2 = remainder.match(/\r?\n##[ \t]+/);
  const sectionRaw = nextH2 && nextH2.index !== undefined
    ? remainder.slice(0, nextH2.index)
    : remainder;

  return {
    exists: true,
    heading: headingLine.trim(),
    content: sectionRaw.replace(/^\r?\n+/, '').replace(/\s+$/, ''),
  };
}

/**
 * Surgically updates only the `## 備註` (or `## Notes`) section in a Markdown file,
 * preserving frontmatter and all other body lines byte-for-byte.
 */
export function updateNotesSection(raw: string, newNotesContent: string): string {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const normalizedNotes = newNotesContent.replace(/\r\n/g, '\n').trim();
  const fmEnd = findFrontmatterEndOffset(raw);
  const frontmatterPart = raw.slice(0, fmEnd);
  const bodyPart = raw.slice(fmEnd);

  const headingMatch = bodyPart.match(NOTES_HEADING_RE);

  if (headingMatch && headingMatch.index !== undefined) {
    const headingLine = headingMatch[0];
    const beforeHeading = bodyPart.slice(0, headingMatch.index);
    const afterHeadingIdx = headingMatch.index + headingLine.length;
    const remainder = bodyPart.slice(afterHeadingIdx);

    const nextH2 = remainder.match(/\r?\n##[ \t]+/);
    const afterSection = nextH2 && nextH2.index !== undefined
      ? remainder.slice(nextH2.index)
      : '';

    const formattedNotes = normalizedNotes
      ? `${eol}${eol}${normalizedNotes.split('\n').join(eol)}${afterSection ? eol : eol}`
      : `${eol}`;

    return `${frontmatterPart}${beforeHeading}${headingLine}${formattedNotes}${afterSection}`;
  }

  // No existing notes heading — append `## 備註` cleanly at the end
  if (!normalizedNotes) {
    return raw;
  }

  const trimmedRaw = raw.replace(/\s+$/, '');
  return `${trimmedRaw}${eol}${eol}## 備註${eol}${eol}${normalizedNotes.split('\n').join(eol)}${eol}`;
}

export function extractWikiLinks(markdownBody: string): {
  conceptIds: string[];
  docIds: string[];
} {
  const conceptSet = new Set<string>();
  const docSet = new Set<string>();
  const wikiRe = /\[\[(concept\.[a-z0-9_]+|doc\.[a-z0-9_]+)\]\]/g;

  let m: RegExpExecArray | null;
  while ((m = wikiRe.exec(markdownBody)) !== null) {
    const id = m[1];
    if (id.startsWith('concept.')) {
      conceptSet.add(id);
    } else if (id.startsWith('doc.')) {
      docSet.add(id);
    }
  }

  return {
    conceptIds: Array.from(conceptSet),
    docIds: Array.from(docSet),
  };
}

export function parseDocumentMarkdown(raw: string): ParsedDocument {
  const parsed = matter(raw);
  const fm = (parsed.data ?? {}) as DocumentFrontmatter;
  const notes = extractNotesSection(raw);

  return {
    frontmatter: fm,
    body: parsed.content.trim(),
    notesSection: notes.content,
  };
}
