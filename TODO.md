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

## Owner-led

- [x] Reopen workspace at `/Users/ludwigchao/Desktop/Ludwig/Projects/Nexus` so terminal commands run in the renamed directory
- [ ] Review Nexus v0 Reader UX, schema, and sample content on `http://localhost:4321` and decide next feature priorities (e.g., creating new docs/concepts from UI, static GitHub Pages export, inline Ontology hover-cards)

## Agent-ready

- [x] Scaffold Nexus v0 Reader + Local API + Indexer + Knowledge Graph
  - **Delivered:** `app/` with recursive depth-agnostic Indexer, Vite local read/write API, Markdown round-trip & Indexer Vitest suite (6/6 passing), Reader with direct `index.md` editing, text-selection sentence comments (`comments.json`), surgical `## 備註` panel, `Cmd+K` search, Ontology Browser, and interactive force-directed Knowledge Graph.

## Ideas to discuss

- Define concrete conventions for `outputs/` (e.g., cross-note syntheses, health-check reports, and optional batch-processing logs when AI resolves `comments.json` / `## 備註` annotations) and evaluate Reader UI support for hiding/showing `resolved: true` comments.
- Apply the **Abstract → Analogy → Minor Details** writing mindset (`docs/guides/writing-philosophy.md`) as a default template/checklist when drafting or refining notes (short paragraphs, rough analogy first, calibrate nuances just-in-time).
- Static read-only build export for publishing Nexus snapshots to GitHub Pages.
- Concept hover-cards inside the Reader (using Ontology `contexts` to show "what it is + what it does" inline).
- Knowledge Graph views: Concept-only Graph vs Full Nexus Graph (Concepts + Documents) vs Local Graph for the active document.
- Optional Tauri desktop wrapper later if a standalone desktop icon is desired.
