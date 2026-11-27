import { searchNexus, searchSections } from './query';
import type { NexusIndex } from './types';

export type AskProvider = 'ollama' | 'openai' | 'retrieval';
export type AskScope = 'doc' | 'category' | 'vault';

export interface AskCitation {
  docId: string;
  title: string;
  sectionHeading?: string;
  snippet: string;
  score: number;
}

export interface AskConceptRef {
  concept_id: string;
  label: string;
  context: string;
}

export interface AskRequest {
  question: string;
  scope: AskScope;
  docId?: string;
  category?: string;
  provider: AskProvider;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  lang?: 'zh-Hant' | 'en';
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AskResponse {
  answer: string;
  citations: AskCitation[];
  concepts: AskConceptRef[];
  providerUsed: AskProvider;
  modelUsed: string;
  warning?: string;
}

export async function listOllamaModels(baseUrl = 'http://localhost:11434'): Promise<string[]> {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`${normalized}/api/tags`, { signal: controller.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    return (data.models ?? [])
      .map((m) => m.name?.trim())
      .filter((name): name is string => Boolean(name));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function buildGroundedContext(index: NexusIndex, req: AskRequest): {
  citations: AskCitation[];
  concepts: AskConceptRef[];
  contextPrompt: string;
} {
  const lang = req.lang ?? 'zh-Hant';
  const category = req.scope === 'category' ? req.category : undefined;
  const docId = req.scope === 'doc' ? req.docId : undefined;

  const sectionHits = searchSections(index, req.question, {
    limit: 6,
    category,
    docId,
  });

  const searchRes = searchNexus(index, req.question, {
    limit: 5,
    category,
  });

  const citations: AskCitation[] = [];
  const seenKeys = new Set<string>();

  for (const hit of sectionHits) {
    const key = `${hit.docId}#${hit.heading}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    citations.push({
      docId: hit.docId,
      title: hit.docTitle,
      sectionHeading: hit.heading !== hit.docTitle ? hit.heading : undefined,
      snippet: hit.snippet,
      score: hit.score,
    });
  }

  // Fallback to active document overview if scope === 'doc' and keyword match missed
  if (citations.length === 0 && docId) {
    const activeDoc = index.documents.find((d) => d.id === docId);
    if (activeDoc) {
      const plain = activeDoc.body.replace(/\s+/g, ' ').trim();
      citations.push({
        docId: activeDoc.id,
        title: activeDoc.title,
        snippet: plain.length > 420 ? `${plain.slice(0, 420)}...` : plain,
        score: 1,
      });
    }
  } else if (citations.length === 0) {
    for (const d of searchRes.documents.slice(0, 4)) {
      citations.push({
        docId: d.id,
        title: d.title,
        snippet: d.summary || d.title,
        score: d.score,
      });
    }
  }

  const concepts: AskConceptRef[] = searchRes.concepts.slice(0, 5).map((c) => ({
    concept_id: c.concept_id,
    label: lang === 'zh-Hant' ? c.labels['zh-Hant'] || c.labels.en : c.labels.en || c.labels['zh-Hant'],
    context:
      lang === 'zh-Hant' ? c.contexts['zh-Hant'] || c.contexts.en : c.contexts.en || c.contexts['zh-Hant'],
  }));

  // Also include concepts linked to the active document when in 'doc' scope
  if (docId && concepts.length < 4) {
    const activeDoc = index.documents.find((d) => d.id === docId);
    const conceptMap = new Map(index.concepts.map((c) => [c.concept_id, c]));
    const existing = new Set(concepts.map((c) => c.concept_id));
    for (const cid of [...(activeDoc?.concepts ?? []), ...(activeDoc?.mentionedConcepts ?? [])]) {
      if (existing.has(cid)) continue;
      const c = conceptMap.get(cid);
      if (!c) continue;
      existing.add(cid);
      concepts.push({
        concept_id: c.concept_id,
        label: lang === 'zh-Hant' ? c.labels['zh-Hant'] || c.labels.en : c.labels.en || c.labels['zh-Hant'],
        context:
          lang === 'zh-Hant' ? c.contexts['zh-Hant'] || c.contexts.en : c.contexts.en || c.contexts['zh-Hant'],
      });
      if (concepts.length >= 6) break;
    }
  }

  const parts: string[] = [];
  if (concepts.length > 0) {
    parts.push(
      '### Ontology Concepts\n' +
        concepts.map((c) => `- **${c.label}** (${c.concept_id}): ${c.context}`).join('\n'),
    );
  }
  if (citations.length > 0) {
    parts.push(
      '### Relevant Note Sections\n' +
        citations
          .map(
            (c, i) =>
              `[${i + 1}] ${c.title}${c.sectionHeading ? ` § ${c.sectionHeading}` : ''} (${c.docId})\n${c.snippet}`,
          )
          .join('\n\n'),
    );
  }

  return {
    citations: citations.slice(0, 6),
    concepts,
    contextPrompt: parts.join('\n\n'),
  };
}

function buildRetrievalFallbackAnswer(
  citations: AskCitation[],
  concepts: AskConceptRef[],
  lang: 'zh-Hant' | 'en',
): string {
  if (citations.length === 0 && concepts.length === 0) {
    return lang === 'zh-Hant'
      ? '在目前範圍內找不到直接相關的筆記段落或術語，可以試著切換到「整個知識庫」或換個關鍵字。'
      : 'No matching sections or concepts were found in the current scope. Try switching to Full Vault or rephrasing your query.';
  }

  const lines: string[] = [];
  if (concepts.length > 0) {
    lines.push(lang === 'zh-Hant' ? '**相關概念定義：**' : '**Related Concepts:**');
    for (const c of concepts.slice(0, 3)) {
      lines.push(`- **${c.label}**：${c.context}`);
    }
  }
  if (citations.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push(lang === 'zh-Hant' ? '**最相關的筆記段落：**' : '**Most Relevant Sections:**');
    for (const c of citations.slice(0, 4)) {
      const heading = c.sectionHeading ? ` § ${c.sectionHeading}` : '';
      lines.push(`- **${c.title}${heading}** — ${c.snippet}`);
    }
  }
  return lines.join('\n');
}

export async function askNexusVault(index: NexusIndex, req: AskRequest): Promise<AskResponse> {
  const lang = req.lang ?? 'zh-Hant';
  const { citations, concepts, contextPrompt } = buildGroundedContext(index, req);

  if (req.provider === 'retrieval') {
    return {
      answer: buildRetrievalFallbackAnswer(citations, concepts, lang),
      citations,
      concepts,
      providerUsed: 'retrieval',
      modelUsed: 'BM25 + Ontology',
    };
  }

  const systemPrompt =
    lang === 'zh-Hant'
      ? `你是 Nexus 個人知識庫的閱讀助手。請嚴格根據以下提供的「術語概念」與「筆記段落」回答使用者的問題，保持精簡清晰；若資料不足請明確說明，不要編造不存在於筆記中的事實。\n\n${contextPrompt || '(無檢索結果)'}`
      : `You are the Nexus personal knowledge base assistant. Answer the user's question concisely using the provided Ontology Concepts and Note Sections below. If the notes do not cover something, say so clearly.\n\n${contextPrompt || '(No retrieved context)'}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(req.history ?? []).slice(-6),
    { role: 'user', content: req.question },
  ];

  if (req.provider === 'ollama') {
    const baseUrl = (req.baseUrl?.trim() || 'http://localhost:11434').replace(/\/+$/, '');
    const model = req.model?.trim() || 'qwen2.5:7b';
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: false }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`Ollama error (${res.status}): ${errText.slice(0, 160)}`);
      }
      const data = (await res.json()) as { message?: { content?: string } };
      const content = data.message?.content?.trim();
      if (!content) throw new Error('Ollama returned an empty response');
      return {
        answer: content,
        citations,
        concepts,
        providerUsed: 'ollama',
        modelUsed: model,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return {
        answer: buildRetrievalFallbackAnswer(citations, concepts, lang),
        citations,
        concepts,
        providerUsed: 'retrieval',
        modelUsed: 'BM25 + Ontology (fallback)',
        warning:
          lang === 'zh-Hant'
            ? `無法連線至 Ollama（${reason}），已自動切換為離線檢索結果。`
            : `Could not reach Ollama (${reason}); fell back to offline retrieval.`,
      };
    }
  }

  // OpenAI-compatible API
  const baseUrl = (req.baseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = req.model?.trim() || 'gpt-4o-mini';
  const apiKey = req.apiKey?.trim() || process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    return {
      answer: buildRetrievalFallbackAnswer(citations, concepts, lang),
      citations,
      concepts,
      providerUsed: 'retrieval',
      modelUsed: 'BM25 + Ontology (fallback)',
      warning:
        lang === 'zh-Hant'
          ? '尚未填寫 API Key，已改用離線檢索結果。'
          : 'No API key configured; fell back to offline retrieval.',
    };
  }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`API error (${res.status}): ${errText.slice(0, 160)}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('LLM API returned an empty response');
    return {
      answer: content,
      citations,
      concepts,
      providerUsed: 'openai',
      modelUsed: model,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      answer: buildRetrievalFallbackAnswer(citations, concepts, lang),
      citations,
      concepts,
      providerUsed: 'retrieval',
      modelUsed: 'BM25 + Ontology (fallback)',
      warning:
        lang === 'zh-Hant'
          ? `呼叫 API 失敗（${reason}），已自動切換為離線檢索結果。`
          : `API call failed (${reason}); fell back to offline retrieval.`,
    };
  }
}
