import { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, ExternalLink, Loader2, Lock, RefreshCw, Sparkles, X } from 'lucide-react';
import {
  fetchMentorionTrackedSources,
  generateMentorionGraphQuiz,
  recordMentorionReview,
  syncVaultToMentorion,
  updateDocumentReview,
  type MentorionGraphQuizResponse,
  type MentorionTrackedSource,
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
  const [trackedSources, setTrackedSources] = useState<MentorionTrackedSource[]>([]);
  const [generatingDocId, setGeneratingDocId] = useState<string | null>(null);
  const [quizResult, setQuizResult] = useState<MentorionGraphQuizResponse | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Review completion modal state (SM-2 OR Custom Date, matching Mentorion)
  const [reviewingDoc, setReviewingDoc] = useState<IndexedDocument | null>(null);
  const [reviewMode, setReviewMode] = useState<'sm2' | 'custom_date'>('sm2');
  const [reviewRating, setReviewRating] = useState<number>(4);
  const [customNextDate, setCustomNextDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);

  const visibleDocs = filterMode === 'fresh' ? freshDocs : documents;
  const llmAvailable = llmStatus ? llmStatus.available : false;

  const findTrackedForDoc = (doc: IndexedDocument): MentorionTrackedSource | undefined => {
    const relNorm = doc.bundleRelPath.replace(/\\/g, '/').replace(/^\/+/, '');
    return trackedSources.find((src) => {
      if (src.source_doc_id && src.source_doc_id === doc.id) return true;
      if (src.file_path) {
        const fp = src.file_path.replace(/\\/g, '/');
        if (fp.includes('/wiki/') && (fp.endsWith(relNorm) || fp.endsWith(`${relNorm}/index.md`))) {
          return true;
        }
      }
      return false;
    });
  };

  const refreshLiveStats = () => {
    fetch('/api/integrations/mentorion/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setStats(data as MentorionStatsSummary);
      })
      .catch(() => {});
    fetchMentorionTrackedSources()
      .then((list) => setTrackedSources(list))
      .catch(() => {});
  };

  const handlePracticeOnly = async (doc: IndexedDocument) => {
    setQuizError(null);
    setReviewNotice(null);
    try {
      if (doc.review !== 'reviewed') {
        await updateDocumentReview(doc.id, 'reviewed', true);
      }
      setReviewNotice(
        zh
          ? `已完成「${doc.title}」自由練習（Practice：此筆記尚未在 Mentorion 建立排程，不會新增 Task，僅更新 Nexus 狀態為 reviewed）。`
          : `Completed Practice for "${doc.title}" (not scheduled in Mentorion; no task created, Nexus status marked reviewed).`,
      );
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : String(err));
    }
  };

  const addDaysFromToday = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const handleSubmitReview = async () => {
    if (!reviewingDoc) return;
    setSubmittingReview(true);
    setQuizError(null);
    setReviewNotice(null);
    try {
      const res = await recordMentorionReview({
        source_doc_id: reviewingDoc.id,
        file_path: reviewingDoc.bundleRelPath,
        mode: reviewMode,
        rating: reviewRating,
        next_review_date: reviewMode === 'custom_date' ? customNextDate : undefined,
      });
      // Also mark the Nexus note as reviewed (skip duplicate Mentorion sync since we just recorded it)
      if (reviewingDoc.review !== 'reviewed') {
        await updateDocumentReview(reviewingDoc.id, 'reviewed', true).catch(() => {});
      }
      setReviewNotice(
        res.scheduled
          ? zh
            ? `已同步「${reviewingDoc.title}」排程複習至 Mentorion（下次排程：${res.next_review_date}，Ease ${(res.ease_factor ?? 2.5).toFixed(2)}）。`
            : `Synced scheduled review for "${reviewingDoc.title}" to Mentorion (next: ${res.next_review_date}, Ease ${(res.ease_factor ?? 2.5).toFixed(2)}).`
          : zh
            ? `已完成「${reviewingDoc.title}」自由練習（Practice：Mentorion 目前無此筆記待辦排程）。`
            : `Completed Practice for "${reviewingDoc.title}" (no pending task in Mentorion).`,
      );
      setReviewingDoc(null);
      refreshLiveStats();
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingReview(false);
    }
  };

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

    fetchMentorionTrackedSources()
      .then((list) => {
        if (!cancelled) setTrackedSources(list);
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

          {reviewNotice && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-strong, var(--border-subtle))',
                background: 'var(--bg-elevated)',
                fontSize: '12px',
                fontWeight: 500,
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span>{reviewNotice}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setReviewNotice(null)}
              >
                <X size={13} />
              </button>
            </div>
          )}

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
              {visibleDocs.map((doc) => {
                const tracked = findTrackedForDoc(doc);
                const isScheduled = Boolean(tracked?.has_pending_task);
                return (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {isScheduled ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => {
                            setReviewingDoc(doc);
                            setReviewMode('sm2');
                            setReviewRating(4);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '11px',
                            padding: '4px 10px',
                          }}
                        >
                          <CheckCircle2 size={12} />
                          <span>{zh ? '更新排程複習' : 'Complete Scheduled'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => void handlePracticeOnly(doc)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '11px',
                            padding: '4px 10px',
                          }}
                        >
                          <CheckCircle2 size={12} />
                          <span>{zh ? '自由練習 (Practice)' : 'Practice'}</span>
                        </button>
                      )}
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
                    {isScheduled && tracked?.next_review_date && (
                      <>
                        <span className="meta-sep">·</span>
                        <span>
                          {zh ? 'Mentorion 排程' : 'Scheduled'}: <strong>{tracked.next_review_date}</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Review Completion Modal (SM-2 or Custom Date) */}
        {reviewingDoc && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setReviewingDoc(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 60,
              background: 'rgba(9, 9, 11, 0.45)',
              backdropFilter: 'blur(2px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '460px',
                borderRadius: '16px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface, #ffffff)',
                padding: '22px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', opacity: 0.6, textTransform: 'uppercase' }}>
                    {zh ? '同步複習進度至 MENTORION' : 'SYNC REVIEW TO MENTORION'}
                  </div>
                  <h3 style={{ margin: '4px 0 0', fontSize: '17px', fontWeight: 700 }}>
                    {reviewingDoc.title}
                  </h3>
                </div>
                <button type="button" className="icon-btn" onClick={() => setReviewingDoc(null)}>
                  <X size={16} />
                </button>
              </div>

              {/* Mode Switch: SM-2 vs Custom Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  className={`btn ${reviewMode === 'sm2' ? 'btn-primary' : ''}`}
                  style={{ justifyContent: 'center', fontSize: '12px', padding: '8px 12px' }}
                  onClick={() => setReviewMode('sm2')}
                >
                  {zh ? 'SM-2 智慧排程' : 'SM-2 Auto Schedule'}
                </button>
                <button
                  type="button"
                  className={`btn ${reviewMode === 'custom_date' ? 'btn-primary' : ''}`}
                  style={{ justifyContent: 'center', fontSize: '12px', padding: '8px 12px' }}
                  onClick={() => setReviewMode('custom_date')}
                >
                  <Calendar size={13} style={{ marginRight: '5px' }} />
                  {zh ? '指定下次複習日期' : 'Custom Next Date'}
                </button>
              </div>

              {reviewMode === 'sm2' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '12px', opacity: 0.75 }}>
                    {zh ? '選擇本次回憶熟練度（0 全忘 → 5 精通）：' : 'Select recall quality (0 blackout → 5 mastery):'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                    {[0, 1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        className={`btn ${reviewRating === score ? 'btn-primary' : ''}`}
                        style={{ justifyContent: 'center', fontWeight: 600, padding: '8px 0' }}
                        onClick={() => setReviewRating(score)}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', opacity: 0.75 }}>
                    {zh ? '快速指定間隔或自選日期：' : 'Quick interval or pick exact date:'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {[1, 3, 7, 14, 30].map((days) => (
                      <button
                        key={days}
                        type="button"
                        className="btn"
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                        onClick={() => setCustomNextDate(addDaysFromToday(days))}
                      >
                        +{days}{zh ? ' 天' : 'd'}
                      </button>
                    ))}
                  </div>
                  <input
                    type="date"
                    value={customNextDate}
                    onChange={(e) => setCustomNextDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-elevated)',
                      color: 'inherit',
                      fontSize: '13px',
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setReviewingDoc(null)}
                >
                  {zh ? '取消' : 'Cancel'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={submittingReview || (reviewMode === 'custom_date' && !customNextDate)}
                  onClick={() => void handleSubmitReview()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {submittingReview ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />}
                  <span>{zh ? '確認並更新 Mentorion' : 'Confirm & Sync'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
