# Handoff

## Snapshot

- Updated: 2026-11-21. Workspace: `/Users/ludwigchao/Desktop/Ludwig/Projects/Nexus` (`main` branch).
- Stopping point: Polished Reader topbar breadcrumbs (fixed `max-width: 140px` per category segment with `...` ellipsis, tooltips, and non-wrapping `編輯` button), added borderlines to Copy/Download Markdown buttons in the right sidebar, tightened BM25 `Top Related Documents` relevance thresholds (`app/server/ranking.ts` + regression tests + architecture doc) so unrelated notes never pad to 3, and recorded the Knowledge Graph scaling roadmap in `TODO.md`.
- Working tree: Clean after verification, commit, and push to `origin/main` (`npm test` 13/13, `npm run typecheck`, `npm run index`, `npm run build` all passed).

## In-progress work

No active in-progress tasks remain. Completed deliverables are tracked in `REVIEW.md`.

## Suggested next steps

1. Drop raw materials (PDFs, transcripts, clippings) into `Nexus-Vault/raw/` and test compiling them into `Nexus-Vault/wiki/` + `data/ontology/concepts.json`.
2. Decide exact conventions for `outputs/` (e.g., whether AI batch-processing summaries of resolved `comments.json` / `## 備註` and health-check logs should live there, and whether the Reader UI should filter resolved comments).
3. Pick next engine enhancements in `Nexus` from `TODO.md` (e.g., creating new Documents/Concepts from UI, static GitHub Pages export, inline Terminology hover-cards).
