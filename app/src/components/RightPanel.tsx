import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  CornerUpLeft,
  Download,
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
              <div className="panel-empty">{t.noComments}</div>
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
                    <span className="comment-quote-text">{cmt.quote}</span>
                    <CornerUpLeft size={13} className="comment-jump-icon" />
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
                        {cmt.resolved ? <CheckCircle2 size={16} style={{ color: 'var(--doc-color)' }} /> : <Circle size={16} />}
                      </button>
                      <button
                        className="icon-btn"
                        title="Delete comment"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDeleteComment(cmt.id);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'notes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
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
                {savingNotes ? t.saving : t.saveNotes}
              </button>
            )}
          </div>
        )}

        {activeTab === 'concept' && (
          <>
            {!activeConcept ? (
              docTermIds.length === 0 ? (
                <div className="panel-empty">{t.noLinkedTerms}</div>
              ) : (
                <>
                  {docPrimaryTerms.length > 0 && (
                    <div className="panel-section">
                      <div className="panel-heading">{t.keyConcepts}</div>
                      {docPrimaryTerms.map((c) => (
                        <button
                          key={c.concept_id}
                          className="list-row"
                          onClick={() => onInspectConcept(c.concept_id)}
                        >
                          <span className="list-row-label">{getConceptLabel(c, lang)}</span>
                          <span className="list-row-meta">{formatConceptKind(c.kind, lang)}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {docMentionedTerms.length > 0 && (
                    <div className="panel-section">
                      <div className="panel-heading">{t.alsoMentioned}</div>
                      {docMentionedTerms.map((c) => (
                        <button
                          key={c.concept_id}
                          className="list-row secondary"
                          onClick={() => onInspectConcept(c.concept_id)}
                        >
                          <span className="list-row-label">{getConceptLabel(c, lang)}</span>
                          <span className="list-row-meta">{formatConceptKind(c.kind, lang)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )
            ) : (
              <div className="concept-inspector">
                <button className="back-link" onClick={() => onInspectConcept(null)}>
                  <ArrowLeft size={14} />
                  {t.allDocTerms(docTermIds.length)}
                </button>

                <h2 className="concept-title">{getConceptLabel(activeConcept, lang)}</h2>
                <span className="concept-kind">{formatConceptKind(activeConcept.kind, lang)}</span>
                <p className="concept-context">{getConceptContext(activeConcept, lang)}</p>

                {activeConcept.relations && activeConcept.relations.length > 0 && (
                  <div className="panel-section" style={{ marginTop: 18 }}>
                    <div className="panel-heading">{t.relations}</div>
                    {activeConcept.relations.map((rel, i) => {
                      const target = conceptsMap.get(rel.target);
                      return (
                        <button
                          key={`${rel.type}-${rel.target}-${i}`}
                          className="list-row"
                          onClick={() => onInspectConcept(rel.target)}
                        >
                          <span className="list-row-label">
                            {target ? getConceptLabel(target, lang) : rel.target}
                          </span>
                          <span className="relation-label">{formatRelationLabel(rel.type, lang)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {conceptDocs.length > 0 && (
                  <div className="panel-section">
                    <div className="panel-heading">{t.topRelatedDocuments}</div>
                    {conceptDocs.map((d) => (
                      <button key={d.id} className="list-row" onClick={() => onSelectDoc(d.id)}>
                        <span className="list-row-label">{d.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="right-actions-footer">
        <button className="right-action-btn" onClick={() => void handleCopyMarkdown()}>
          {copied ? <Check size={17} style={{ color: 'var(--doc-color)' }} /> : <Copy size={17} />}
          <span>{copied ? t.copiedMarkdown : t.copyMarkdown}</span>
        </button>
        <button className="right-action-btn" onClick={handleDownloadMarkdown}>
          <Download size={17} />
          <span>{t.downloadMarkdown}</span>
        </button>
      </div>
    </aside>
  );
}
