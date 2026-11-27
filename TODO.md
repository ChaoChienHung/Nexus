# TODO

## Task rules

- Write one task per checkbox with a clear outcome and acceptance criteria.
- Record scope and dependencies only when they affect implementation.
- Keep long-term ideas here until they are accepted, rejected, or completed.

## Confirmed decisions

- **Project & repo name:** `Nexus` (renamed from `Wikipedia`; Git initialized on `main`).
- **Runtime mode:** `localhost` web app (offline-capable, with local read/write API for editing & annotations, plus optional read-only static build for GitHub Pages).
- **Tech stack:** Node.js / TypeScript (Vite + React + lightweight local Node server/plugin).
- **Document Bundle layout (inspired by `Ludwigia/notes/`):** Each knowledge document lives in its own folder containing its `.md` file, `comments.json` (sentence-level comments), and local assets/images.
- **Reader editing & annotations:**
  - Direct in-Reader editing persisted to the document's `.md` file.
  - Notes/marginalia area persisted to a dedicated section (e.g., `## 備註` / `## Notes`) in the `.md` file.
  - Sentence-level comments stored in `comments.json` inside the document's folder (keeping `.md` body clean).
- **Knowledge Graph & Ontology:** Concept-centric Knowledge Graph backed by an Ontology system (`concept.*`, labels, aliases, contexts — compatible with `Ludwigia`), connected to `.md` knowledge documents.
- **Storage & Granularity Split (Plain-Text SSOT over Block-JSON):** Keep prose in standard `.md` (human + LLM native, clean Git diffs, zero lock-in) and structured metadata/state in sidecar `.json` (`concepts.json`, `comments.json`, regenerable `.generated/`). Achieve fine-grained reuse and anchoring via three clean tiers — **Concept** (`concepts.json`), **Section** (`##`/`###` headings), and **Sentence** (`comments.json`) — instead of proprietary block-UUID JSON storage.
- **Agent / LLM Knowledge Graph Access:** Use a shared query module (`app/server/query.ts`) + lightweight CLI (`npm run query`) + progressive-disclosure Global Skill as the primary interface (zero idle context-window tax and zero new dependencies). Defer adding a thin `stdio` MCP wrapper over `query.ts` unless shell-less clients (e.g., Claude Desktop) need direct access.

## Owner-led

- [x] Reopen workspace at `/Users/ludwigchao/Desktop/Ludwig/Projects/Nexus` so terminal commands run in the renamed directory
- [ ] Review Nexus v0 Reader UX, schema, and sample content on `http://localhost:4321` and decide next feature priorities (e.g., creating new docs/concepts from UI, static GitHub Pages export, inline Ontology hover-cards)

## Agent-ready

- [x] Scaffold Nexus v0 Reader + Local API + Indexer + Knowledge Graph
  - **Delivered:** `app/` with recursive depth-agnostic Indexer, Vite local read/write API, Markdown round-trip & Indexer Vitest suite (6/6 passing), Reader with direct `index.md` editing, text-selection sentence comments (`comments.json`), surgical `## 備註` panel, `Cmd+K` search, Ontology Browser, and interactive force-directed Knowledge Graph.
- [x] Build Knowledge Graph Query Engine & CLI (`query.ts` + `cli-query.ts`) + Global Skill guide
  - **Delivered:** `app/server/query.ts`, `app/server/cli-query.ts` (`npm run query`), Vitest unit tests (`app/server/__tests__/query.test.ts`), and `docs/guides/agent-query-cli.md` with ready-to-install Global Skill template.
- [x] Build Reader Power-Ups: Concept Hover-Cards, Section Deep-Linking & Transclusion, Raw Inbox + Provenance, Scoped Filtering + Multi-Vault Switcher, and In-Reader Ask Vault Side-Panel
  - **Delivered:** Heading-based section extraction (`extractDocumentSections`), `[[doc#heading]]` deep-linking with scroll-and-pulse, `![[doc#heading]]` live read-only transclusion, inline `[[concept.*]]` hover-cards, `raw/` Inbox dropzone (`RawInboxView.tsx`, `/api/raw/*`) with compilation status & clickable `raw/...` provenance links, category-scoped filtering (`CommandPalette`, `KnowledgeGraph`, `query.ts`, `cli-query.ts` `--category` + `sections`), runtime multi-vault switching (`GET /api/vaults`, `POST /api/vaults/switch`, `SettingsModal`), and `AskPanel.tsx` (`/api/ask`, `/api/ask/models`) supporting Offline BM25+Ontology Retrieval, local Ollama, and OpenAI-compatible APIs.

