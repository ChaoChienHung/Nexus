import type { AskRequest, AskResponse } from '../server/ask';
import type {
  DocReviewStatus,
  NexusCapabilities,
  NexusIndex,
  SentenceComment,
  VaultOption,
} from '../server/types';

export async function fetchIndex(): Promise<NexusIndex> {
  const res = await fetch('/api/index');
  if (!res.ok) throw new Error(`Failed to load index: ${res.statusText}`);
  return res.json() as Promise<NexusIndex>;
}

export async function fetchCapabilities(): Promise<NexusCapabilities> {
  const res = await fetch('/api/capabilities');
  if (!res.ok) throw new Error(`Failed to load capabilities: ${res.statusText}`);
  return res.json() as Promise<NexusCapabilities>;
}

export async function syncVaultToMentorion(onlyFresh = true): Promise<{
  ok: boolean;
  created: number;
  updated: number;
  total: number;
  failed_count?: number;
  failed?: Array<{ path: string; reason: string }>;
}> {
  const res = await fetch('/api/integrations/mentorion/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ only_fresh: onlyFresh }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.detail || 'Failed to sync to Mentorion');
  }
  return res.json();
}

export interface MentorionGraphQuizResponse {
  doc_id: string;
  title: string;
  related_concepts_used: Array<{ label: string; relation: string; summary: string }>;
  questions: Array<{
    id?: string;
    type: string;
    prompt: string;
    explanation?: string;
  }>;
}

export async function generateMentorionGraphQuiz(
  docId: string,
  language: 'zh-Hant' | 'en',
  count = 3,
): Promise<MentorionGraphQuizResponse> {
  const res = await fetch('/api/integrations/mentorion/graph-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc_id: docId, language, count }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.detail || 'Failed to generate graph-aware quiz');
  }
  return res.json() as Promise<MentorionGraphQuizResponse>;
}

export interface MentorionReviewRecordPayload {
  source_doc_id: string;
  file_path?: string;
  mode: 'sm2' | 'custom_date';
  rating?: number;
  next_review_date?: string;
}

export interface MentorionReviewRecordResponse {
  ok: boolean;
  scheduled: boolean;
  note_id: number | null;
  source_doc_id: string;
  mode: 'sm2' | 'custom_date' | 'practice';
  rating: number;
  last_reviewed_at: string;
  next_review_date: string | null;
  interval_days: number | null;
  ease_factor: number | null;
  repetitions: number | null;
}

export interface MentorionTrackedSource {
  note_id: number;
  source_doc_id: string | null;
  file_path: string | null;
  has_pending_task: boolean;
  next_review_date: string | null;
}

export async function fetchMentorionTrackedSources(): Promise<MentorionTrackedSource[]> {
  const res = await fetch('/api/integrations/mentorion/api/review/tracked-sources');
  if (!res.ok) return [];
  return res.json() as Promise<MentorionTrackedSource[]>;
}

export async function recordMentorionReview(
  payload: MentorionReviewRecordPayload,
): Promise<MentorionReviewRecordResponse> {
  const res = await fetch('/api/integrations/mentorion/api/review/record-by-source', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.detail || 'Failed to record review in Mentorion');
  }
  return res.json() as Promise<MentorionReviewRecordResponse>;
}

export async function saveDocumentMarkdown(
  docId: string,
  rawMarkdown: string,
): Promise<NexusIndex> {
  const res = await fetch(`/api/docs/${encodeURIComponent(docId)}/markdown`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawMarkdown }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to save markdown');
  }
  const data = (await res.json()) as { index: NexusIndex };
  return data.index;
}

export async function saveDocumentNotes(
  docId: string,
  notes: string,
): Promise<NexusIndex> {
  const res = await fetch(`/api/docs/${encodeURIComponent(docId)}/notes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to save notes');
  }
  const data = (await res.json()) as { index: NexusIndex };
  return data.index;
}

export async function updateDocumentReview(
  docId: string,
  review: DocReviewStatus,
  skipMentorionSync = false,
): Promise<NexusIndex> {
  const res = await fetch(`/api/docs/${encodeURIComponent(docId)}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review, skipMentorionSync }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to update review status');
  }
  const data = (await res.json()) as { index: NexusIndex };
  return data.index;
}

export async function addSentenceComment(
  docId: string,
  payload: { quote: string; prefix: string; suffix: string; body: string },
): Promise<{ comment: SentenceComment; index: NexusIndex }> {
  const res = await fetch(`/api/docs/${encodeURIComponent(docId)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to add comment');
  }
  return res.json() as Promise<{ comment: SentenceComment; index: NexusIndex }>;
}

export async function updateSentenceComment(
  docId: string,
  commentId: string,
  payload: { body?: string; resolved?: boolean },
): Promise<NexusIndex> {
  const res = await fetch(
    `/api/docs/${encodeURIComponent(docId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to update comment');
  }
  const data = (await res.json()) as { index: NexusIndex };
  return data.index;
}

export async function deleteSentenceComment(
  docId: string,
  commentId: string,
): Promise<NexusIndex> {
  const res = await fetch(
    `/api/docs/${encodeURIComponent(docId)}/comments/${encodeURIComponent(commentId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to delete comment');
  }
  const data = (await res.json()) as { index: NexusIndex };
  return data.index;
}

export async function uploadRawFile(payload: {
  filename: string;
  subfolder?: string;
  contentBase64: string;
}): Promise<{ ok: boolean; relPath: string; index: NexusIndex }> {
  const res = await fetch('/api/raw/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to upload raw file');
  }
  return res.json() as Promise<{ ok: boolean; relPath: string; index: NexusIndex }>;
}

export async function deleteRawFile(relPath: string): Promise<NexusIndex> {
  const encoded = relPath
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');
  const res = await fetch(`/api/raw/${encoded}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to delete raw file');
  }
  const data = (await res.json()) as { index: NexusIndex };
  return data.index;
}

export interface VaultListResponse {
  activePath: string;
  activeLabel: string;
  vaults: VaultOption[];
}

export async function fetchVaults(): Promise<VaultListResponse> {
  const res = await fetch('/api/vaults');
  if (!res.ok) throw new Error(`Failed to list vaults: ${res.statusText}`);
  return res.json() as Promise<VaultListResponse>;
}

export async function switchVault(
  vaultPath: string,
  label?: string,
): Promise<VaultListResponse & { ok: boolean; index: NexusIndex }> {
  const res = await fetch('/api/vaults/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: vaultPath, label }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to switch vault');
  }
  return res.json() as Promise<VaultListResponse & { ok: boolean; index: NexusIndex }>;
}

export async function fetchOllamaModels(baseUrl?: string): Promise<string[]> {
  const qs = baseUrl ? `?baseUrl=${encodeURIComponent(baseUrl)}` : '';
  const res = await fetch(`/api/ask/models${qs}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { models?: string[] };
  return data.models ?? [];
}

export async function askVault(payload: AskRequest): Promise<AskResponse> {
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to query vault');
  }
  return res.json() as Promise<AskResponse>;
}
