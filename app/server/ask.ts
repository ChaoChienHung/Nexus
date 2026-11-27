import { searchNexus, searchSections } from './query';
import type { NexusIndex } from './types';

export type AskProvider = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'retrieval';
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

export interface AskCitedQuestion {
  id: string;
  docId: string;
  docTitle: string;
  quote: string;
  question: string;
}

export interface AskRequest {
  question: string;
  citedItems?: AskCitedQuestion[];
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

export function formatUserAskMessage(
  question: string,
  citedItems?: AskCitedQuestion[],
  lang: 'zh-Hant' | 'en' = 'zh-Hant',
): string {
  const blocks: string[] = [];
  const validCites = (citedItems ?? []).filter((c) => c.quote.trim().length > 0);

  if (validCites.length > 0) {
    validCites.forEach((c, idx) => {
      const header =
        lang === 'zh-Hant'
          ? `[引用 ${idx + 1}｜${c.docTitle}]`
          : `[Citation ${idx + 1} | ${c.docTitle}]`;
      const lines = [`> ${header} "${c.quote.trim()}"`];
      if (c.question.trim()) {
        lines.push(
          lang === 'zh-Hant'
            ? `針對此引用的問題：${c.question.trim()}`
            : `Question for this citation: ${c.question.trim()}`,
        );
      }
      blocks.push(lines.join('\n'));
    });
  }

  if (question.trim()) {
    blocks.push(question.trim());
  }

  return blocks.join('\n\n');
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

  const citedItems = (req.citedItems ?? []).filter((c) => c.quote.trim().length > 0);
  const retrievalQuery = [
    req.question.trim(),
    ...citedItems.flatMap((c) => [c.question.trim(), c.quote.trim()]),
  ]
    .filter(Boolean)
    .join(' ');

  const sectionHits = searchSections(index, retrievalQuery, {
    limit: 6,
    category,
    docId,
  });

  const searchRes = searchNexus(index, retrievalQuery, {
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
  if (citedItems.length > 0) {
    parts.push(
      '### User-Cited Passages\n' +
        citedItems
          .map(
            (c, i) =>
              `[C${i + 1}] ${c.docTitle} (${c.docId})\n> ${c.quote.trim()}${c.question.trim() ? `\nQuestion: ${c.question.trim()}` : ''}`,
          )
          .join('\n\n'),
    );
  }
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

  const userContent = formatUserAskMessage(req.question, req.citedItems, lang);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(req.history ?? []).slice(-20),
    { role: 'user', content: userContent },
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

  if (req.provider === 'anthropic' || req.provider === 'gemini') {
    const provider = req.provider;
    const baseUrl = (req.baseUrl?.trim() || (provider === 'anthropic'
      ? 'https://api.anthropic.com/v1' : 'https://generativelanguage.googleapis.com/v1beta')).replace(/\/+$/, '');
    const model = req.model?.trim() || (provider === 'anthropic' ? 'claude-sonnet-4-5' : 'gemini-2.5-flash');
    const apiKey = req.apiKey?.trim() || '';
    try {
      if (!apiKey) throw new Error('API key is required');
      const turns = [...(req.history ?? []).slice(-20), { role: 'user' as const, content: userContent }];
      const isAnthropic = provider === 'anthropic';
      const url = isAnthropic ? `${baseUrl}/messages` : `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: isAnthropic
          ? { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
          : { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(isAnthropic
          ? { model, max_tokens: 2048, system: systemPrompt, messages: turns }
          : { systemInstruction: { parts: [{ text: systemPrompt }] }, contents: turns.map((turn) => ({ role: turn.role === 'assistant' ? 'model' : 'user', parts: [{ text: turn.content }] })) }),
      });
      if (!res.ok) throw new Error(`API error (${res.status})`);
      const data = await res.json() as {
        content?: Array<{ type?: string; text?: string }>;
        candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
      };
      const content = (isAnthropic
        ? (data.content ?? []).filter((part) => part.type === 'text').map((part) => part.text ?? '').join('')
        : (data.candidates?.[0]?.content?.parts ?? []).filter((part) => !part.thought).map((part) => part.text ?? '').join('')).trim();
      if (!content) throw new Error('LLM API returned an empty response');
      return { answer: content, citations, concepts, providerUsed: provider, modelUsed: model };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return {
        answer: buildRetrievalFallbackAnswer(citations, concepts, lang), citations, concepts,
        providerUsed: 'retrieval', modelUsed: 'BM25 + Ontology (fallback)',
        warning: lang === 'zh-Hant' ? `呼叫 API 失敗（${reason}），已自動切換為離線檢索結果。` : `API call failed (${reason}); fell back to offline retrieval.`,
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
