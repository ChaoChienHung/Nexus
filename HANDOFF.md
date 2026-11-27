# Handoff

## Snapshot

- Updated: 2026-11-27. Workspace: `/Users/ludwigchao/Desktop/Ludwig/Projects/Nexus` (`main` branch).
- Stopping point: Delivered all 4 Reader & Engine upgrades inspired by the PKM/AI knowledge base comparison while preserving Nexus's plain-text Git SSOT + Ontology architecture:
  1. **Concept Hover-Cards + Section Deep-Linking & Transclusion** (`app/server/markdown.ts`, `app/src/components/DocumentReader.tsx`): `extractDocumentSections`, `[[doc#heading]]` scroll-and-pulse jump, `![[doc#heading]]` live read-only embed, and floating `[[concept.*]]` hover-cards.
  2. **`raw/` Inbox & Provenance Tracking** (`app/server/indexer.ts`, `app/server/apiPlugin.ts`, `app/src/components/RawInboxView.tsx`): drag-and-drop upload into `raw/`, `pending` vs `compiled` tracking via `extractRawSourceRefs`, and clickable `raw/...` provenance links in Reader.
  3. **Scoped Filtering & Multi-Vault Switcher** (`app/server/config.ts`, `app/server/query.ts`, `app/server/cli-query.ts`, `CommandPalette.tsx`, `KnowledgeGraph.tsx`, `SettingsModal.tsx`): category-scoped search/graph/CLI (`--category`, `sections` BM25) and runtime vault switching (`/api/vaults`, `/api/vaults/switch`, persisted in `.generated/vaults.json`).
  4. **In-Reader Ask Vault Side-Panel** (`app/server/ask.ts`, `app/src/components/AskPanel.tsx`, `RightPanel.tsx`): grounded Q&A tab (`This Note` / `Category` / `Full Vault`) with Offline BM25+Ontology Retrieval, local Ollama (with model auto-discovery), and OpenAI-compatible API support plus clickable section/concept citations.
  5. **Highlight-to-Ask Multi-Cite Queue & Chat Context Controls** (`app/server/ask.ts`, `app/server/apiPlugin.ts`, `DocumentReader.tsx`, `AskPanel.tsx`, `RightPanel.tsx`, `App.tsx`, `i18n.ts`, `styles.css`): added `Ask` button alongside `Comment` on highlighted text with an inline `Cite & Ask` composer, multi-citation `cite - ask` queue before sending, editable per-cite questions, persistent Ask chat state across tab switches, per-turn/per-reply remove buttons, and Clear Chat History to directly curate the conversation context sent to LLM APIs.
  6. **Knowledge Graph Weighted Streaming Edge Pruning** (`app/server/graphPruning.ts`, `app/server/indexer.ts`, `app/server/types.ts`, `app/src/components/KnowledgeGraph.tsx`, `docs/architecture/graph-pruning.md`): annotates transitive/capped `doc → concept` edges as `redundant: true` using BM25-ordered greedy streaming selection over the weighted Concept subgraph (strong `1.0`, weak `1.5`, threshold `2.0`, max `6` concept anchors / `12` total per doc) while keeping SSOT intact; Knowledge Graph defaults to Pruned Backbone with a one-click toggle to show all edges.
- Verification: `cd app && npm run typecheck && npm test && npm run index && npm run build` all exited 0 (8 test files, 38/38 tests passing; Nexus-Vault pruned 41/78 redundant `doc → concept` edges).

## In-progress work

No active in-progress tasks remain. Completed deliverables are tracked in `REVIEW.md`.

## Suggested next steps

1. Run `cd app && npm run dev` and test the 4 new features live on `http://localhost:4321` (hover-cards, `![[doc#heading]]` transclusion, Raw Inbox drag-and-drop, Settings multi-vault switcher, and Right Panel `Ask` tab).
2. Next long-term roadmap items in `TODO.md`: Hybrid GraphRAG (local vector embeddings over heading chunks under `.generated/`), static GitHub Pages export, and scheduled `outputs/` maintenance workflows.
