import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  CornerUpLeft,
  FileText,
  Save,
  Trash2,
} from 'lucide-react';
import { formatRelationLabel } from '../formatters';
import type {
  ConceptRankedDoc,
  IndexedDocument,
  OntologyConcept,
  SentenceComment,
} from '../../server/types';

export type RightTab = 'comments' | 'notes' | 'concept';

interface RightPanelProps {
  doc: IndexedDocument;
  activeTab: RightTab;
  activeCommentId: string | null;
  activeConcept: OntologyConcept | null;
  conceptsMap: Map<string, OntologyConcept>;
  conceptTopDocs: Record<string, ConceptRankedDoc[]>;
  docsMap: Map<string, IndexedDocument>;
  onChangeTab: (tab: RightTab) => void;
  onSelectComment: (commentId: string) => void;
  onToggleResolveComment: (comment: SentenceComment) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onSaveNotes: (notes: string) => Promise<void>;
  onInspectConcept: (conceptId: string | null) => void;
  onSelectDoc: (docId: string) => void;
}

export function RightPanel({
  doc,
  activeTab,
  activeCommentId,
  activeConcept,
  conceptsMap,
  conceptTopDocs,
  docsMap,
  onChangeTab,
  onSelectComment,
  onToggleResolveComment,
  onDeleteComment,
  onSaveNotes,
  onInspectConcept,
  onSelectDoc,
}: RightPanelProps) {
  const [notesDraft, setNotesDraft] = useState(doc.notesSection);
  const [savingNotes, setSavingNotes] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

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

  return (
    <aside className="right-panel">
      <div className="right-tabs-wrap">
        <div className="right-tabs">
          <button
            className={`right-tab ${activeTab === 'comments' ? 'active' : ''}`}
            onClick={() => onChangeTab('comments')}
          >
            Comments
            {openCommentsCount > 0 && <span className="badge-count">{openCommentsCount}</span>}
          </button>
          <button
            className={`right-tab ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => onChangeTab('notes')}
          >
            備註
          </button>
          <button
            className={`right-tab ${activeTab === 'concept' ? 'active' : ''}`}
            onClick={() => onChangeTab('concept')}
          >
            Terminology
            {docTermIds.length > 0 && <span className="badge-count">{docTermIds.length}</span>}
          </button>
        </div>
      </div>

      <div className="right-body" ref={bodyRef}>
        {activeTab === 'comments' && (
          <>
            {doc.comments.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '28px 8px', textAlign: 'center', lineHeight: 1.6 }}>
                Select text in the article to leave a comment.
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
              placeholder="Write notes or marginalia..."
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
                {savingNotes ? 'Saving...' : 'Save Notes'}
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
                    No linked terms in this document yet.
                  </div>
                ) : (
                  <>
                    {docPrimaryTerms.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--text-muted)', marginBottom: 6 }}>
                          Key Concepts ({docPrimaryTerms.length})
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
                                {c.labels['zh-Hant'] || c.labels.en}
                              </span>
                              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0 }}>
                                {c.labels.en}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {docMentionedTerms.length > 0 && (
                      <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--text-muted)', marginBottom: 6 }}>
                          Also Mentioned ({docMentionedTerms.length})
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
                                {c.labels['zh-Hant'] || c.labels.en}
                              </span>
                              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0 }}>
                                {c.labels.en}
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
                  All terms in document ({docTermIds.length})
                </button>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 17, fontWeight: 650 }}>
                      {activeConcept.labels['zh-Hant']}
                    </div>
                    <span className="concept-kind">{activeConcept.kind ?? 'concept'}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    {activeConcept.labels.en}
                  </div>
                </div>

                <div className="concept-context">{activeConcept.contexts['zh-Hant']}</div>
                <div className="concept-context en">{activeConcept.contexts.en}</div>

                {activeConcept.relations && activeConcept.relations.length > 0 && (
                  <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Relations
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
                              {target ? target.labels['zh-Hant'] || target.labels.en : rel.target}
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
                              {formatRelationLabel(rel.type)}
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
                      Top Related Documents
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
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
