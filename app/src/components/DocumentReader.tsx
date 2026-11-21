import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import {
  Check,
  Edit3,
  ExternalLink,
  MessageSquarePlus,
  PanelRight,
  Save,
  X,
} from 'lucide-react';
import { getConceptContext, getConceptLabel, UI_COPY, type UiLang } from '../i18n';
import type {
  IndexedDocument,
  OntologyConcept,
  ReferenceItem,
} from '../../server/types';

interface DocumentReaderProps {
  doc: IndexedDocument;
  lang: UiLang;
  conceptsMap: Map<string, OntologyConcept>;
  docsMap: Map<string, IndexedDocument>;
  refsMap: Map<string, ReferenceItem>;
  activeCommentId: string | null;
  jumpRequest: { commentId: string; seq: number } | null;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  onSelectDoc: (docId: string) => void;
  onInspectConcept: (conceptId: string) => void;
  onOpenTermsPanel: () => void;
  onSelectComment: (commentId: string) => void;
  onSaveMarkdown: (rawMarkdown: string) => Promise<void>;
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
  refsMap,
  activeCommentId,
  jumpRequest,
  rightPanelOpen,
  onToggleRightPanel,
  onSelectDoc,
  onInspectConcept,
  onOpenTermsPanel,
  onSelectComment,
  onSaveMarkdown,
  onAddComment,
}: DocumentReaderProps) {
  const t = UI_COPY[lang];
  const [isEditing, setIsEditing] = useState(false);
  const [draftMd, setDraftMd] = useState(doc.rawMarkdown);
  const [saving, setSaving] = useState(false);
  const proseRef = useRef<HTMLDivElement>(null);

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

  // Render Markdown with [[concept.*]] / [[doc.*]] wiki-links & comment highlights
  const renderedHtml = useMemo(() => {
    // Strip the trailing ## 備註 / ## Notes section from main reader view?
    // Keep it visible in the document so nothing is hidden, while right panel edits it cleanly.
    const preprocessed = doc.body.replace(
      /\[\[(concept\.[a-z0-9_]+|doc\.[a-z0-9_]+)\]\]/g,
      (_full, id: string) => {
        if (id.startsWith('concept.')) {
          const c = conceptsMap.get(id);
          const label = c ? getConceptLabel(c, lang) : id;
          const title = c ? getConceptContext(c, lang) : id;
          return `<a class="wiki-concept" data-concept-id="${escapeHtml(id)}" title="${escapeHtml(title)}">${escapeHtml(label)}</a>`;
        }
        const targetDoc = docsMap.get(id);
        const label = targetDoc ? targetDoc.title : id;
        return `<a class="wiki-doc" data-doc-id="${escapeHtml(id)}">${escapeHtml(label)}</a>`;
      },
    );

    let html = marked.parse(preprocessed, { async: false, gfm: true }) as string;

    // Rewrite relative bundle asset paths (./foo.png -> /api/assets/:docId/foo.png)
    html = html.replace(
      /(src|href)="\.\/([^"]+)"/g,
      `$1="/api/assets/${encodeURIComponent(doc.id)}/$2"`,
    );

    return html;
  }, [doc.body, doc.id, lang, conceptsMap, docsMap]);

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

  function handleProseClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const conceptEl = target.closest('[data-concept-id]') as HTMLElement | null;
    if (conceptEl?.dataset.conceptId) {
      e.preventDefault();
      onInspectConcept(conceptEl.dataset.conceptId);
      return;
    }

    const docEl = target.closest('[data-doc-id]') as HTMLElement | null;
    if (docEl?.dataset.docId) {
      e.preventDefault();
      onSelectDoc(docEl.dataset.docId);
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

  const docRefs = doc.references
    .map((rid) => refsMap.get(rid))
    .filter((r): r is ReferenceItem => !!r);

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
            <span key={`${seg}-${i}`}>
              {seg} /
            </span>
          ))}
          <span className="crumb-current">{doc.title}</span>
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
              <span>knowledge/notes/{doc.bundleRelPath}/index.md</span>
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
              {doc.updated && (
                <>
                  <span className="meta-sep">·</span>
                  <span>{doc.updated}</span>
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
              onMouseUp={handleMouseUp}
            />

            {(docRefs.length > 0 || relatedDocObjs.length > 0 || backlinkDocObjs.length > 0) && (
              <div className="doc-footer-sections">
                {docRefs.length > 0 && (
                  <div className="footer-section">
                    <h4>{t.references}</h4>
                    {docRefs.map((ref) => (
                      <div key={ref.ref_id} className="ref-item">
                        <div className="ref-title">
                          {ref.url ? (
                            <a href={ref.url} target="_blank" rel="noreferrer">
                              {ref.title}{' '}
                              <ExternalLink size={11} style={{ verticalAlign: 'middle', opacity: 0.6 }} />
                            </a>
                          ) : (
                            ref.title
                          )}
                        </div>
                        <div className="ref-meta">
                          {ref.authors?.join(', ')} {ref.year ? `(${ref.year})` : ''}
                          {ref.notes ? ` — ${ref.notes}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(relatedDocObjs.length > 0 || backlinkDocObjs.length > 0) && (
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
                )}
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

    </main>
  );
}
