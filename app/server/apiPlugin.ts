import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { askNexusVault, listOllamaModels, type AskRequest } from './ask';
import { resolveVaultOptions, saveCustomVault } from './config';
import { buildNexusIndex } from './indexer';
import { probeMentorion, resolveLiveMentorionEndpoints } from './integrations/mentorion';
import { updateDocumentReviewStatus, updateNotesSection } from './markdown';
import type { CommentsFile, DocReviewStatus, NexusCapabilities, SentenceComment } from './types';

export interface NexusApiPluginOptions {
  appDir?: string;
  knowledgeDir: string;
  knowledgeSource?: 'env' | 'dotenv' | 'default';
  mentorionApiUrl?: string | null;
  mentorionAppUrl?: string | null;
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
    '.md': 'text/markdown; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
  };
  return map[ext] ?? 'application/octet-stream';
}

function sanitizeRawSegment(segment: string): string {
  return segment
    .replace(/[/\\]/g, '')
    .replace(/\.\./g, '')
    .replace(/[\x00-\x1f]/g, '')
    .trim();
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
  const {
    appDir = process.cwd(),
    mentorionApiUrl = null,
    mentorionAppUrl = null,
  } = options;

  let activeKnowledgeDir = options.knowledgeDir;
  let activeKnowledgeSource: 'env' | 'dotenv' | 'default' | 'runtime' =
    options.knowledgeSource ?? 'default';

  let lastAutoSyncAt = 0;

  function triggerBackgroundAutoSync(liveApiUrl: string | null, force = false) {
    if (!liveApiUrl) return;
    const now = Date.now();
    if (!force && now - lastAutoSyncAt < 15_000) return;
    lastAutoSyncAt = now;
    fetch(`${liveApiUrl}/api/schema-sync/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_dir: activeKnowledgeDir,
        filename_pattern: 'index.md',
        only_fresh: true,
      }),
    }).catch(() => {});
  }

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
          const liveMentorion = resolveLiveMentorionEndpoints(
            mentorionApiUrl,
            mentorionAppUrl,
          );

          // GET /api/capabilities
          if (req.method === 'GET' && pathname === '/api/capabilities') {
            const mentorion = await probeMentorion(liveMentorion.apiUrl);
            if (mentorion.online) {
              triggerBackgroundAutoSync(mentorion.apiUrl);
            }
            const capabilities: NexusCapabilities = {
              vault: {
                source: activeKnowledgeSource,
                path: activeKnowledgeDir,
                label: path.basename(activeKnowledgeDir),
              },
              mentorion: {
                ...mentorion,
                appUrl: mentorion.configured ? liveMentorion.appUrl : null,
              },
            };
            return sendJson(res, 200, capabilities);
          }

          // GET /api/vaults — list available vaults
          if (req.method === 'GET' && pathname === '/api/vaults') {
            const vaults = resolveVaultOptions(appDir, activeKnowledgeDir);
            const active = vaults.find((v) => v.path === activeKnowledgeDir);
            return sendJson(res, 200, {
              activePath: activeKnowledgeDir,
              activeLabel: active?.label ?? path.basename(activeKnowledgeDir),
              vaults,
            });
          }

          // POST /api/vaults/switch — switch active vault at runtime
          if (req.method === 'POST' && pathname === '/api/vaults/switch') {
            const payload = JSON.parse(await readBody(req)) as {
              path?: string;
              label?: string;
            };
            if (!payload.path?.trim()) {
              return sendJson(res, 400, { error: 'Vault path is required' });
            }
            const resolvedTarget = path.resolve(
              appDir,
              payload.path.trim().replace(/^~(?=\/|$)/, process.env.HOME ?? ''),
            );
            if (!fs.existsSync(resolvedTarget) || !fs.statSync(resolvedTarget).isDirectory()) {
              return sendJson(res, 404, { error: `Vault directory not found: ${resolvedTarget}` });
            }

            const defaultDemoDir = path.resolve(appDir, '../knowledge');
            if (resolvedTarget !== defaultDemoDir) {
              saveCustomVault(appDir, resolvedTarget, payload.label);
            }
            activeKnowledgeDir = resolvedTarget;
            activeKnowledgeSource = resolvedTarget === defaultDemoDir ? 'default' : 'runtime';

            const index = buildNexusIndex(activeKnowledgeDir, { includeDrafts: true });
            const vaults = resolveVaultOptions(appDir, activeKnowledgeDir);
            const active = vaults.find((v) => v.path === activeKnowledgeDir);
            return sendJson(res, 200, {
              ok: true,
              activePath: activeKnowledgeDir,
              activeLabel: active?.label ?? path.basename(activeKnowledgeDir),
              vaults,
              index,
            });
          }

          // GET /api/ask/models — auto-discover installed Ollama models
          if (req.method === 'GET' && pathname === '/api/ask/models') {
            const baseUrl = urlObj.searchParams.get('baseUrl') || 'http://localhost:11434';
            const models = await listOllamaModels(baseUrl);
            return sendJson(res, 200, { models });
          }

          // POST /api/ask — Ask Vault Q&A grounded in query.ts + Ontology
          if (req.method === 'POST' && pathname === '/api/ask') {
            const payload = JSON.parse(await readBody(req)) as Partial<AskRequest>;
            if (!payload.question?.trim()) {
              return sendJson(res, 400, { error: 'question is required' });
            }
            const index = buildNexusIndex(activeKnowledgeDir, { includeDrafts: true });
            const result = await askNexusVault(index, {
              question: payload.question.trim(),
              scope: payload.scope ?? 'vault',
              docId: payload.docId,
              category: payload.category,
              provider: payload.provider ?? 'retrieval',
              baseUrl: payload.baseUrl,
              apiKey: payload.apiKey,
              model: payload.model,
              lang: payload.lang,
              history: payload.history,
            });
            return sendJson(res, 200, result);
          }

          // POST /api/raw/upload — save a dropped raw file into <vault>/raw/
          if (req.method === 'POST' && pathname === '/api/raw/upload') {
            const payload = JSON.parse(await readBody(req)) as {
              filename?: string;
              subfolder?: string;
              contentBase64?: string;
            };
            const safeName = sanitizeRawSegment(payload.filename ?? '');
            if (!safeName || typeof payload.contentBase64 !== 'string') {
              return sendJson(res, 400, { error: 'filename and contentBase64 are required' });
            }
            const rawRoot = path.resolve(activeKnowledgeDir, 'raw');
            const subParts = (payload.subfolder ?? '')
              .split(/[/\\]+/)
              .map(sanitizeRawSegment)
              .filter(Boolean);
            const targetDir = path.resolve(rawRoot, ...subParts);
            if (targetDir !== rawRoot && !targetDir.startsWith(rawRoot + path.sep)) {
              return sendJson(res, 400, { error: 'Invalid subfolder path' });
            }
            const targetPath = path.resolve(targetDir, safeName);
            if (!targetPath.startsWith(rawRoot + path.sep)) {
              return sendJson(res, 400, { error: 'Invalid filename' });
            }
            fs.mkdirSync(targetDir, { recursive: true });
            const buffer = Buffer.from(payload.contentBase64, 'base64');
            fs.writeFileSync(targetPath, buffer);

            const relPath = path.relative(rawRoot, targetPath).replace(/\\/g, '/');
            const index = buildNexusIndex(activeKnowledgeDir, { includeDrafts: true });
            return sendJson(res, 201, { ok: true, relPath, index });
          }

          // GET or DELETE /api/raw/* — stream or remove a file in <vault>/raw/
          const rawFileMatch = pathname.match(/^\/api\/raw\/(.+)$/);
          if (rawFileMatch && (req.method === 'GET' || req.method === 'DELETE')) {
            const rawRel = decodeURIComponent(rawFileMatch[1]);
            const rawRoot = path.resolve(activeKnowledgeDir, 'raw');
            const filePath = path.resolve(rawRoot, rawRel);
            if (!filePath.startsWith(rawRoot + path.sep) || !fs.existsSync(filePath)) {
              return sendJson(res, 404, { error: 'Raw file not found' });
            }
            if (req.method === 'DELETE') {
              fs.unlinkSync(filePath);
              const index = buildNexusIndex(activeKnowledgeDir, { includeDrafts: true });
              return sendJson(res, 200, { ok: true, index });
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', getMimeType(filePath));
            fs.createReadStream(filePath).pipe(res);
            return;
          }

          // POST /api/integrations/mentorion/sync — sync current Nexus vault into Mentorion
          if (req.method === 'POST' && pathname === '/api/integrations/mentorion/sync') {
            if (!liveMentorion.apiUrl) {
              return sendJson(res, 503, { error: 'Mentorion integration is not configured' });
            }
            const rawBody = await readBody(req);
            const bodyObj = rawBody ? (JSON.parse(rawBody) as { only_fresh?: boolean }) : {};
            const upstream = await fetch(`${liveMentorion.apiUrl}/api/schema-sync/import`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source_dir: activeKnowledgeDir,
                filename_pattern: 'index.md',
                only_fresh: bodyObj.only_fresh ?? true,
              }),
            });
            const text = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(text);
            return;
          }

          // POST /api/integrations/mentorion/graph-quiz — one-way composition:
          // Nexus gathers 1-hop Ontology neighbor concepts and forwards them to Mentorion's optional related_concepts slot
          if (req.method === 'POST' && pathname === '/api/integrations/mentorion/graph-quiz') {
            if (!liveMentorion.apiUrl) {
              return sendJson(res, 503, { error: 'Mentorion integration is not configured' });
            }
            const rawBody = await readBody(req);
            const bodyObj = rawBody
              ? (JSON.parse(rawBody) as { doc_id?: string; count?: number; language?: string })
              : {};
            const docId = (bodyObj.doc_id || '').trim();
            if (!docId) {
              return sendJson(res, 400, { error: 'doc_id is required' });
            }

            const index = buildNexusIndex(activeKnowledgeDir, { includeDrafts: true });
            const doc = index.documents.find((d) => d.id === docId);
            if (!doc) {
              return sendJson(res, 404, { error: `Document not found: ${docId}` });
            }

            const conceptById = new Map(index.concepts.map((c) => [c.concept_id, c]));
            const langKey: 'zh-Hant' | 'en' = bodyObj.language === 'en' ? 'en' : 'zh-Hant';
            const seedConceptIds = new Set([...doc.concepts, ...doc.mentionedConcepts]);

            const relatedConcepts: Array<{ label: string; relation: string; summary: string }> = [];
            const seenConceptIds = new Set<string>();

            const pushConcept = (cid: string, relation: string) => {
              if (seenConceptIds.has(cid) || relatedConcepts.length >= 8) return;
              const c = conceptById.get(cid);
              if (!c) return;
              seenConceptIds.add(cid);
              relatedConcepts.push({
                label: c.labels[langKey] || c.labels.en || c.concept_id,
                relation,
                summary: c.contexts[langKey] || c.contexts.en || '',
              });
            };

            // Collect 1-hop Ontology neighbors of the concepts explained/mentioned by this document
            for (const seedId of seedConceptIds) {
              const seed = conceptById.get(seedId);
              if (!seed) continue;
              for (const rel of seed.relations ?? []) {
                if (!seedConceptIds.has(rel.target)) {
                  pushConcept(rel.target, rel.type);
                }
              }
            }
            // Also check incoming relations pointing to seed concepts
            for (const c of index.concepts) {
              if (seedConceptIds.has(c.concept_id)) continue;
              for (const rel of c.relations ?? []) {
                if (seedConceptIds.has(rel.target)) {
                  pushConcept(c.concept_id, rel.type);
                }
              }
            }
            // Fallback: include mentioned concepts if no 1-hop external neighbors exist
            if (relatedConcepts.length === 0) {
              for (const cid of doc.mentionedConcepts) {
                pushConcept(cid, 'mentions');
              }
            }

            const upstream = await fetch(`${liveMentorion.apiUrl}/api/quiz/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source_doc_id: doc.id,
                title: doc.title,
                content: doc.body || doc.rawMarkdown,
                count: bodyObj.count ?? 3,
                language: langKey,
                related_concepts: relatedConcepts,
              }),
            });
            const upstreamText = await upstream.text();
            if (!upstream.ok) {
              res.statusCode = upstream.status;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(upstreamText);
              return;
            }
            const parsed = JSON.parse(upstreamText) as { questions?: unknown[] };
            return sendJson(res, 200, {
              doc_id: doc.id,
              title: doc.title,
              related_concepts_used: relatedConcepts,
              questions: parsed.questions ?? [],
            });
          }

          // Proxy /api/integrations/mentorion/* -> live Mentorion API
          const mentorionProxyMatch = pathname.match(/^\/api\/integrations\/mentorion(\/.*)?$/);
          if (mentorionProxyMatch) {
            if (!liveMentorion.apiUrl) {
              return sendJson(res, 503, { error: 'Mentorion integration is not configured' });
            }
            const subPath = mentorionProxyMatch[1] || '/';
            const targetUrl = `${liveMentorion.apiUrl}${subPath}${urlObj.search}`;
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
            const index = buildNexusIndex(activeKnowledgeDir, { includeDrafts: true });
            return sendJson(res, 200, index);
          }

          // PUT /api/docs/:docId/markdown
          const mdMatch = pathname.match(/^\/api\/docs\/([^/]+)\/markdown$/);
          if (req.method === 'PUT' && mdMatch) {
            const docId = decodeURIComponent(mdMatch[1]);
            const bundleDir = resolveDocBundleDir(activeKnowledgeDir, docId);
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

            const index = buildNexusIndex(activeKnowledgeDir, { includeDrafts: true });
            return sendJson(res, 200, { ok: true, index });
          }

          // PUT /api/docs/:docId/notes
          const notesMatch = pathname.match(/^\/api\/docs\/([^/]+)\/notes$/);
          if (req.method === 'PUT' && notesMatch) {
            const docId = decodeURIComponent(notesMatch[1]);
            const bundleDir = resolveDocBundleDir(activeKnowledgeDir, docId);
            if (!bundleDir) return sendJson(res, 404, { error: `Document not found: ${docId}` });

            const payload = JSON.parse(await readBody(req)) as { notes?: string };
            if (typeof payload.notes !== 'string') {
              return sendJson(res, 400, { error: 'notes string is required' });
            }

            const mdPath = path.join(bundleDir, 'index.md');
            const existingRaw = fs.readFileSync(mdPath, 'utf-8');
            const updatedRaw = updateNotesSection(existingRaw, payload.notes);
            fs.writeFileSync(mdPath, updatedRaw, 'utf-8');

            const index = buildNexusIndex(activeKnowledgeDir, { includeDrafts: true });
            return sendJson(res, 200, { ok: true, index });
          }

          // PATCH /api/docs/:docId/review
          const reviewMatch = pathname.match(/^\/api\/docs\/([^/]+)\/review$/);
          if (req.method === 'PATCH' && reviewMatch) {
            const docId = decodeURIComponent(reviewMatch[1]);
            const bundleDir = resolveDocBundleDir(activeKnowledgeDir, docId);
            if (!bundleDir) return sendJson(res, 404, { error: `Document not found: ${docId}` });

            const payload = JSON.parse(await readBody(req)) as { review?: unknown; skipMentorionSync?: boolean };
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

            // Best-effort sync to live Mentorion backend when review state changes
            if (!payload.skipMentorionSync && payload.review === 'reviewed' && liveMentorion.apiUrl) {
              fetch(`${liveMentorion.apiUrl}/api/schema-sync/mark-reviewed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_doc_id: docId, grade: 4, feedback: 'Reviewed in Nexus' }),
              }).catch(() => {});
            } else if (payload.review === 'fresh' && liveMentorion.apiUrl) {
              triggerBackgroundAutoSync(liveMentorion.apiUrl, true);
            }

            const index = buildNexusIndex(activeKnowledgeDir, { includeDrafts: true });
            return sendJson(res, 200, { ok: true, index });
          }

          // POST /api/docs/:docId/comments
          const commentsColMatch = pathname.match(/^\/api\/docs\/([^/]+)\/comments$/);
          if (req.method === 'POST' && commentsColMatch) {
            const docId = decodeURIComponent(commentsColMatch[1]);
            const bundleDir = resolveDocBundleDir(activeKnowledgeDir, docId);
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

            const index = buildNexusIndex(activeKnowledgeDir, { includeDrafts: true });
            return sendJson(res, 201, { ok: true, comment: newComment, index });
          }

          // PATCH or DELETE /api/docs/:docId/comments/:commentId
          const commentItemMatch = pathname.match(/^\/api\/docs\/([^/]+)\/comments\/([^/]+)$/);
          if (commentItemMatch && (req.method === 'PATCH' || req.method === 'DELETE')) {
            const docId = decodeURIComponent(commentItemMatch[1]);
            const commentId = decodeURIComponent(commentItemMatch[2]);
            const bundleDir = resolveDocBundleDir(activeKnowledgeDir, docId);
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
            const index = buildNexusIndex(activeKnowledgeDir, { includeDrafts: true });
            return sendJson(res, 200, { ok: true, index });
          }

          // GET /api/assets/:docId/*
          const assetMatch = pathname.match(/^\/api\/assets\/([^/]+)\/(.+)$/);
          if (req.method === 'GET' && assetMatch) {
            const docId = decodeURIComponent(assetMatch[1]);
            const assetRel = decodeURIComponent(assetMatch[2]);
            const bundleDir = resolveDocBundleDir(activeKnowledgeDir, docId);
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
