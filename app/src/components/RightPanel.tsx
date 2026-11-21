import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  CornerUpLeft,
  Download,
  ExternalLink,
  FileText,
  Save,
  Trash2,
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
  ConceptRankedDoc,
  IndexedDocument,
  OntologyConcept,
  ReferenceItem,
  SentenceComment,
} from '../../server/types';

export type RightTab = 'comments' | 'notes' | 'concept';

interface RightPanelProps {
  doc: IndexedDocument;
  lang: UiLang;
  activeTab: RightTab;
  activeCommentId: string | null;
  activeConcept: OntologyConcept | null;
  conceptsMap: Map<string, OntologyConcept>;
  conceptTopDocs: Record<string, ConceptRankedDoc[]>;
  docsMap: Map<string, IndexedDocument>;
  refsMap: Map<string, ReferenceItem>;
  onChangeTab: (tab: RightTab) => void;
  onSelectComment: (commentId: string) => void;
  onToggleResolveComment: (comment: SentenceComment) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onSaveNotes: (notes: string) => Promise<void>;
  onInspectConcept: (conceptId: string | null) => void;
  onSelectDoc: (docId: string) => void;
  onNotify: (message: string) => void;
}

export function RightPanel({
  doc,
  lang,
  activeTab,
  activeCommentId,
  activeConcept,
  conceptsMap,
  conceptTopDocs,
  docsMap,
  refsMap,
  onChangeTab,
  onSelectComment,
  onToggleResolveComment,
  onDeleteComment,
  onSaveNotes,
  onInspectConcept,
  onSelectDoc,
  onNotify,
}: RightPanelProps) {
  const t = UI_COPY[lang];
  const [notesDraft, setNotesDraft] = useState(doc.notesSection);
  const [savingNotes, setSavingNotes] = useState(false);
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  async function handleCopyMarkdown() {
    try {
      await navigator.clipboard.writeText(doc.rawMarkdown);
      setCopied(true);
      onNotify(t.copiedMarkdown);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onNotify('Failed to copy to clipboard');
    }
  }

  function handleDownloadMarkdown() {
    const blob = new Blob([doc.rawMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.slug}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    setNotesDraft(doc.notesSection);
  }, [doc.id, doc.notesSection]);

  useEffect(() => {
    if (activeTab !== 'comments' || !activeCommentId || !bodyRef.current) return;
    const card = bodyRef.current.querySelector<HTMLElement>(
      `[data-comment-card-id="${CSS.escape(activeCommentId)}"]`,
    );
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeCommentId, activeTab]);

  const notesDirty = notesDraft.trim() !== doc.notesSection.trim();
  const openCommentsCount = doc.comments.filter((c) => !c.resolved).length;

  async function handleSaveNotes() {
    if (!notesDirty || savingNotes) return;
    setSavingNotes(true);
    try {
      await onSaveNotes(notesDraft);
    } finally {
      setSavingNotes(false);
    }
  }

  const docTermIds = Array.from(new Set([...doc.concepts, ...doc.mentionedConcepts]));
  const docPrimaryTerms = doc.concepts
    .map((id) => conceptsMap.get(id))
    .filter((c): c is OntologyConcept => !!c);
  const docMentionedTerms = doc.mentionedConcepts
    .map((id) => conceptsMap.get(id))
    .filter((c): c is OntologyConcept => !!c);

  const conceptDocs = activeConcept
    ? (conceptTopDocs[activeConcept.concept_id] ?? [])
        .map((r) => docsMap.get(r.docId))
        .filter((d): d is IndexedDocument => !!d)
    : [];

  const conceptRefs = activeConcept
    ? (activeConcept.references ?? [])
        .map((rid) => refsMap.get(rid))
        .filter((r): r is ReferenceItem => !!r)
    : [];

  return (
    <aside className="right-panel">
      <div className="right-tabs-wrap">
        <div className="right-tabs">
          <button
            className={`right-tab ${activeTab === 'comments' ? 'active' : ''}`}
            onClick={() => onChangeTab('comments')}
          >
            {t.comments}
            {openCommentsCount > 0 && <span className="badge-count">{openCommentsCount}</span>}
          </button>
          <button
            className={`right-tab ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => onChangeTab('notes')}
          >
            {t.notes}
          </button>
          <button
            className={`right-tab ${activeTab === 'concept' ? 'active' : ''}`}
            onClick={() => onChangeTab('concept')}
          >
            {t.termsTab}
            {docTermIds.length > 0 && <span className="badge-count">{docTermIds.length}</span>}
          </button>
        </div>
      </div>

      <div className="right-body" ref={bodyRef}>
        {activeTab === 'comments' && (
          <>
            {doc.comments.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '28px 8px', textAlign: 'center', lineHeight: 1.6 }}>
                {t.noComments}
              </div>
            ) : (
              doc.comments.map((cmt) => (
                <div
                  key={cmt.id}
                  data-comment-card-id={cmt.id}
                  className={`comment-card ${cmt.id === activeCommentId ? 'active' : ''} ${cmt.resolved ? 'resolved' : ''}`}
                  onClick={() => onSelectComment(cmt.id)}
                >
                  <button
                    type="button"
                    className="comment-quote-link"
                    title="Jump to cited sentence"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectComment(cmt.id);
                    }}
                  >
                    <span className="comment-quote-text">“{cmt.quote}”</span>
                    <CornerUpLeft size={12} className="comment-jump-icon" />
                  </button>
                  <div className="comment-text">{cmt.body}</div>
                  <div className="comment-actions">
                    <span>{cmt.created_at.slice(0, 10)}</span>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button
                        className="icon-btn"
                        title={cmt.resolved ? 'Reopen' : 'Resolve'}
                        onClick={(e) => {
                          e.stopPropagation();
                          void onToggleResolveComment(cmt);
                        }}
                      >
                        {cmt.resolved ? <CheckCircle2 size={14} style={{ color: 'var(--doc-color)' }} /> : <Circle size={14} />}
                      </button>
                      <button
                        className="icon-btn"
                        title="Delete comment"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDeleteComment(cmt.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'notes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            <textarea
              className="notes-textarea"
              placeholder={t.notesPlaceholder}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                  e.preventDefault();
                  void handleSaveNotes();
                }
              }}
            />
            {notesDirty && (
              <button
                className="btn btn-primary"
                style={{ justifyContent: 'center' }}
                disabled={savingNotes}
                onClick={() => void handleSaveNotes()}
              >
                <Save size={13} />
                {savingNotes ? t.saving : t.saveNotes}
              </button>
            )}
          </div>
        )}

        {activeTab === 'concept' && (
          <>
            {!activeConcept ? (
              <div className="concept-inspector">
                {docTermIds.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 8px', textAlign: 'center', lineHeight: 1.6 }}>
                    {t.noLinkedTerms}
                  </div>
                ) : (
                  <>
                    {docPrimaryTerms.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--text-muted)', marginBottom: 6 }}>
                          {t.keyConcepts} ({docPrimaryTerms.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {docPrimaryTerms.map((c) => (
                            <button
                              key={c.concept_id}
                              className="tree-row"
                              style={{ padding: '6px 8px', justifyContent: 'space-between' }}
                              onClick={() => onInspectConcept(c.concept_id)}
                            >
                              <span className="tree-row-label" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                {getConceptLabel(c, lang)}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                                {formatConceptKind(c.kind, lang)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {docMentionedTerms.length > 0 && (
                      <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--text-muted)', marginBottom: 6 }}>
                          {t.alsoMentioned} ({docMentionedTerms.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {docMentionedTerms.map((c) => (
                            <button
                              key={c.concept_id}
                              className="tree-row"
                              style={{ padding: '6px 8px', justifyContent: 'space-between' }}
                              onClick={() => onInspectConcept(c.concept_id)}
                            >
                              <span className="tree-row-label" style={{ color: 'var(--text-secondary)' }}>
                                {getConceptLabel(c, lang)}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                                {formatConceptKind(c.kind, lang)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="concept-inspector">
                <button
                  className="tree-row"
                  style={{ padding: '4px 6px', fontSize: 12, color: 'var(--text-muted)', alignSelf: 'flex-start', width: 'auto' }}
                  onClick={() => onInspectConcept(null)}
                >
                  <ArrowLeft size={13} />
                  {t.allDocTerms(docTermIds.length)}
                </button>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 17, fontWeight: 650 }}>
                      {getConceptLabel(activeConcept, lang)}
                    </div>
                    <span className="concept-kind">{formatConceptKind(activeConcept.kind, lang)}</span>
                  </div>
                </div>

                <div className="concept-context">{getConceptContext(activeConcept, lang)}</div>

                {activeConcept.relations && activeConcept.relations.length > 0 && (
                  <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--text-muted)', marginBottom: 6 }}>
                      {t.relations}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {activeConcept.relations.map((rel, i) => {
                        const target = conceptsMap.get(rel.target);
                        return (
                          <button
                            key={`${rel.type}-${rel.target}-${i}`}
                            className="tree-row"
                            style={{ padding: '6px 8px', justifyContent: 'space-between' }}
                            onClick={() => onInspectConcept(rel.target)}
                          >
                            <span className="tree-row-label" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                              {target ? getConceptLabel(target, lang) : rel.target}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: 'var(--text-secondary)',
                                background: 'var(--bg-surface)',
                                padding: '2px 7px',
                                borderRadius: 99,
                                flexShrink: 0,
                              }}
                            >
                              {formatRelationLabel(rel.type, lang)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {conceptDocs.length > 0 && (
                  <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--text-muted)', marginBottom: 6 }}>
                      {t.topRelatedDocuments}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {conceptDocs.map((d) => (
                        <button
                          key={d.id}
                          className="tree-row"
                          style={{ padding: '5px 6px' }}
                          onClick={() => onSelectDoc(d.id)}
                        >
                          <FileText size={13} style={{ color: 'var(--text-muted)' }} />
                          <span className="tree-row-label" style={{ color: 'var(--text-primary)' }}>
                            {d.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {conceptRefs.length > 0 && (
                  <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--text-muted)', marginBottom: 6 }}>
                      {t.references}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {conceptRefs.map((ref) => (
                        <div key={ref.ref_id} style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                          {ref.url ? (
                            <a
                              href={ref.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--text-primary)', textDecoration: 'none', borderBottom: '1px solid var(--border-strong)' }}
                            >
                              {ref.title} <ExternalLink size={10} style={{ verticalAlign: 'middle', opacity: 0.6 }} />
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-primary)' }}>{ref.title}</span>
                          )}
                          {(ref.authors?.length || ref.year) && (
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                              {ref.authors?.join(', ')} {ref.year ? `(${ref.year})` : ''}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="right-actions-footer">
        <button className="right-action-btn" onClick={() => void handleCopyMarkdown()}>
          {copied ? <Check size={13} style={{ color: 'var(--doc-color)' }} /> : <Copy size={13} />}
          <span>{copied ? t.copiedMarkdown : t.copyMarkdown}</span>
        </button>
        <button className="right-action-btn" onClick={handleDownloadMarkdown}>
          <Download size={13} />
          <span>{t.downloadMarkdown}</span>
        </button>
      </div>
    </aside>
  );
}
