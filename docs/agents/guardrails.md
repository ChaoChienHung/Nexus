# Agent Guardrails

This document complements [AGENTS.md](../../AGENTS.md) (which keeps session-entry invariants concise) by separating judgment-based soft rules from deterministic hard guardrails across any agent tool (Antigravity, Claude Code, Codex, Cursor, etc.).

## Soft Rules vs. Hard Guardrails

Keep tone, writing philosophy, and exploratory guidance in Markdown prose; enforce non-negotiable data schemas, private/public isolation, and build invariants with deterministic commands and tests rather than relying on prompt memory alone.

| Layer | Purpose | Where it lives in Nexus |
| --- | --- | --- |
| **Soft Rules (Prose)** | Writing mindset, note quality, collaboration pacing, review checklists | `AGENTS.md`, `docs/guides/writing-philosophy.md`, `docs/guides/create-note.md` |
| **Hard Guardrails (Deterministic)** | Catch TypeScript regressions, round-trip corruption, broken links, and private/public boundary leaks | `cd app && npm run typecheck`, `cd app && npm test`, `cd app && npm run index`, `cd app && npm run build`, `app/.env.local` (`NEXUS_KNOWLEDGE_DIR`) |

## Non-Negotiable Boundaries

- **Public Engine vs. Private Vault**: Always check `app/.env.local` (`NEXUS_KNOWLEDGE_DIR`) before touching personal notes; never write private notes into `Nexus/knowledge/`.
- **`raw/` Is AI Read-Only**: Raw clippings, PDFs, and transcripts under `raw/` serve as provenance anchors and must never be edited or deleted by automated workflows.
- **SSOT Integrity**: Edit only `wiki/**/index.md`, `comments.json`, and `data/ontology/concepts.json`; never hand-edit `.generated/` outputs or maintain a parallel manual `INDEX.md`.
