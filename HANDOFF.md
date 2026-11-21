# Handoff

## Snapshot

- Updated: 2026-11-21. Workspace: `/Users/ludwigchao/Desktop/Ludwig/Projects/Nexus` (`main` branch).
- Stopping point: Styled Markdown and external links in `app/src/styles.css` to match the Editorial Minimal light/dark palette (`--accent` + soft underline + `↗` cue, `--doc-border` for `wiki-doc`) and updated `app/src/components/DocumentReader.tsx` so external `http(s)` links open in a new tab (`target="_blank" rel="noopener noreferrer"`).
- Working tree: Clean after verification, commit, and push to `origin/main` (`npm test` 13/13, `npm run typecheck`, `npm run index`, `npm run build` all passed).

## In-progress work

No active in-progress tasks remain. Completed deliverables are tracked in `REVIEW.md`.

## Suggested next steps

1. Drop raw materials (PDFs, transcripts, clippings) into `Nexus-Vault/raw/` and test compiling them into `Nexus-Vault/wiki/` + `data/ontology/concepts.json`.
2. Decide exact conventions for `outputs/` (e.g., whether AI batch-processing summaries of resolved `comments.json` / `## 備註` and health-check logs should live there, and whether the Reader UI should filter resolved comments).
3. Pick next engine enhancements in `Nexus` from `TODO.md` (e.g., creating new Documents/Concepts from UI, static GitHub Pages export, inline Terminology hover-cards).
