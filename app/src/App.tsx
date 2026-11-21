import { useEffect, useMemo, useState } from 'react';
import type { NexusIndex, SentenceComment } from '../server/types';
import {
  addSentenceComment,
  deleteSentenceComment,
  fetchIndex,
  saveDocumentMarkdown,
  saveDocumentNotes,
  updateSentenceComment,
} from './api';
import { Sidebar, type MainView } from './components/Sidebar';
import { DocumentReader } from './components/DocumentReader';
import { RightPanel, type RightTab } from './components/RightPanel';
import { KnowledgeGraph } from './components/KnowledgeGraph';
import { OntologyBrowser } from './components/OntologyBrowser';
import { CommandPalette } from './components/CommandPalette';

export function App() {
  const [index, setIndex] = useState<NexusIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<MainView>('reader');
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [jumpRequest, setJumpRequest] = useState<{ commentId: string; seq: number } | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('comments');
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = window.localStorage.getItem('nexus-theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('nexus-theme', theme);
  }, [theme]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast((curr) => (curr === msg ? null : curr)), 2600);
  }

  useEffect(() => {
    fetchIndex()
      .then((data) => {
        setIndex(data);
        if (data.documents.length > 0) {
          setActiveDocId(data.documents[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const conceptsMap = useMemo(
    () => new Map((index?.concepts ?? []).map((c) => [c.concept_id, c])),
    [index],
  );
  const docsMap = useMemo(
    () => new Map((index?.documents ?? []).map((d) => [d.id, d])),
    [index],
  );
  const refsMap = useMemo(
    () => new Map((index?.references ?? []).map((r) => [r.ref_id, r])),
    [index],
  );

  if (error) {
    return (
      <div style={{ padding: 40, color: 'var(--accent)' }}>
        <h2>Failed to load Nexus index</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!index) {
    return (
      <div style={{ padding: 40, color: 'var(--text-secondary)' }}>
        Loading Nexus Knowledge Base...
      </div>
    );
  }

  const activeDoc = activeDocId ? docsMap.get(activeDocId) ?? index.documents[0] ?? null : null;
  const activeConcept = activeConceptId ? conceptsMap.get(activeConceptId) ?? null : null;

  function handleInspectConcept(conceptId: string | null) {
    setActiveConceptId(conceptId);
    setRightTab('concept');
    setRightPanelOpen(true);
    if (conceptId && activeView !== 'reader') {
      setActiveView('reader');
    }
  }

  function handleJumpToComment(commentId: string) {
    setActiveCommentId(commentId);
    setJumpRequest((prev) => ({ commentId, seq: (prev?.seq ?? 0) + 1 }));
  }

  function handleSelectDoc(docId: string) {
    setActiveDocId(docId);
    setActiveCommentId(null);
    setJumpRequest(null);
    setActiveView('reader');
  }

  async function handleSaveMarkdown(rawMarkdown: string) {
    if (!activeDoc) return;
    const updated = await saveDocumentMarkdown(activeDoc.id, rawMarkdown);
    setIndex(updated);
    showToast('Saved index.md to disk');
  }

  async function handleSaveNotes(notes: string) {
    if (!activeDoc) return;
    const updated = await saveDocumentNotes(activeDoc.id, notes);
    setIndex(updated);
    showToast('Updated ## 備註 in index.md');
  }

  async function handleAddComment(payload: {
    quote: string;
    prefix: string;
    suffix: string;
    body: string;
  }) {
    if (!activeDoc) return;
    const res = await addSentenceComment(activeDoc.id, payload);
    setIndex(res.index);
    setActiveCommentId(res.comment.id);
    setRightTab('comments');
    showToast('Saved sentence comment to comments.json');
  }

  async function handleToggleResolveComment(comment: SentenceComment) {
    if (!activeDoc) return;
    const updated = await updateSentenceComment(activeDoc.id, comment.id, {
      resolved: !comment.resolved,
    });
    setIndex(updated);
  }

  async function handleDeleteComment(commentId: string) {
    if (!activeDoc) return;
    const updated = await deleteSentenceComment(activeDoc.id, commentId);
    setIndex(updated);
    if (activeCommentId === commentId) setActiveCommentId(null);
    showToast('Deleted comment from comments.json');
  }

  const showRightPanel = activeView === 'reader' && !!activeDoc && rightPanelOpen;

  return (
    <div className={`nexus-shell ${showRightPanel ? '' : 'no-right'}`}>
      <Sidebar
        tree={index.tree}
        activeView={activeView}
        activeDocId={activeDoc?.id ?? null}
        docCount={index.documents.length}
        conceptCount={index.concepts.length}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        onChangeView={setActiveView}
        onSelectDoc={handleSelectDoc}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {activeView === 'reader' && activeDoc && (
        <DocumentReader
          doc={activeDoc}
          conceptsMap={conceptsMap}
          docsMap={docsMap}
          refsMap={refsMap}
          activeCommentId={activeCommentId}
          jumpRequest={jumpRequest}
          rightPanelOpen={rightPanelOpen}
          onToggleRightPanel={() => setRightPanelOpen((o) => !o)}
          onSelectDoc={handleSelectDoc}
          onInspectConcept={handleInspectConcept}
          onOpenTermsPanel={() => {
            setActiveConceptId(null);
            setRightTab('concept');
            setRightPanelOpen(true);
          }}
          onSelectComment={(cid) => {
            setActiveCommentId(cid);
            setRightTab('comments');
            setRightPanelOpen(true);
          }}
          onSaveMarkdown={handleSaveMarkdown}
          onAddComment={handleAddComment}
        />
      )}

      {activeView === 'graph' && (
        <KnowledgeGraph
          nodes={index.graph.nodes}
          edges={index.graph.edges}
          activeDocId={activeDoc?.id ?? null}
          theme={theme}
          conceptsMap={conceptsMap}
          conceptTopDocs={index.conceptTopDocs}
          docsMap={docsMap}
          refsMap={refsMap}
          onOpenDoc={handleSelectDoc}
        />
      )}

      {activeView === 'ontology' && (
        <OntologyBrowser
          concepts={index.concepts}
          conceptTopDocs={index.conceptTopDocs}
          docsMap={docsMap}
          onOpenDoc={handleSelectDoc}
        />
      )}

      {showRightPanel && activeDoc && (
        <RightPanel
          doc={activeDoc}
          activeTab={rightTab}
          activeCommentId={activeCommentId}
          activeConcept={activeConcept}
          conceptsMap={conceptsMap}
          conceptTopDocs={index.conceptTopDocs}
          docsMap={docsMap}
          onChangeTab={setRightTab}
          onSelectComment={handleJumpToComment}
          onToggleResolveComment={handleToggleResolveComment}
          onDeleteComment={handleDeleteComment}
          onSaveNotes={handleSaveNotes}
          onInspectConcept={handleInspectConcept}
          onSelectDoc={handleSelectDoc}
        />
      )}

      <CommandPalette
        open={searchOpen}
        documents={index.documents}
        concepts={index.concepts}
        references={index.references}
        onClose={() => setSearchOpen(false)}
        onSelectDoc={handleSelectDoc}
        onSelectConcept={handleInspectConcept}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
