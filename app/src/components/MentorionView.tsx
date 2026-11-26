import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react';
import { syncVaultToMentorion } from '../api';
import { UI_COPY, type UiLang } from '../i18n';
import type { IndexedDocument, MentorionCapability } from '../../server/types';

interface MentorionViewProps {
  mentorion: MentorionCapability;
  documents: IndexedDocument[];
  lang: UiLang;
  onOpenDoc: (docId: string) => void;
  onRefreshCapabilities: () => Promise<void>;
}

export function MentorionView({
  mentorion,
  documents,
  lang,
  onOpenDoc,
  onRefreshCapabilities,
}: MentorionViewProps) {
  const t = UI_COPY[lang];
  const freshDocs = documents.filter((d) => d.review === 'fresh');
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'idle'>('idle');

  // Automatically sync fresh Nexus notes to Mentorion whenever this view is opened
  useEffect(() => {
    if (!mentorion.online) return;
    let cancelled = false;
    setSyncStatus('syncing');
    syncVaultToMentorion(true)
      .then(() => {
        if (!cancelled) setSyncStatus('synced');
      })
      .catch(() => {
        if (!cancelled) setSyncStatus('idle');
      });
    return () => {
      cancelled = true;
    };
  }, [mentorion.online, documents.length]);

  return (
    <main className="main-pane">
      <div className="mentorion-view">
        <div className="mentorion-header">
          <div>
            <h1 className="mentorion-title">{t.mentorionNav}</h1>
            <p className="mentorion-subtitle">{t.mentorionSubtitle}</p>
          </div>
          <div className="mentorion-header-actions">
            <span className="integration-badge online">
              <CheckCircle2 size={13} />
              <span>
                {syncStatus === 'syncing'
                  ? lang === 'zh-Hant'
                    ? '自動同步中...'
                    : 'Auto-syncing...'
                  : syncStatus === 'synced'
                    ? lang === 'zh-Hant'
                      ? '已自動同步'
                      : 'Auto-synced'
                    : t.statusOnline}
              </span>
            </span>
            {mentorion.appUrl && (
              <a
                className="btn btn-primary"
                href={mentorion.appUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span>{lang === 'zh-Hant' ? '開啟獨立 Mentorion' : 'Open Mentorion'}</span>
                <ExternalLink size={13} />
              </a>
            )}
            <button
              className="icon-btn"
              onClick={() => void onRefreshCapabilities()}
              title={t.retryProbe}
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {mentorion.apiUrl && (
          <div className="mentorion-meta-bar">
            <span>Backend:</span>
            <code>{mentorion.apiUrl}</code>
            {mentorion.appUrl && (
              <>
                <span className="meta-sep">·</span>
                <span>App:</span>
                <code>{mentorion.appUrl}</code>
              </>
            )}
          </div>
        )}

        <section className="mentorion-section">
          <h2 className="mentorion-section-title">{t.mentorionFreshQueue(freshDocs.length)}</h2>
          {freshDocs.length === 0 ? (
            <p className="mentorion-empty">{t.noFreshDocs}</p>
          ) : (
            <div className="mentorion-doc-list">
              {freshDocs.map((doc) => (
                <button
                  key={doc.id}
                  className="mentorion-doc-card"
                  onClick={() => onOpenDoc(doc.id)}
                >
                  <div className="mentorion-doc-card-top">
                    <span className="mentorion-doc-title">{doc.title}</span>
                    <span className="review-pill fresh">
                      <span className="review-dot" />
                      <span>{t.reviewFresh}</span>
                    </span>
                  </div>
                  {doc.summary && <p className="mentorion-doc-summary">{doc.summary}</p>}
                  <div className="mentorion-doc-meta">
                    <span>{doc.categoryPath.join(' / ')}</span>
                    <span className="meta-sep">·</span>
                    <code>{doc.id}</code>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
