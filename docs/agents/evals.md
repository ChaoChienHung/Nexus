# Agent Evals

Explicit acceptance criteria and verification gates for agent-driven edits and knowledge workflows in Nexus. Every automated or batch workflow must define how its output is graded before running unattended.

## Baseline Engineering Gates

Run inside `app/` after code, indexer, or schema changes:

- `npm run typecheck` — Zero TypeScript errors across `server/` and `src/`.
- `npm test` — All Markdown/JSON round-trip, indexer, query, and graph-pruning tests pass without relaxed assertions.
- `npm run index` — Ontology links (`[[concept.*]]`) and document links (`[[doc.*]]`) validate cleanly.
- `npm run build` — Production bundle compiles cleanly.

## Knowledge Workflow Eval Criteria

For `raw/` compilation, annotation triage, or synthesis tasks:

1. **Round-trip safety**: Unrelated frontmatter, body prose, and `comments.json` entries remain intact (`git diff` is minimal and deterministic).
2. **Link & concept validity**: No broken `[[concept.*]]`, `[[doc.*]]`, or `raw/...` provenance references; `npm run index` exits 0.
3. **Boundary compliance**: `raw/` files are unmodified; `status: draft` notes are excluded from public exports; private notes never enter `Nexus/knowledge/`.
4. **Human reviewability**: Proposed changes or digests land in `outputs/` or clean commits with clear source citations.
