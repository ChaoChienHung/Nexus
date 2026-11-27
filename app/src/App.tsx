import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DocReviewStatus,
  NexusCapabilities,
  NexusIndex,
  SentenceComment,
} from '../server/types';
import {
  addSentenceComment,
  deleteRawFile,
  deleteSentenceComment,
  fetchCapabilities,
  fetchIndex,
  fetchVaults,
  saveDocumentMarkdown,
  saveDocumentNotes,
  switchVault,
  updateDocumentReview,
  updateSentenceComment,
  uploadRawFile,
} from './api';
import { Sidebar, type MainView } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { DocumentReader } from './components/DocumentReader';
import { RightPanel, type RightTab } from './components/RightPanel';
import { KnowledgeGraph } from './components/KnowledgeGraph';
import { OntologyBrowser } from './components/OntologyBrowser';
import { RawInboxView } from './components/RawInboxView';
import { CommandPalette } from './components/CommandPalette';
import { SettingsModal } from './components/SettingsModal';
import { UI_COPY, type UiLang } from './i18n';
import type { VaultOption } from '../server/types';

const MentorionView = lazy(() =>
  import('./components/MentorionView').then((m) => ({ default: m.MentorionView })),
);

const DEFAULT_CAPABILITIES: NexusCapabilities = {
  vault: { source: 'default' },
  mentorion: {
    configured: false,
    online: false,
    apiUrl: null,
    checkedAt: '',
  },
};

