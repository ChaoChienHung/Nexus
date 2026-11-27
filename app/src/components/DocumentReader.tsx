import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import {
  Check,
  Edit3,
  MessageSquarePlus,
  PanelRight,
  Save,
  X,
} from 'lucide-react';
import {
  formatConceptKind,
  formatRelationLabel,
  getConceptContext,
  getConceptLabel,
  UI_COPY,
  type UiLang,
} from '../i18n';
import type {
  DocReviewStatus,
  IndexedDocument,
  OntologyConcept,
} from '../../server/types';

function slugifyHeadingClient(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

interface DocumentReaderProps {
  doc: IndexedDocument;
  lang: UiLang;
  conceptsMap: Map<string, OntologyConcept>;
  docsMap: Map<string, IndexedDocument>;
  activeCommentId: string | null;
  jumpRequest: { commentId: string; seq: number } | null;
  sectionJumpRequest: { section: string; seq: number } | null;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  onSelectDoc: (docId: string, section?: string) => void;
  onInspectConcept: (conceptId: string) => void;
  onOpenTermsPanel: () => void;
  onSelectComment: (commentId: string) => void;
  onSaveMarkdown: (rawMarkdown: string) => Promise<void>;
  onToggleReview: (nextReview: DocReviewStatus) => Promise<void>;
  onAddComment: (payload: {
    quote: string;
    prefix: string;
    suffix: string;
    body: string;
  }) => Promise<void>;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function findQuoteRange(
  fullText: string,
  quote: string,
  prefix: string,
  suffix: string,
): { start: number; end: number } | null {
  if (!quote) return null;

  // Collect all exact occurrences of quote in fullText
  const matches: number[] = [];
  let pos = 0;
  while (pos <= fullText.length) {
    const idx = fullText.indexOf(quote, pos);
    if (idx === -1) break;
    matches.push(idx);
    pos = idx + 1;
  }

  if (matches.length === 1) {
    return { start: matches[0], end: matches[0] + quote.length };
  }

  if (matches.length > 1) {
    // Score candidates using prefix/suffix overlap
    let bestIdx = matches[0];
    let bestScore = -1;
    for (const idx of matches) {
      let score = 0;
      if (prefix) {
        const before = fullText.slice(Math.max(0, idx - prefix.length - 12), idx);
        if (before.includes(prefix.slice(-16))) score += 2;
      }
      if (suffix) {
        const after = fullText.slice(idx + quote.length, idx + quote.length + suffix.length + 12);
        if (after.includes(suffix.slice(0, 16))) score += 2;
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    }
    return { start: bestIdx, end: bestIdx + quote.length };
  }

  return null;
}

function applyCommentHighlights(
  container: HTMLElement,
  comments: IndexedDocument['comments'],
  activeCommentId: string | null,
) {
  // Build flat text map across all text nodes (works seamlessly across <strong>, <a>, <code>, etc.)
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const segments: { node: Text; start: number; end: number }[] = [];
  let fullText = '';
  let current = walker.nextNode() as Text | null;
  while (current) {
    const len = current.nodeValue?.length ?? 0;
    if (len > 0) {
      segments.push({ node: current, start: fullText.length, end: fullText.length + len });
      fullText += current.nodeValue ?? '';
    }
    current = walker.nextNode() as Text | null;
  }

  // Locate ranges for all comments (highlight unresolved + active resolved comment)
  const ranges: { start: number; end: number; commentId: string; resolved: boolean }[] = [];
  for (const cmt of comments) {
    if (!cmt.quote || cmt.quote.length < 2) continue;
    const found = findQuoteRange(fullText, cmt.quote, cmt.prefix, cmt.suffix);
    if (found) {
      ranges.push({
        start: found.start,
        end: found.end,
        commentId: cmt.id,
        resolved: cmt.resolved,
      });
    }
  }

  // Wrap text node slices in reverse order so earlier DOM offsets stay valid
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    const overlapping = ranges
      .filter((r) => r.start < seg.end && r.end > seg.start)
      .sort((a, b) => b.start - a.start);

    if (overlapping.length === 0) continue;

    let textNode = seg.node;
    for (const r of overlapping) {
      const localStart = Math.max(0, r.start - seg.start);
      const localEnd = Math.min(textNode.length, r.end - seg.start);
      if (localStart >= localEnd) continue;

      if (localEnd < textNode.length) {
        textNode.splitText(localEnd);
      }
      const targetNode = localStart > 0 ? textNode.splitText(localStart) : textNode;
      const mark = document.createElement('mark');
      const isActive = r.commentId === activeCommentId;
      mark.className = `comment-highlight${isActive ? ' active' : ''}${r.resolved ? ' resolved' : ''}`;
      mark.dataset.commentId = r.commentId;
      targetNode.parentNode?.insertBefore(mark, targetNode);
      mark.appendChild(targetNode);
    }
  }
}

export function DocumentReader({
  doc,
  lang,
  conceptsMap,
  docsMap,
  activeCommentId,
  jumpRequest,
  sectionJumpRequest,
  rightPanelOpen,
  onToggleRightPanel,
  onSelectDoc,
  onInspectConcept,
  onOpenTermsPanel,
  onSelectComment,
  onSaveMarkdown,
  onToggleReview,
  onAddComment,
}: DocumentReaderProps) {
  const t = UI_COPY[lang];
  const [isEditing, setIsEditing] = useState(false);
  const [draftMd, setDraftMd] = useState(doc.rawMarkdown);
  const [saving, setSaving] = useState(false);
  const [togglingReview, setTogglingReview] = useState(false);
  const proseRef = useRef<HTMLDivElement>(null);

  // Concept inline hover-card state
  const [hoverCard, setHoverCard] = useState<{
    conceptId: string;
    x: number;
    y: number;
  } | null>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);

  function cancelHoverClose() {
    if (hoverCloseTimerRef.current !== null) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }

  function scheduleHoverClose() {
    cancelHoverClose();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      setHoverCard(null);
    }, 150);
  }

  useEffect(() => () => cancelHoverClose(), []);

  // Text-selection comment popover state
  const [selectionAnchor, setSelectionAnchor] = useState<{
    quote: string;
    prefix: string;
    suffix: string;
    x: number;
    y: number;
    composing: boolean;
  } | null>(null);
  const [commentBody, setCommentBody] = useState('');

  useEffect(() => {
    setDraftMd(doc.rawMarkdown);
    setIsEditing(false);
    setSelectionAnchor(null);
    setCommentBody('');
  }, [doc.id, doc.rawMarkdown]);

  const isDirty = draftMd !== doc.rawMarkdown;

  async function handleSave() {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await onSaveMarkdown(draftMd);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleReviewClick() {
    if (togglingReview) return;
    setTogglingReview(true);
    try {
      await onToggleReview(doc.review === 'reviewed' ? 'fresh' : 'reviewed');
    } finally {
      setTogglingReview(false);
    }
  }

  // Cmd+S shortcut while editing
  useEffect(() => {
    if (!isEditing) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Render Markdown with [[concept.*]], [[doc.*#heading]], ![[doc.*#heading]] transclusions, math & raw provenance links
  const renderedHtml = useMemo(() => {
    const renderMarkdownBody = (rawBody: string, currentDocId: string, depth: number): string => {
      const transclusionPlaceholders: string[] = [];

      // 1. Read-only transclusions: ![[doc.id#heading]] or ![[doc.id]]
      let preprocessed = rawBody.replace(
        /!\[\[(doc\.[a-z0-9_]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g,
        (_full, targetId: string, sectionRaw?: string, alias?: string) => {
          const sectionQuery = sectionRaw?.trim();
          const targetDoc = docsMap.get(targetId);
          if (!targetDoc) {
            const idx = transclusionPlaceholders.push(
              `<div class="transclusion-card missing">${escapeHtml(t.transclusionMissing)}: ${escapeHtml(targetId)}${sectionQuery ? ` § ${escapeHtml(sectionQuery)}` : ''}</div>`,
            ) - 1;
            return `\n\n@@TRANSCLUSION_${idx}@@\n\n`;
          }

          let embedContent = targetDoc.summary || targetDoc.body;
          let matchedHeading = sectionQuery;
          if (sectionQuery) {
            const targetSlug = slugifyHeadingClient(sectionQuery);
            const matched = targetDoc.sections.find(
              (s) =>
                s.heading.toLowerCase() === sectionQuery.toLowerCase() ||
                s.slug === targetSlug,
            );
            if (matched) {
              embedContent = matched.content;
              matchedHeading = matched.heading;
            } else {
              const idx = transclusionPlaceholders.push(
                `<div class="transclusion-card missing">${escapeHtml(t.transclusionMissing)}: ${escapeHtml(targetDoc.title)} § ${escapeHtml(sectionQuery)}</div>`,
              ) - 1;
              return `\n\n@@TRANSCLUSION_${idx}@@\n\n`;
            }
          }

          const innerHtml =
            depth < 1
              ? renderMarkdownBody(embedContent, targetDoc.id, depth + 1)
              : `<p>${escapeHtml(embedContent.slice(0, 240))}</p>`;
          const displayLabel = alias?.trim()
            ? alias.trim()
            : matchedHeading
              ? `${targetDoc.title} § ${matchedHeading}`
              : targetDoc.title;
          const cardHtml = `<div class="transclusion-card">
            <div class="transclusion-header">
              <span class="transclusion-badge">${escapeHtml(t.transclusionSource)}</span>
              <a class="transclusion-link" data-doc-id="${escapeHtml(targetDoc.id)}"${matchedHeading ? ` data-section="${escapeHtml(matchedHeading)}"` : ''}>${escapeHtml(displayLabel)}</a>
            </div>
            <div class="transclusion-body">${innerHtml}</div>
          </div>`;
          const idx = transclusionPlaceholders.push(cardHtml) - 1;
          return `\n\n@@TRANSCLUSION_${idx}@@\n\n`;
        },
      );

      // 2. Wiki-links: [[concept.*]] and [[doc.*]] / [[doc.*#heading]]
      preprocessed = preprocessed.replace(
        /\[\[(concept\.[a-z0-9_]+|doc\.[a-z0-9_]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g,
        (_full, id: string, sectionRaw?: string, alias?: string) => {
          const section = sectionRaw?.trim();
          if (id.startsWith('concept.')) {
            const c = conceptsMap.get(id);
            const label = alias?.trim() || (c ? getConceptLabel(c, lang) : id);
            return `<a class="wiki-concept" data-concept-id="${escapeHtml(id)}">${escapeHtml(label)}</a>`;
          }
          const targetDoc = docsMap.get(id);
          const baseLabel = targetDoc ? targetDoc.title : id;
          const label = alias?.trim() || (section ? `${baseLabel} § ${section}` : baseLabel);
          return `<a class="wiki-doc" data-doc-id="${escapeHtml(id)}"${section ? ` data-section="${escapeHtml(section)}"` : ''}>${escapeHtml(label)}</a>`;
        },
      );

      // Protect code blocks and inline code before rendering LaTeX math
      const codePlaceholders: string[] = [];
      const mathPlaceholders: string[] = [];

      let working = preprocessed
        .replace(/```[\s\S]*?```/g, (m) => {
          const idx = codePlaceholders.push(m) - 1;
          return `@@CODE_BLOCK_${idx}@@`;
        })
        .replace(/`[^`\n]+`/g, (m) => {
          const idx = codePlaceholders.push(m) - 1;
          return `@@CODE_BLOCK_${idx}@@`;
        });

      // Display math $$...$$
      working = working.replace(/\$\$([\s\S]+?)\$\$/g, (_full, expr: string) => {
        const rendered = katex.renderToString(expr.trim(), {
          displayMode: true,
          throwOnError: false,
        });
        const idx = mathPlaceholders.push(`<div class="math-block">${rendered}</div>`) - 1;
        return `@@MATH_BLOCK_${idx}@@`;
      });

      // Inline math $...$
      working = working.replace(/(?<!\\)\$([^\n$]+?)(?<!\\)\$/g, (_full, expr: string) => {
        if (!expr.trim() || (/^\d/.test(expr.trim()) && expr.trim().length <= 4)) return _full;
        const rendered = katex.renderToString(expr.trim(), {
          displayMode: false,
          throwOnError: false,
        });
        const idx = mathPlaceholders.push(rendered) - 1;
        return `@@MATH_BLOCK_${idx}@@`;
      });

      // Restore code before marked.parse so Markdown code rendering works normally
      working = working.replace(/@@CODE_BLOCK_(\d+)@@/g, (_m, i) => codePlaceholders[Number(i)] ?? '');

      let html = marked.parse(working, { async: false, gfm: true }) as string;

      // Restore KaTeX HTML and transclusion cards after marked.parse
      html = html.replace(/@@MATH_BLOCK_(\d+)@@/g, (_m, i) => mathPlaceholders[Number(i)] ?? '');
      html = html.replace(
        /(?:<p>)?@@TRANSCLUSION_(\d+)@@(?:<\/p>)?/g,
        (_m, i) => transclusionPlaceholders[Number(i)] ?? '',
      );

      // Annotate headings (h2-h4) with deterministic section slugs for deep-linking
      html = html.replace(/<(h[2-4])>([\s\S]*?)<\/\1>/g, (_m, tag: string, inner: string) => {
        const plainText = inner.replace(/<[^>]+>/g, '').trim();
        const slug = slugifyHeadingClient(plainText);
        return `<${tag} data-section-slug="${escapeHtml(slug)}" data-section-title="${escapeHtml(plainText)}">${inner}</${tag}>`;
      });

      // Wrap GFM tables in a horizontally scrollable container
      html = html.replace(
        /<table(\s[^>]*)?>([\s\S]*?)<\/table>/g,
        '<div class="md-table-wrap"><table$1>$2</table></div>',
      );

      // Rewrite relative bundle asset paths (./foo.png -> /api/assets/:docId/foo.png)
      html = html.replace(
        /(src|href)="\.\/([^"]+)"/g,
        `$1="/api/assets/${encodeURIComponent(currentDocId)}/$2"`,
      );

      // Rewrite raw/ provenance links (raw/paper.pdf#page=12 -> /api/raw/paper.pdf#page=12)
      html = html.replace(
        /<a href="raw\/([^"]+)"/g,
        (_m, relWithHash: string) => {
          const [relPath, hash] = relWithHash.split('#');
          const encodedPath = relPath
            .split('/')
            .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
            .join('/');
          const href = `/api/raw/${encodedPath}${hash ? `#${hash}` : ''}`;
          return `<a class="raw-provenance-link" href="${href}" target="_blank" rel="noopener noreferrer"`;
        },
      );

      // Open external http(s) links in a new tab
      html = html.replace(
        /<a href="(https?:\/\/[^"]+)"/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer"',
      );

      return html;
    };

    return renderMarkdownBody(doc.body, doc.id, 0);
  }, [doc.body, doc.id, lang, conceptsMap, docsMap, t.transclusionMissing, t.transclusionSource]);

  // Render HTML and apply cross-node DOM highlights for sentence comments
  useEffect(() => {
    const el = proseRef.current;
    if (!el || isEditing) return;
    el.innerHTML = renderedHtml;
    applyCommentHighlights(el, doc.comments, activeCommentId);
  }, [renderedHtml, doc.comments, activeCommentId, isEditing]);

  // Scroll smoothly to the cited sentence when a comment is clicked in the right panel
  useEffect(() => {
    if (!jumpRequest || isEditing || !proseRef.current) return;
    const marks = proseRef.current.querySelectorAll<HTMLElement>(
      `mark[data-comment-id="${CSS.escape(jumpRequest.commentId)}"]`,
    );
    if (marks.length === 0) return;

    marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    marks.forEach((m) => {
      m.classList.remove('pulse');
      // Force reflow to restart animation on repeated clicks
      void m.offsetWidth;
      m.classList.add('pulse');
    });
  }, [jumpRequest, isEditing, renderedHtml]);

  // Scroll smoothly to target heading when a section deep-link is triggered
  useEffect(() => {
    if (!sectionJumpRequest || isEditing || !proseRef.current) return;
    const query = sectionJumpRequest.section.trim();
    if (!query) return;
    const targetSlug = slugifyHeadingClient(query);
    const headings = Array.from(
      proseRef.current.querySelectorAll<HTMLElement>('[data-section-slug]'),
    );
    const match = headings.find(
      (el) =>
        el.dataset.sectionSlug === targetSlug ||
        (el.dataset.sectionTitle ?? '').toLowerCase() === query.toLowerCase(),
    );
    if (!match) return;

    match.scrollIntoView({ behavior: 'smooth', block: 'center' });
    match.classList.remove('section-highlight-pulse');
    void match.offsetWidth;
    match.classList.add('section-highlight-pulse');
  }, [sectionJumpRequest, isEditing, renderedHtml]);

  function handleProseMouseOver(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const conceptEl = target.closest('[data-concept-id]') as HTMLElement | null;
    if (!conceptEl?.dataset.conceptId) return;
    if (!conceptsMap.has(conceptEl.dataset.conceptId)) return;

    cancelHoverClose();
    const rect = conceptEl.getBoundingClientRect();
    const cardWidth = 340;
    const x = Math.min(window.innerWidth - cardWidth - 16, Math.max(16, rect.left));
    const preferBelow = rect.top < 200;
    const y = preferBelow ? rect.bottom + 8 : Math.max(16, rect.top - 10);
    setHoverCard({
      conceptId: conceptEl.dataset.conceptId,
      x,
      y: preferBelow ? y : -y, // negative signals anchor-above via CSS transform
    });
  }

  function handleProseMouseOut(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest('[data-concept-id]')) {
      scheduleHoverClose();
    }
  }

  function handleProseClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const conceptEl = target.closest('[data-concept-id]') as HTMLElement | null;
    if (conceptEl?.dataset.conceptId) {
      e.preventDefault();
      setHoverCard(null);
      onInspectConcept(conceptEl.dataset.conceptId);
      return;
    }

    const docEl = target.closest('[data-doc-id]') as HTMLElement | null;
    if (docEl?.dataset.docId) {
      e.preventDefault();
      onSelectDoc(docEl.dataset.docId, docEl.dataset.section);
      return;
    }

    const markEl = target.closest('[data-comment-id]') as HTMLElement | null;
    if (markEl?.dataset.commentId) {
      e.preventDefault();
      onSelectComment(markEl.dataset.commentId);
    }
  }

  function handleMouseUp() {
    if (isEditing) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setSelectionAnchor((prev) => (prev?.composing ? prev : null));
      return;
    }

    const quote = sel.toString().trim();
    if (quote.length < 3 || !proseRef.current?.contains(sel.anchorNode)) {
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const fullText = proseRef.current.innerText ?? '';
    const idx = fullText.indexOf(quote);
    const prefix = idx > 0 ? fullText.slice(Math.max(0, idx - 36), idx) : '';
    const suffix = idx >= 0 ? fullText.slice(idx + quote.length, idx + quote.length + 36) : '';

    setSelectionAnchor({
      quote,
      prefix,
      suffix,
      x: Math.min(window.innerWidth - 330, Math.max(20, rect.left)),
      y: Math.max(64, rect.top - 48),
      composing: false,
    });
  }

  async function submitSelectionComment() {
    if (!selectionAnchor || !commentBody.trim()) return;
    setSaving(true);
    try {
      await onAddComment({
        quote: selectionAnchor.quote,
        prefix: selectionAnchor.prefix,
        suffix: selectionAnchor.suffix,
        body: commentBody.trim(),
      });
      setSelectionAnchor(null);
      setCommentBody('');
      window.getSelection()?.removeAllRanges();
    } finally {
      setSaving(false);
    }
  }

  const relatedDocObjs = doc.relatedDocs
    .map((id) => docsMap.get(id))
    .filter((d): d is IndexedDocument => !!d);

  const backlinkDocObjs = doc.backlinks
    .map((id) => docsMap.get(id))
    .filter((d): d is IndexedDocument => !!d);

  return (
    <main className="main-pane">
      <div className="doc-topbar">
        <div className="breadcrumbs">
          {doc.categoryPath.map((seg, i) => (
            <Fragment key={`${seg}-${i}`}>
              <span className="crumb-segment" title={seg}>
                {seg}
              </span>
              <span className="crumb-sep" aria-hidden="true">/</span>
            </Fragment>
          ))}
          <span className="crumb-current" title={doc.title}>
            {doc.title}
          </span>
        </div>

        <div className="topbar-actions">
          {isEditing ? (
            <>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setDraftMd(doc.rawMarkdown);
                  setIsEditing(false);
                }}
              >
                <X size={14} />
                {t.cancel}
              </button>
              <button
                className="btn btn-primary"
                disabled={!isDirty || saving}
                onClick={() => void handleSave()}
              >
                <Save size={14} />
                {saving ? t.saving : t.save}
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => setIsEditing(true)}>
              <Edit3 size={15} />
              {t.edit}
            </button>
          )}
          <button
            className="icon-btn"
            onClick={onToggleRightPanel}
            title={rightPanelOpen ? 'Hide annotations panel' : 'Show annotations panel'}
          >
            <PanelRight size={18} />
          </button>
        </div>
      </div>

      <div className="doc-container">
        {isEditing ? (
          <div className="md-editor-wrap">
            <div className="md-editor-hint">
              <span>wiki/{doc.bundleRelPath}/index.md</span>
              <span>⌘S</span>
            </div>
            <textarea
              className="md-editor-textarea"
              value={draftMd}
              onChange={(e) => setDraftMd(e.target.value)}
              spellCheck={false}
            />
          </div>
        ) : (
          <>
            <div className="doc-header-meta">
              <span className="status-label">
                <span className={`status-dot ${doc.status}`} />
                {doc.status}
              </span>
              <span className="meta-sep">·</span>
              <button
                className={`review-pill ${doc.review}`}
                disabled={togglingReview}
                title={doc.review === 'reviewed' ? t.markAsFresh : t.markAsReviewed}
                onClick={() => void handleToggleReviewClick()}
              >
                {doc.review === 'reviewed' ? (
                  <>
                    <Check size={12} />
                    <span>{t.reviewReviewed}</span>
                  </>
                ) : (
                  <>
                    <span className="review-dot" />
                    <span>{t.reviewFresh}</span>
                  </>
                )}
              </button>
              {doc.created && (
                <>
                  <span className="meta-sep">·</span>
                  <span title={`${t.createdLabel}: ${doc.created}`}>
                    {t.createdLabel} {doc.created}
                  </span>
                </>
              )}
              {doc.updated && (
                <>
                  <span className="meta-sep">·</span>
                  <span title={`${t.updatedLabel}: ${doc.updated}`}>
                    {t.updatedLabel} {doc.updated}
                  </span>
                </>
              )}
              {(doc.concepts.length + doc.mentionedConcepts.length) > 0 && (
                <>
                  <span className="meta-sep">·</span>
                  <button className="concept-tag" onClick={onOpenTermsPanel}>
                    {t.relatedTermsCount(doc.concepts.length + doc.mentionedConcepts.length)}
                  </button>
                </>
              )}
            </div>

            {doc.summary && <p className="doc-lead">{doc.summary}</p>}

            <div
              ref={proseRef}
              className="prose"
              onClick={handleProseClick}
              onMouseOver={handleProseMouseOver}
              onMouseOut={handleProseMouseOut}
              onMouseUp={handleMouseUp}
            />

            {(relatedDocObjs.length > 0 || backlinkDocObjs.length > 0) && (
              <div className="doc-footer-sections">
                <div className="footer-section">
                  <h4>{t.relatedDocuments}</h4>
                  <div className="link-list">
                    {Array.from(
                      new Map([...relatedDocObjs, ...backlinkDocObjs].map((d) => [d.id, d])).values(),
                    ).map((linked) => (
                      <button
                        key={linked.id}
                        className="doc-link-pill"
                        onClick={() => onSelectDoc(linked.id)}
                      >
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                        {linked.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectionAnchor && (
        <div
          className={`selection-popover ${selectionAnchor.composing ? 'composing' : ''}`}
          style={{ left: selectionAnchor.x, top: selectionAnchor.y }}
        >
          {!selectionAnchor.composing ? (
            <button
              type="button"
              className="selection-trigger-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                setSelectionAnchor((prev) => (prev ? { ...prev, composing: true } : null))
              }
            >
              <MessageSquarePlus size={15} style={{ color: 'var(--accent)' }} />
              <span>{t.addComment}</span>
            </button>
          ) : (
            <div className="comment-composer">
              <div className="comment-composer-quote">“{selectionAnchor.quote}”</div>
              <textarea
                autoFocus
                placeholder={t.commentPlaceholder}
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setSelectionAnchor(null);
                    setCommentBody('');
                  }}
                >
                  {t.cancel}
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!commentBody.trim() || saving}
                  onClick={() => void submitSelectionComment()}
                >
                  <Check size={14} />
                  {t.save}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {hoverCard && (() => {
        const concept = conceptsMap.get(hoverCard.conceptId);
        if (!concept) return null;
        const anchorAbove = hoverCard.y < 0;
        const topVal = Math.abs(hoverCard.y);
        return (
          <div
            className="concept-hover-card"
            style={{
              left: hoverCard.x,
              top: topVal,
              transform: anchorAbove ? 'translateY(-100%)' : undefined,
            }}
            onMouseEnter={cancelHoverClose}
            onMouseLeave={scheduleHoverClose}
            onClick={() => {
              setHoverCard(null);
              onInspectConcept(concept.concept_id);
            }}
          >
            <div className="hover-card-header">
              <span className="hover-card-title">{getConceptLabel(concept, lang)}</span>
              <span className="hover-card-kind">{formatConceptKind(concept.kind, lang)}</span>
            </div>
            <p className="hover-card-context">{getConceptContext(concept, lang)}</p>
            {concept.relations && concept.relations.length > 0 && (
              <div className="hover-card-relations">
                {concept.relations.slice(0, 2).map((rel, i) => {
                  const targetConcept = conceptsMap.get(rel.target);
                  return (
                    <span key={`${rel.type}-${rel.target}-${i}`} className="hover-card-rel-chip">
                      <em>{formatRelationLabel(rel.type, lang)}</em>{' '}
                      {targetConcept ? getConceptLabel(targetConcept, lang) : rel.target}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="hover-card-hint">{t.hoverClickInspect}</div>
          </div>
        );
      })()}

    </main>
  );
}
