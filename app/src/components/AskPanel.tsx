import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { RefreshCw, Send, SlidersHorizontal, Sparkles } from 'lucide-react';
import { askVault, fetchOllamaModels } from '../api';
import { UI_COPY, type UiLang } from '../i18n';
import type { AskCitation, AskConceptRef, AskProvider, AskScope } from '../../server/ask';
import type { IndexedDocument } from '../../server/types';

interface AskPanelProps {
  doc: IndexedDocument;
  lang: UiLang;
  onSelectDoc: (docId: string, section?: string) => void;
  onInspectConcept: (conceptId: string) => void;
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: AskCitation[];
  concepts?: AskConceptRef[];
  meta?: string;
  warning?: string;
}

interface AskConfig {
  provider: AskProvider;
  ollamaUrl: string;
  ollamaModel: string;
  openaiUrl: string;
  openaiModel: string;
  openaiKey: string;
}

const DEFAULT_CONFIG: AskConfig = {
  provider: 'retrieval',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:7b',
  openaiUrl: 'https://api.openai.com/v1',
  openaiModel: 'gpt-4o-mini',
  openaiKey: '',
};

function loadConfig(): AskConfig {
  try {
    const raw = window.localStorage.getItem('nexus-ask-config');
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<AskConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function AskPanel({
  doc,
  lang,
  onSelectDoc,
  onInspectConcept,
}: AskPanelProps) {
  const t = UI_COPY[lang];
  const [scope, setScope] = useState<AskScope>('doc');
  const [config, setConfig] = useState<AskConfig>(loadConfig);
  const [showConfig, setShowConfig] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.localStorage.setItem('nexus-ask-config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  async function probeOllama() {
    setLoadingModels(true);
    try {
      const models = await fetchOllamaModels(config.ollamaUrl);
      setOllamaModels(models);
      if (models.length > 0 && !models.includes(config.ollamaModel)) {
        setConfig((prev) => ({ ...prev, ollamaModel: models[0] }));
      }
    } finally {
      setLoadingModels(false);
    }
  }

  async function handleSend() {
    const q = input.trim();
    if (!q || sending) return;

    const userTurn: ChatTurn = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: q,
    };
    const nextHistory = [...messages, userTurn]
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userTurn]);
    setInput('');
    setSending(true);

    try {
      const res = await askVault({
        question: q,
        scope,
        docId: doc.id,
        category: doc.categoryPath[0],
        provider: config.provider,
        baseUrl:
          config.provider === 'ollama'
            ? config.ollamaUrl
            : config.provider === 'openai'
              ? config.openaiUrl
              : undefined,
        apiKey: config.provider === 'openai' ? config.openaiKey : undefined,
        model:
          config.provider === 'ollama'
            ? config.ollamaModel
            : config.provider === 'openai'
              ? config.openaiModel
              : undefined,
        lang,
        history: nextHistory.slice(0, -1),
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: res.answer,
          citations: res.citations,
          concepts: res.concepts,
          meta: res.modelUsed,
          warning: res.warning,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content: err instanceof Error ? err.message : String(err),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ask-panel">
      <div className="ask-controls">
        <div className="sidebar-filter-pills">
          <button
            type="button"
            className={`sidebar-filter-btn ${scope === 'doc' ? 'active' : ''}`}
            onClick={() => setScope('doc')}
          >
            {t.askScopeDoc}
          </button>
          {doc.categoryPath.length > 0 && (
            <button
              type="button"
              className={`sidebar-filter-btn ${scope === 'category' ? 'active' : ''}`}
              onClick={() => setScope('category')}
              title={doc.categoryPath[0]}
            >
              {t.askScopeCategory}
            </button>
          )}
          <button
            type="button"
            className={`sidebar-filter-btn ${scope === 'vault' ? 'active' : ''}`}
            onClick={() => setScope('vault')}
          >
            {t.askScopeVault}
          </button>
        </div>

        <button
          type="button"
          className={`icon-btn ${showConfig ? 'active' : ''}`}
          title={t.askSettings}
          onClick={() => {
            const next = !showConfig;
            setShowConfig(next);
            if (next && config.provider === 'ollama' && ollamaModels.length === 0) {
              void probeOllama();
            }
          }}
        >
          <SlidersHorizontal size={15} />
        </button>
      </div>

      {showConfig && (
        <div className="ask-config-box">
          <div className="ask-provider-row">
            {(['retrieval', 'ollama', 'openai'] as AskProvider[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`sidebar-filter-btn ${config.provider === p ? 'active' : ''}`}
                onClick={() => {
                  setConfig((prev) => ({ ...prev, provider: p }));
                  if (p === 'ollama' && ollamaModels.length === 0) {
                    void probeOllama();
                  }
                }}
              >
                {p === 'retrieval'
                  ? t.askProviderRetrieval
                  : p === 'ollama'
                    ? t.askProviderOllama
                    : t.askProviderOpenAI}
              </button>
            ))}
          </div>

          {config.provider === 'ollama' && (
            <div className="ask-config-fields">
              <input
                className="ask-config-input"
                placeholder="http://localhost:11434"
                value={config.ollamaUrl}
                onChange={(e) => setConfig((prev) => ({ ...prev, ollamaUrl: e.target.value }))}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                {ollamaModels.length > 0 ? (
                  <select
                    className="ask-config-input"
                    value={config.ollamaModel}
                    onChange={(e) => setConfig((prev) => ({ ...prev, ollamaModel: e.target.value }))}
                  >
                    {ollamaModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="ask-config-input"
                    placeholder="qwen2.5:7b"
                    value={config.ollamaModel}
                    onChange={(e) => setConfig((prev) => ({ ...prev, ollamaModel: e.target.value }))}
                  />
                )}
                <button
                  type="button"
                  className="icon-btn"
                  title="Detect Ollama models"
                  disabled={loadingModels}
                  onClick={() => void probeOllama()}
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
          )}

          {config.provider === 'openai' && (
            <div className="ask-config-fields">
              <input
                className="ask-config-input"
                placeholder="https://api.openai.com/v1"
                value={config.openaiUrl}
                onChange={(e) => setConfig((prev) => ({ ...prev, openaiUrl: e.target.value }))}
              />
              <input
                className="ask-config-input"
                placeholder="Model (e.g. gpt-4o-mini)"
                value={config.openaiModel}
                onChange={(e) => setConfig((prev) => ({ ...prev, openaiModel: e.target.value }))}
              />
              <input
                type="password"
                className="ask-config-input"
                placeholder="API Key (stored locally)"
                value={config.openaiKey}
                onChange={(e) => setConfig((prev) => ({ ...prev, openaiKey: e.target.value }))}
              />
            </div>
          )}
        </div>
      )}

      <div className="ask-messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="ask-empty">
            <Sparkles size={18} style={{ color: 'var(--accent)', marginBottom: 8 }} />
            <div>{t.askEmpty}</div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`ask-msg ${msg.role}`}>
              {msg.role === 'user' ? (
                <div className="ask-msg-bubble user">{msg.content}</div>
              ) : (
                <div className="ask-msg-bubble assistant">
                  {msg.warning && <div className="ask-warning">{msg.warning}</div>}
                  <div
                    className="ask-answer-md"
                    dangerouslySetInnerHTML={{
                      __html: marked.parse(msg.content, { async: false, gfm: true }) as string,
                    }}
                  />
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="ask-refs-block">
                      <div className="ask-refs-label">{t.askCitations}</div>
                      <div className="ask-chip-list">
                        {msg.citations.map((cit, i) => (
                          <button
                            key={`${cit.docId}-${cit.sectionHeading ?? i}`}
                            type="button"
                            className="ask-citation-chip"
                            onClick={() => onSelectDoc(cit.docId, cit.sectionHeading)}
                          >
                            {cit.title}
                            {cit.sectionHeading ? ` § ${cit.sectionHeading}` : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {msg.concepts && msg.concepts.length > 0 && (
                    <div className="ask-refs-block">
                      <div className="ask-refs-label">{t.askConcepts}</div>
                      <div className="ask-chip-list">
                        {msg.concepts.map((c) => (
                          <button
                            key={c.concept_id}
                            type="button"
                            className="ask-concept-chip"
                            onClick={() => onInspectConcept(c.concept_id)}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {msg.meta && <div className="ask-meta-tag">{msg.meta}</div>}
                </div>
              )}
            </div>
          ))
        )}
        {sending && <div className="ask-thinking">{t.askThinking}</div>}
      </div>

      <div className="ask-composer">
        <textarea
          className="ask-input"
          rows={2}
          placeholder={t.askPlaceholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <button
          type="button"
          className="btn btn-primary ask-send-btn"
          disabled={!input.trim() || sending}
          onClick={() => void handleSend()}
          title={t.askSend}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
