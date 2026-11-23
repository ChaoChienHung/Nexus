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
- **Agent / LLM Knowledge Graph Access:** Use a shared query module (`app/server/query.ts`) + lightweight CLI (`npm run query`) + progressive-disclosure Global Skill as the primary interface (zero idle context-window tax and zero new dependencies). Defer adding a thin `stdio` MCP wrapper over `query.ts` unless shell-less clients (e.g., Claude Desktop) need direct access.

## Owner-led

- [x] Reopen workspace at `/Users/ludwigchao/Desktop/Ludwig/Projects/Nexus` so terminal commands run in the renamed directory
- [ ] Review Nexus v0 Reader UX, schema, and sample content on `http://localhost:4321` and decide next feature priorities (e.g., creating new docs/concepts from UI, static GitHub Pages export, inline Ontology hover-cards)

## Agent-ready

- [x] Scaffold Nexus v0 Reader + Local API + Indexer + Knowledge Graph
  - **Delivered:** `app/` with recursive depth-agnostic Indexer, Vite local read/write API, Markdown round-trip & Indexer Vitest suite (6/6 passing), Reader with direct `index.md` editing, text-selection sentence comments (`comments.json`), surgical `## 備註` panel, `Cmd+K` search, Ontology Browser, and interactive force-directed Knowledge Graph.
- [x] Build Knowledge Graph Query Engine & CLI (`query.ts` + `cli-query.ts`) + Global Skill guide
  - **Delivered:** `app/server/query.ts`, `app/server/cli-query.ts` (`npm run query`), Vitest unit tests (`app/server/__tests__/query.test.ts`), and `docs/guides/agent-query-cli.md` with ready-to-install Global Skill template.

## Ideas to discuss

- Define concrete conventions for `outputs/` (e.g., cross-note syntheses, health-check reports, and optional batch-processing logs when AI resolves `comments.json` / `## 備註` annotations) and evaluate Reader UI support for hiding/showing `resolved: true` comments.
- Apply the **Abstract → Analogy → Minor Details** writing mindset (`docs/guides/writing-philosophy.md`) as a default template/checklist when drafting or refining notes (short paragraphs, rough analogy first, calibrate nuances just-in-time).
- Static read-only build export for publishing Nexus snapshots to GitHub Pages.
- Concept hover-cards inside the Reader (using Ontology `contexts` to show "what it is + what it does" inline).
- Knowledge Graph views: Concept-only Graph vs Full Nexus Graph (Concepts + Documents) vs Local Graph for the active document.
- Knowledge Graph scaling roadmap (as node & citation counts grow):
  - **Mid-term (100–500 nodes):** Add interactive filters (by category, edge type toggle for `explains` vs `mentions` / Concept relations), Local Graph 1-hop / 2-hop depth toggle, and Semantic Zoom (hide secondary labels when zoomed out to prevent hairball clutter).
  - **Long-term (500+ nodes):** Upgrade renderer from SVG + $O(V^2)$ layout to 2D Canvas/WebGL + Barnes-Hut ($O(V \log V)$) or indexer-precomputed layout coordinates; optionally add an experimental 3D star-map view as a toggleable showcase mode while keeping filtered 2D as the primary workspace.
- Optional Tauri desktop wrapper later if a standalone desktop icon is desired.
- Hybrid GraphRAG (Long-term): Add local vector embeddings (e.g., `sqlite-vec` or lightweight local embedding index) alongside BM25 + 1–2 hop graph traversal in `app/server/query.ts` when the vault grows large enough that synonym/keyword-free semantic recall becomes a bottleneck.
- Optional thin `stdio` MCP wrapper over `app/server/query.ts` if shell-less LLM apps (e.g., Claude Desktop) later need direct Nexus access.
