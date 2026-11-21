import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  CornerUpLeft,
  FileText,
  MessageSquare,
  Save,
  Sparkles,
  StickyNote,
  Trash2,
} from 'lucide-react';
import type {
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
  allDocs: IndexedDocument[];
  onChangeTab: (tab: RightTab) => void;
  onSelectComment: (commentId: string) => void;
  onToggleResolveComment: (comment: SentenceComment) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onSaveNotes: (notes: string) => Promise<void>;
  onInspectConcept: (conceptId: string) => void;
  onSelectDoc: (docId: string) => void;
}

export function RightPanel({
  doc,
  activeTab,
  activeCommentId,
  activeConcept,
  conceptsMap,
  allDocs,
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

  const conceptDocs = activeConcept
    ? allDocs.filter(
        (d) =>
          d.concepts.includes(activeConcept.concept_id) ||
          d.mentionedConcepts.includes(activeConcept.concept_id),
      )
    : [];

  return (
    <aside className="right-panel">
      <div className="right-tabs">
        <button
          className={`right-tab ${activeTab === 'comments' ? 'active' : ''}`}
          onClick={() => onChangeTab('comments')}
        >
          <MessageSquare size={13} />
          Comments
          <span className="badge-count">{openCommentsCount}</span>
        </button>
        <button
          className={`right-tab ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => onChangeTab('notes')}
        >
          <StickyNote size={13} />
          備註
        </button>
        <button
          className={`right-tab ${activeTab === 'concept' ? 'active' : ''}`}
          onClick={() => onChangeTab('concept')}
        >
          <Sparkles size={13} />
          Terminology
        </button>
      </div>

      <div className="right-body" ref={bodyRef}>
        {activeTab === 'comments' && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Select any sentence in the document to add an anchored comment to <code>comments.json</code>. Click a comment to jump to its cited sentence.
            </div>
            {doc.comments.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
                No sentence comments yet.
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
                    title="Jump to cited sentence in document"
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
                    <div style={{ display: 'flex', gap: 4 }}>
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
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Saves surgically to the <code>## 備註</code> section of <code>index.md</code> without touching frontmatter or main body.
            </div>
            <textarea
              className="notes-textarea"
              placeholder="- 寫下這篇文件的延伸想法、待補連結或問題..."
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                  e.preventDefault();
                  void handleSaveNotes();
                }
              }}
            />
            <button
              className="btn btn-primary"
              style={{ justifyContent: 'center' }}
              disabled={!notesDirty || savingNotes}
              onClick={() => void handleSaveNotes()}
            >
              <Save size={14} />
              {savingNotes ? 'Saving...' : notesDirty ? 'Save ## 備註' : 'Saved'}
            </button>
          </>
        )}

        {activeTab === 'concept' && (
          <>
            {!activeConcept ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center', lineHeight: 1.6 }}>
                Click any terminology tag or linked term in the article to inspect its definition and relations.
              </div>
            ) : (
              <div className="concept-card-box">
                <span className="concept-kind">{activeConcept.kind ?? 'concept'}</span>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>
                    {activeConcept.labels['zh-Hant']}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {activeConcept.labels.en} · <code>{activeConcept.concept_id}</code>
                  </div>
                </div>

                <div className="concept-context">{activeConcept.contexts['zh-Hant']}</div>
                <div className="concept-context en">{activeConcept.contexts.en}</div>

                {activeConcept.aliases && activeConcept.aliases.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>ALIASES</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {activeConcept.aliases.map((a) => (
                        <span key={a} className="kbd">{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {activeConcept.relations && activeConcept.relations.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>RELATIONS</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {activeConcept.relations.map((rel, i) => {
                        const target = conceptsMap.get(rel.target);
                        return (
                          <button
                            key={`${rel.type}-${rel.target}-${i}`}
                            className="tree-row"
                            style={{ background: 'var(--bg-elevated)', padding: '6px 8px' }}
                            onClick={() => onInspectConcept(rel.target)}
                          >
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                              {rel.type}
                            </span>
                            <span className="tree-row-label" style={{ color: 'var(--text-primary)' }}>
                              {target ? target.labels['zh-Hant'] || target.labels.en : rel.target}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {conceptDocs.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>APPEARS IN DOCUMENTS</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {conceptDocs.map((d) => (
                        <button
                          key={d.id}
                          className="tree-row"
                          style={{ background: 'var(--bg-elevated)', padding: '6px 8px' }}
                          onClick={() => onSelectDoc(d.id)}
                        >
                          <FileText size={13} style={{ color: 'var(--doc-color)' }} />
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