export function App() {
  const [index, setIndex] = useState<NexusIndex | null>(null);
  const [capabilities, setCapabilities] = useState<NexusCapabilities>(DEFAULT_CAPABILITIES);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<MainView>('home');
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [jumpRequest, setJumpRequest] = useState<{ commentId: string; seq: number } | null>(null);
  const [sectionJumpRequest, setSectionJumpRequest] = useState<{
    section: string;
    seq: number;
  } | null>(null);
  const [vaults, setVaults] = useState<VaultOption[]>([]);
  const [activeVaultPath, setActiveVaultPath] = useState<string>('');
  const [rightTab, setRightTab] = useState<RightTab>('comments');
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = window.localStorage.getItem('nexus-theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [lang, setLang] = useState<UiLang>(() => {
    const saved = window.localStorage.getItem('nexus-lang');
    return saved === 'en' ? 'en' : 'zh-Hant';
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('nexus-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    window.localStorage.setItem('nexus-lang', lang);
  }, [lang]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((curr) => (curr === msg ? null : curr)), 2600);
  }, []);

  const refreshCapabilities = useCallback(
    async (notifyIfChecked = false) => {
      try {
        const nextCaps = await fetchCapabilities();
        setCapabilities((prev) => {
          if (notifyIfChecked) {
            const t = UI_COPY[lang];
            if (nextCaps.mentorion.online) {
              showToast(t.mentorionUnlockedToast);
            } else if (nextCaps.mentorion.configured) {
              showToast(t.mentorionStillOfflineToast);
            }
          } else if (!prev.mentorion.online && nextCaps.mentorion.online) {
            showToast(UI_COPY[lang].mentorionUnlockedToast);
          }
          return nextCaps;
        });
        if (!nextCaps.mentorion.online) {
          setActiveView((v) => (v === 'mentorion' ? 'home' : v));
        }
      } catch {
        // Keep previous capabilities if local probe request fails transiently
      }
    },
    [lang, showToast],
  );

  useEffect(() => {
    Promise.all([
      fetchIndex(),
      fetchCapabilities().catch(() => DEFAULT_CAPABILITIES),
      fetchVaults().catch(() => ({ activePath: '', activeLabel: '', vaults: [] })),
    ])
      .then(([data, caps, vaultData]) => {
        setIndex(data);
        setCapabilities(caps);
        setVaults(vaultData.vaults);
        setActiveVaultPath(vaultData.activePath);
        if (data.documents.length > 0) {
          setActiveDocId(data.documents[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  // Re-probe silently on window focus when Mentorion is configured but currently locked/offline
  useEffect(() => {
    if (!capabilities.mentorion.configured || capabilities.mentorion.online) return;
    const onFocus = () => {
      void refreshCapabilities(false);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [capabilities.mentorion.configured, capabilities.mentorion.online, refreshCapabilities]);

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

  function handleSelectDoc(docId: string, section?: string) {
    setActiveDocId(docId);
    setActiveCommentId(null);
    setJumpRequest(null);
    if (section?.trim()) {
      setSectionJumpRequest((prev) => ({ section: section.trim(), seq: (prev?.seq ?? 0) + 1 }));
    } else {
      setSectionJumpRequest(null);
    }
    setActiveView('reader');
  }

  async function handleSwitchVault(vaultPath: string, label?: string) {
    const res = await switchVault(vaultPath, label);
    setIndex(res.index);
    setVaults(res.vaults);
    setActiveVaultPath(res.activePath);
    setActiveDocId(res.index.documents[0]?.id ?? null);
    setActiveConceptId(null);
    setActiveCommentId(null);
    setSectionJumpRequest(null);
    showToast(UI_COPY[lang].vaultSwitchedToast(res.activeLabel));
  }

  async function handleUploadRawFile(file: File, subfolder?: string) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? '');
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
    const res = await uploadRawFile({
      filename: file.name,
      subfolder,
      contentBase64: base64,
    });
    setIndex(res.index);
    showToast(`Saved raw/${res.relPath}`);
  }

  async function handleDeleteRawFile(relPath: string) {
    const updated = await deleteRawFile(relPath);
    setIndex(updated);
    showToast(`Removed raw/${relPath}`);
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

  async function handleToggleReview(nextReview: DocReviewStatus) {
    if (!activeDoc) return;
    const updated = await updateDocumentReview(activeDoc.id, nextReview);
    setIndex(updated);
    showToast(
      nextReview === 'reviewed'
        ? lang === 'zh-Hant'
          ? '已標記為已複習 (review: reviewed)'
          : 'Marked as reviewed (review: reviewed)'
        : lang === 'zh-Hant'
          ? '已標記為未複習 (review: fresh)'
          : 'Marked as fresh (review: fresh)',
    );
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
        pendingRawCount={(index.rawFiles ?? []).filter((f) => f.status === 'pending').length}
        lang={lang}
        mentorion={capabilities.mentorion}
        onChangeView={setActiveView}
        onSelectDoc={handleSelectDoc}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onRetryMentorion={() => void refreshCapabilities(true)}
      />

      {activeView === 'home' && (
        <HomeView
          documents={index.documents}
          conceptCount={index.concepts.length}
          lang={lang}
          mentorion={capabilities.mentorion}
          onOpenSearch={() => setSearchOpen(true)}
          onChangeView={setActiveView}
          onRetryMentorion={() => void refreshCapabilities(true)}
        />
      )}

      {activeView === 'reader' && activeDoc && (
        <DocumentReader
          doc={activeDoc}
          lang={lang}
          conceptsMap={conceptsMap}
          docsMap={docsMap}
          activeCommentId={activeCommentId}
          jumpRequest={jumpRequest}
          sectionJumpRequest={sectionJumpRequest}
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
          onToggleReview={handleToggleReview}
          onAddComment={handleAddComment}
        />
      )}

      {activeView === 'graph' && (
        <KnowledgeGraph
          nodes={index.graph.nodes}
          edges={index.graph.edges}
          activeDocId={activeDoc?.id ?? null}
          theme={theme}
          lang={lang}
          conceptsMap={conceptsMap}
          conceptTopDocs={index.conceptTopDocs}
          docsMap={docsMap}
          onOpenDoc={handleSelectDoc}
        />
      )}

      {activeView === 'ontology' && (
        <OntologyBrowser
          concepts={index.concepts}
          conceptTopDocs={index.conceptTopDocs}
          docsMap={docsMap}
          lang={lang}
          onOpenDoc={handleSelectDoc}
        />
      )}

      {activeView === 'raw' && (
        <RawInboxView
          rawFiles={index.rawFiles ?? []}
          lang={lang}
          onUploadFile={handleUploadRawFile}
          onDeleteFile={handleDeleteRawFile}
          onOpenDoc={handleSelectDoc}
          onNotify={showToast}
        />
      )}

      {activeView === 'mentorion' && capabilities.mentorion.online && (
        <Suspense
          fallback={
            <main className="main-pane" style={{ padding: 40, color: 'var(--text-secondary)' }}>
              Loading Mentorion...
            </main>
          }
        >
          <MentorionView
            mentorion={capabilities.mentorion}
            documents={index.documents}
            lang={lang}
            onOpenDoc={handleSelectDoc}
            onRefreshCapabilities={() => refreshCapabilities(true)}
          />
        </Suspense>
      )}

      {showRightPanel && activeDoc && (
        <RightPanel
          doc={activeDoc}
          lang={lang}
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
          onNotify={showToast}
        />
      )}

      <CommandPalette
        open={searchOpen}
        lang={lang}
        documents={index.documents}
        concepts={index.concepts}
        onClose={() => setSearchOpen(false)}
        onSelectDoc={handleSelectDoc}
        onSelectConcept={handleInspectConcept}
      />

      <SettingsModal
        open={settingsOpen}
        theme={theme}
        lang={lang}
        mentorion={capabilities.mentorion}
        vaults={vaults}
        activeVaultPath={activeVaultPath}
        onChangeTheme={setTheme}
        onChangeLang={setLang}
        onSwitchVault={handleSwitchVault}
        onRefreshCapabilities={() => refreshCapabilities(true)}
        onClose={() => setSettingsOpen(false)}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
