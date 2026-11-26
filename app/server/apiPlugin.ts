import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { buildNexusIndex } from './indexer';
import { probeMentorion } from './integrations/mentorion';
import { updateDocumentReviewStatus, updateNotesSection } from './markdown';
import type { CommentsFile, DocReviewStatus, NexusCapabilities, SentenceComment } from './types';

export interface NexusApiPluginOptions {
  knowledgeDir: string;
  knowledgeSource?: 'env' | 'dotenv' | 'default';
  mentorionApiUrl?: string | null;
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
  };
  return map[ext] ?? 'application/octet-stream';
}

function resolveDocBundleDir(knowledgeDir: string, docId: string): string | null {
  const index = buildNexusIndex(knowledgeDir, { includeDrafts: true });
  const doc = index.documents.find((d) => d.id === docId);
  if (!doc) return null;

  const wikiRoot = path.resolve(knowledgeDir, 'wiki');
  const bundleDir = path.resolve(wikiRoot, doc.bundleRelPath);
  if (!bundleDir.startsWith(wikiRoot + path.sep)) {
    return null;
  }
  return bundleDir;
}

function nowIsoLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absOff = Math.abs(offsetMin);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(absOff / 60))}:${pad(absOff % 60)}`;
}

export function nexusApiPlugin(options: NexusApiPluginOptions): Plugin {
  const { knowledgeDir, knowledgeSource = 'default', mentorionApiUrl = null } = options;

  return {
    name: 'nexus-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlObj = new URL(req.url ?? '/', 'http://localhost');
        const pathname = urlObj.pathname;

        if (!pathname.startsWith('/api/')) {
          return next();
        }

        try {
          // GET /api/capabilities
          if (req.method === 'GET' && pathname === '/api/capabilities') {
            const mentorion = await probeMentorion(mentorionApiUrl);
            const capabilities: NexusCapabilities = {
              vault: { source: knowledgeSource },
              mentorion,
            };
            return sendJson(res, 200, capabilities);
          }

          // Proxy /api/integrations/mentorion/* -> configured Mentorion API
          const mentorionProxyMatch = pathname.match(/^\/api\/integrations\/mentorion(\/.*)?$/);
          if (mentorionProxyMatch) {
            if (!mentorionApiUrl) {
              return sendJson(res, 503, { error: 'Mentorion integration is not configured' });
            }
            const subPath = mentorionProxyMatch[1] || '/';
            const targetUrl = `${mentorionApiUrl}${subPath}${urlObj.search}`;
            const method = req.method ?? 'GET';
            const body =
              method !== 'GET' && method !== 'HEAD' ? await readBody(req) : undefined;
            const upstreamHeaders: Record<string, string> = {};
            if (req.headers['content-type']) {
              upstreamHeaders['Content-Type'] = String(req.headers['content-type']);
            }
            if (req.headers.authorization) {
              upstreamHeaders.Authorization = String(req.headers.authorization);
            }

            const upstream = await fetch(targetUrl, {
              method,
              headers: upstreamHeaders,
              body,
            });
            const text = await upstream.text();
            res.statusCode = upstream.status;
            const contentType = upstream.headers.get('content-type');
            if (contentType) res.setHeader('Content-Type', contentType);
            res.end(text);
            return;
          }

          // GET /api/index
          if (req.method === 'GET' && pathname === '/api/index') {
            const index = buildNexusIndex(knowledgeDir, { includeDrafts: true });
            return sendJson(res, 200, index);
          }

          // PUT /api/docs/:docId/markdown
          const mdMatch = pathname.match(/^\/api\/docs\/([^/]+)\/markdown$/);
          if (req.method === 'PUT' && mdMatch) {
            const docId = decodeURIComponent(mdMatch[1]);
            const bundleDir = resolveDocBundleDir(knowledgeDir, docId);
            if (!bundleDir) return sendJson(res, 404, { error: `Document not found: ${docId}` });

            const payload = JSON.parse(await readBody(req)) as { rawMarkdown?: string };
            if (typeof payload.rawMarkdown !== 'string') {
              return sendJson(res, 400, { error: 'rawMarkdown string is required' });
            }

            const mdPath = path.join(bundleDir, 'index.md');
            const normalized = payload.rawMarkdown.endsWith('\n')
              ? payload.rawMarkdown
              : `${payload.rawMarkdown}\n`;
            fs.writeFileSync(mdPath, normalized, 'utf-8');

            const index = buildNexusIndex(knowledgeDir, { includeDrafts: true });
            return sendJson(res, 200, { ok: true, index });
          }

          // PUT /api/docs/:docId/notes
          const notesMatch = pathname.match(/^\/api\/docs\/([^/]+)\/notes$/);
          if (req.method === 'PUT' && notesMatch) {
            const docId = decodeURIComponent(notesMatch[1]);
            const bundleDir = resolveDocBundleDir(knowledgeDir, docId);
            if (!bundleDir) return sendJson(res, 404, { error: `Document not found: ${docId}` });

            const payload = JSON.parse(await readBody(req)) as { notes?: string };
            if (typeof payload.notes !== 'string') {
              return sendJson(res, 400, { error: 'notes string is required' });
            }

            const mdPath = path.join(bundleDir, 'index.md');
            const existingRaw = fs.readFileSync(mdPath, 'utf-8');
            const updatedRaw = updateNotesSection(existingRaw, payload.notes);
            fs.writeFileSync(mdPath, updatedRaw, 'utf-8');

            const index = buildNexusIndex(knowledgeDir, { includeDrafts: true });
            return sendJson(res, 200, { ok: true, index });
          }

          // PATCH /api/docs/:docId/review
          const reviewMatch = pathname.match(/^\/api\/docs\/([^/]+)\/review$/);
          if (req.method === 'PATCH' && reviewMatch) {
            const docId = decodeURIComponent(reviewMatch[1]);
            const bundleDir = resolveDocBundleDir(knowledgeDir, docId);
            if (!bundleDir) return sendJson(res, 404, { error: `Document not found: ${docId}` });

            const payload = JSON.parse(await readBody(req)) as { review?: unknown };
            if (payload.review !== 'fresh' && payload.review !== 'reviewed') {
              return sendJson(res, 400, { error: 'review must be "fresh" or "reviewed"' });
            }

            const mdPath = path.join(bundleDir, 'index.md');
            const existingRaw = fs.readFileSync(mdPath, 'utf-8');
            const updatedRaw = updateDocumentReviewStatus(
              existingRaw,
              payload.review as DocReviewStatus,
            );
            fs.writeFileSync(mdPath, updatedRaw, 'utf-8');

            const index = buildNexusIndex(knowledgeDir, { includeDrafts: true });
            return sendJson(res, 200, { ok: true, index });
          }

          // POST /api/docs/:docId/comments
          const commentsColMatch = pathname.match(/^\/api\/docs\/([^/]+)\/comments$/);
          if (req.method === 'POST' && commentsColMatch) {
            const docId = decodeURIComponent(commentsColMatch[1]);
            const bundleDir = resolveDocBundleDir(knowledgeDir, docId);
            if (!bundleDir) return sendJson(res, 404, { error: `Document not found: ${docId}` });

            const payload = JSON.parse(await readBody(req)) as {
              quote?: string;
              prefix?: string;
              suffix?: string;
              body?: string;
            };
            if (!payload.quote?.trim() || !payload.body?.trim()) {
              return sendJson(res, 400, { error: 'quote and body are required' });
            }

            const commentsPath = path.join(bundleDir, 'comments.json');
            let fileData: CommentsFile = { version: 1, doc_id: docId, comments: [] };
            if (fs.existsSync(commentsPath)) {
              fileData = JSON.parse(fs.readFileSync(commentsPath, 'utf-8')) as CommentsFile;
            }

            const now = nowIsoLocal();
            const dateCompact = now.slice(0, 10).replace(/-/g, '');
            const seq = String(fileData.comments.length + 1).padStart(2, '0');
            const newComment: SentenceComment = {
              id: `cmt_${dateCompact}_${seq}_${Math.random().toString(36).slice(2, 6)}`,
              quote: payload.quote.trim(),
              prefix: payload.prefix ?? '',
              suffix: payload.suffix ?? '',
              body: payload.body.trim(),
              resolved: false,
              created_at: now,
              updated_at: now,
            };

            fileData.comments.push(newComment);
            fs.writeFileSync(commentsPath, `${JSON.stringify(fileData, null, 2)}\n`, 'utf-8');

            const index = buildNexusIndex(knowledgeDir, { includeDrafts: true });
            return sendJson(res, 201, { ok: true, comment: newComment, index });
          }

          // PATCH or DELETE /api/docs/:docId/comments/:commentId
          const commentItemMatch = pathname.match(/^\/api\/docs\/([^/]+)\/comments\/([^/]+)$/);
          if (commentItemMatch && (req.method === 'PATCH' || req.method === 'DELETE')) {
            const docId = decodeURIComponent(commentItemMatch[1]);
            const commentId = decodeURIComponent(commentItemMatch[2]);
            const bundleDir = resolveDocBundleDir(knowledgeDir, docId);
            if (!bundleDir) return sendJson(res, 404, { error: `Document not found: ${docId}` });

            const commentsPath = path.join(bundleDir, 'comments.json');
            if (!fs.existsSync(commentsPath)) {
              return sendJson(res, 404, { error: 'comments.json not found' });
            }

            const fileData = JSON.parse(fs.readFileSync(commentsPath, 'utf-8')) as CommentsFile;
            const idx = fileData.comments.findIndex((c) => c.id === commentId);
            if (idx === -1) {
              return sendJson(res, 404, { error: `Comment not found: ${commentId}` });
            }

            if (req.method === 'DELETE') {
              fileData.comments.splice(idx, 1);
            } else {
              const payload = JSON.parse(await readBody(req)) as {
                body?: string;
                resolved?: boolean;
              };
              const target = fileData.comments[idx];
              if (typeof payload.body === 'string') target.body = payload.body.trim();
              if (typeof payload.resolved === 'boolean') target.resolved = payload.resolved;
              target.updated_at = nowIsoLocal();
            }

            fs.writeFileSync(commentsPath, `${JSON.stringify(fileData, null, 2)}\n`, 'utf-8');
            const index = buildNexusIndex(knowledgeDir, { includeDrafts: true });
            return sendJson(res, 200, { ok: true, index });
          }

          // GET /api/assets/:docId/*
          const assetMatch = pathname.match(/^\/api\/assets\/([^/]+)\/(.+)$/);
          if (req.method === 'GET' && assetMatch) {
            const docId = decodeURIComponent(assetMatch[1]);
            const assetRel = decodeURIComponent(assetMatch[2]);
            const bundleDir = resolveDocBundleDir(knowledgeDir, docId);
            if (!bundleDir) return sendJson(res, 404, { error: 'Document not found' });

            const assetPath = path.resolve(bundleDir, assetRel);
            if (!assetPath.startsWith(bundleDir + path.sep) || !fs.existsSync(assetPath)) {
              return sendJson(res, 404, { error: 'Asset not found' });
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', getMimeType(assetPath));
            fs.createReadStream(assetPath).pipe(res);
            return;
          }

          return sendJson(res, 404, { error: `Unknown API route: ${req.method} ${pathname}` });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return sendJson(res, 500, { error: message });
        }
      });
    },
  };
}
