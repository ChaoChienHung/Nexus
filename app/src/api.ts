import type { DocReviewStatus, NexusIndex, SentenceComment } from '../server/types';

export async function fetchIndex(): Promise<NexusIndex> {
  const res = await fetch('/api/index');
  if (!res.ok) throw new Error(`Failed to load index: ${res.statusText}`);
  return res.json() as Promise<NexusIndex>;
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
): Promise<NexusIndex> {
  const res = await fetch(`/api/docs/${encodeURIComponent(docId)}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review }),
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
