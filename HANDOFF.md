# Handoff

## Snapshot

- Updated: 2026-11-21. Workspace: `/Users/ludwigchao/Desktop/Ludwig/Projects/Nexus` (`main` branch, pushed to `origin`, along with sibling `Nexus-Vault`).
- Stopping point: Adopted Karpathy-inspired `raw/` → `wiki/` (compiled SSOT) + `data/ontology/concepts.json` → `outputs/` layout across both `Nexus` (engine, demo `knowledge/`, tests, docs) and `Nexus-Vault`. Renamed `notes/` → `wiki/`, added `raw/` and `outputs/` staging folders, and updated both `AGENTS.md` files with Nexus-native AI compilation, reading-annotation batch processing (`## 備註` + `comments.json`), and periodic health-check workflows.
- Working tree: Clean after verification, commit, and push to `origin/main` in both `Nexus` and `Nexus-Vault`.

## In-progress work

No active in-progress tasks remain. Completed deliverables are tracked in `REVIEW.md`.

## Suggested next steps

1. Drop raw materials (PDFs, transcripts, clippings) into `Nexus-Vault/raw/` and test compiling them into `Nexus-Vault/wiki/` + `data/ontology/concepts.json`.
2. Decide exact conventions for `outputs/` (e.g., whether AI batch-processing summaries of resolved `comments.json` / `## 備註` and health-check logs should live there, and whether the Reader UI should filter resolved comments).
3. Pick next engine enhancements in `Nexus` from `TODO.md` (e.g., creating new Documents/Concepts from UI, static GitHub Pages export, inline Terminology hover-cards).
