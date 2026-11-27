import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Lock, RefreshCw, Sparkles } from 'lucide-react';
import {
  generateMentorionGraphQuiz,
  syncVaultToMentorion,
  type MentorionGraphQuizResponse,
} from '../api';
import { UI_COPY, type UiLang } from '../i18n';
import type { IndexedDocument, MentorionCapability } from '../../server/types';

interface MentorionViewProps {
  mentorion: MentorionCapability;
  documents: IndexedDocument[];
  lang: UiLang;
  onOpenDoc: (docId: string) => void;
  onRefreshCapabilities: () => Promise<void>;
}

interface MentorionStatsSummary {
  overdue_count?: number;
  today_completed_points?: number;
  daily_target?: number;
}

interface MentorionLlmSummary {
  available: boolean;
  active_provider_name?: string | null;
}

export function MentorionView({
  mentorion,
  documents,
  lang,
  onOpenDoc,
  onRefreshCapabilities,
}: MentorionViewProps) {
  const zh = lang === 'zh-Hant';
  const t = UI_COPY[lang];
  const freshDocs = documents.filter((d) => d.review === 'fresh');
  const [filterMode, setFilterMode] = useState<'fresh' | 'all'>('fresh');
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'idle'>('idle');
  const [stats, setStats] = useState<MentorionStatsSummary | null>(null);
  const [llmStatus, setLlmStatus] = useState<MentorionLlmSummary | null>(null);
  const [generatingDocId, setGeneratingDocId] = useState<string | null>(null);
  const [quizResult, setQuizResult] = useState<MentorionGraphQuizResponse | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);

  const visibleDocs = filterMode === 'fresh' ? freshDocs : documents;
  const llmAvailable = llmStatus ? llmStatus.available : false;

  // Automatically sync fresh Nexus notes and fetch live stats + LLM status when opened
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

    fetch('/api/integrations/mentorion/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setStats(data as MentorionStatsSummary);
      })
      .catch(() => {});

    fetch('/api/integrations/mentorion/api/llm/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setLlmStatus(data as MentorionLlmSummary);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [mentorion.online, documents.length]);

  const handleGraphQuiz = async (docId: string) => {
    if (!llmAvailable) return;
    setGeneratingDocId(docId);
    setQuizError(null);
    try {
      const res = await generateMentorionGraphQuiz(docId, lang, 3);
      setQuizResult(res);
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingDocId(null);
    }
  };

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
                  ? zh
                    ? '自動同步中...'
                    : 'Auto-syncing...'
                  : syncStatus === 'synced'
                    ? zh
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
                <span>{zh ? '開啟獨立 Mentorion' : 'Open Mentorion'}</span>
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

        {/* Live Mentorion Status & Stats Bar */}
        <div className="mentorion-meta-bar" style={{ flexWrap: 'wrap', gap: '8px' }}>
          {mentorion.apiUrl && (
            <>
              <span>Backend:</span>
              <code>{mentorion.apiUrl}</code>
            </>
          )}
          {stats && (
            <>
              <span className="meta-sep">·</span>
              <span>
                {zh ? '逾期任務' : 'Overdue'}:{' '}
                <strong>{stats.overdue_count ?? 0}</strong>
              </span>
              {typeof stats.today_completed_points === 'number' && (
                <>
                  <span className="meta-sep">·</span>
                  <span>
                    {zh ? '今日進度' : 'Today'}:{' '}
                    <strong>
                      {stats.today_completed_points} / {stats.daily_target ?? 5.0}
                    </strong>
                  </span>
                </>
              )}
            </>
          )}
          {llmStatus && (
            <>
              <span className="meta-sep">·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {!llmAvailable && <Lock size={11} />}
                <span>
                  {llmAvailable
                    ? `LLM: ${llmStatus.active_provider_name || 'Ready'}`
                    : zh
                      ? '未偵測到任何 LLM API Key'
                      : 'No LLM API key detected'}
                </span>
              </span>
            </>
          )}
        </div>

        <section className="mentorion-section">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              marginBottom: '12px',
            }}
          >
            <h2 className="mentorion-section-title" style={{ margin: 0 }}>
              {filterMode === 'fresh'
                ? t.mentorionFreshQueue(freshDocs.length)
                : zh
                  ? `全部知識庫筆記 (${documents.length})`
                  : `All Vault Notes (${documents.length})`}
            </h2>
            <div style={{ display: 'inline-flex', gap: '6px' }}>
              <button
                type="button"
                className={`btn ${filterMode === 'fresh' ? 'btn-primary' : ''}`}
                style={{ fontSize: '12px', padding: '4px 12px' }}
                onClick={() => setFilterMode('fresh')}
              >
                {zh ? `待複習 (${freshDocs.length})` : `Fresh (${freshDocs.length})`}
              </button>
              <button
                type="button"
                className={`btn ${filterMode === 'all' ? 'btn-primary' : ''}`}
                style={{ fontSize: '12px', padding: '4px 12px' }}
                onClick={() => setFilterMode('all')}
              >
                {zh ? `全部筆記 (${documents.length})` : `All (${documents.length})`}
              </button>
            </div>
          </div>

          {quizError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-elevated)',
                fontSize: '12px',
                marginBottom: '12px',
              }}
            >
              {quizError}
            </div>
          )}

          {quizResult && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border-strong, var(--border-subtle))',
                background: 'var(--bg-elevated)',
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '13px' }}>
                  {zh
                    ? `已為「${quizResult.title}」生成 ${quizResult.questions.length} 題圖譜跨概念題目（已存入 Mentorion 題庫）`
                    : `Generated ${quizResult.questions.length} graph-aware question(s) for "${quizResult.title}" (saved to Mentorion)`}
                </strong>
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                  onClick={() => setQuizResult(null)}
                >
                  {zh ? '收起' : 'Dismiss'}
                </button>
              </div>
              {quizResult.related_concepts_used.length > 0 && (
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                  {zh ? '自動帶入 1-hop 鄰居概念：' : '1-hop neighbor concepts injected: '}
                  {quizResult.related_concepts_used
                    .map((c) => `${c.label} (${c.relation})`)
                    .join(' · ')}
                </div>
              )}
              <ol
                style={{
                  margin: '4px 0 0 18px',
                  padding: 0,
                  fontSize: '13px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {quizResult.questions.map((q, idx) => (
                  <li key={q.id || idx}>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', opacity: 0.7, marginRight: '6px' }}>
                      [{q.type}]
                    </span>
                    {q.prompt}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {visibleDocs.length === 0 ? (
            <p className="mentorion-empty">{t.noFreshDocs}</p>
          ) : (
            <div className="mentorion-doc-list">
              {visibleDocs.map((doc) => (
                <div key={doc.id} className="mentorion-doc-card" style={{ cursor: 'default' }}>
                  <div className="mentorion-doc-card-top">
                    <button
                      type="button"
                      className="mentorion-doc-title"
                      onClick={() => onOpenDoc(doc.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: 'inherit',
                      }}
                    >
                      {doc.title}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn"
                        disabled={!llmAvailable || generatingDocId === doc.id}
                        title={
                          llmAvailable
                            ? undefined
                            : zh
                              ? '未偵測到任何 LLM API Key'
                              : 'No LLM API key detected'
                        }
                        onClick={() => void handleGraphQuiz(doc.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          padding: '4px 10px',
                          opacity: !llmAvailable ? 0.5 : 1,
                          cursor: !llmAvailable ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {generatingDocId === doc.id ? (
                          <Loader2 size={12} className="spin" />
                        ) : !llmAvailable ? (
                          <Lock size={11} />
                        ) : (
                          <Sparkles size={12} />
                        )}
                        <span>{zh ? '圖譜跨概念出題' : 'Graph Quiz'}</span>
                      </button>
                      <span className={`review-pill ${doc.review}`}>
                        <span className="review-dot" />
                        <span>{doc.review === 'fresh' ? t.reviewFresh : t.reviewReviewed}</span>
                      </span>
                    </div>
                  </div>
                  {doc.summary && <p className="mentorion-doc-summary">{doc.summary}</p>}
                  <div className="mentorion-doc-meta">
                    <span>{doc.categoryPath.join(' / ')}</span>
                    <span className="meta-sep">·</span>
                    <code>{doc.id}</code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