## Ideas to discuss

- Define concrete conventions for `outputs/` (e.g., cross-note syntheses, health-check reports, and optional batch-processing logs when AI resolves `comments.json` / `## 備註` annotations), evaluate Reader UI support for hiding/showing `resolved: true` comments, and support scheduled/batch agent workflows (e.g., via `/schedule` or CLI) for periodic vault health checks (orphan notes, missing concept links) and synthesis digests.
- Apply the **Abstract → Analogy → Minor Details** writing mindset (`docs/guides/writing-philosophy.md`) as a default template/checklist when drafting or refining notes (short paragraphs, rough analogy first, calibrate nuances just-in-time), with optional per-category note templates.
- Static read-only build export for publishing Nexus snapshots to GitHub Pages.
- Concept hover-cards inside the Reader (using Ontology `contexts` to show "what it is + what it does" inline).
- **Section-level (Heading-based) deep-linking & read-only transclusion:** Support `[[doc.id#heading]]` (scroll-and-highlight jump to a specific section) and `![[doc.id#heading]]` (live read-only embed of tables, formulas, or key takeaways with single-source updates) while keeping `.md` 100% standard plain text; also enables Mentorion quizzes/reviews to link back to exact note sections.
- **`raw/` Inbox & Provenance Tracking:** Add a lightweight `Raw Inbox` view in the Reader to drag-and-drop raw sources (PDFs, clippings, transcripts) into `raw/`, track compilation status (`pending` vs. `compiled` into `wiki/`), and support clickable provenance anchors (e.g., `raw/paper.pdf#page=12`) from distilled Evergreen notes back to original sources.
- **Scoped Knowledge Subsets & Multi-Vault Switching:** Allow scoping search, Knowledge Graph views, and `nexus-query` CLI queries to specific category subtrees (mountable domain subsets), plus switching between multiple vaults/workspaces in Reader Settings (e.g., private `Nexus-Vault`, project-specific vaults, or public demo `knowledge/`).
- Knowledge Graph views: Concept-only Graph vs Full Nexus Graph (Concepts + Documents) vs Local Graph for the active document.
- Knowledge Graph scaling roadmap (as node & citation counts grow):
  - **Mid-term (100–500 nodes):** Add interactive filters (by category, edge type toggle for `explains` vs `mentions` / Concept relations), Local Graph 1-hop / 2-hop depth toggle, and Semantic Zoom (hide secondary labels when zoomed out to prevent hairball clutter).
  - **Long-term (500+ nodes):** Upgrade renderer from SVG + $O(V^2)$ layout to 2D Canvas/WebGL + Barnes-Hut ($O(V \log V)$) or indexer-precomputed layout coordinates; optionally add an experimental 3D star-map view as a toggleable showcase mode while keeping filtered 2D as the primary workspace.
- Optional Tauri desktop wrapper later if a standalone desktop icon is desired.
- **Hybrid GraphRAG with Heading-Level Chunking (Long-term):** Index `.md` files at natural `##` / `###` section granularity into a regenerable local vector index under `.generated/` (e.g., `sqlite-vec` or lightweight local embeddings, zero Git pollution) alongside BM25 + 1–2 hop graph traversal and optional category scoping in `app/server/query.ts`.
- **Optional In-Reader "Ask Vault" Side-Panel:** A lightweight reading-time Q&A panel inside `localhost:4321` scoped to the active note or selected category subset, powered by `query.ts` retrieval + pluggable local (Ollama / `llama.cpp`) or cloud LLM backends, returning clickable section/source citations.
- Optional thin `stdio` MCP wrapper over `app/server/query.ts` if shell-less LLM apps (e.g., Claude Desktop) later need direct Nexus access.
- Composable Mentorion integration (Nexus as Composition Hub, see `docs/architecture/composable-suite.md`): optionally mount a running Mentorion API (`MENTORION_API_URL`) to surface SM-2 next-review status, Review Calendar, and Quiz flows directly inside Nexus while keeping both projects 100% standalone-usable over an open, user-customizable Document Schema.
