# Nexus

A local-first personal knowledge base managed in a Git repository, combining Markdown (`.md`) knowledge documents (per-document bundles with `comments.json` and local assets), structured JSON (`.json`) Ontology metadata, a `localhost` TypeScript/React Reader with direct editing, sentence-level comments, and notes/marginalia, plus a concept-centric Knowledge Graph.

## Why "Nexus"?

- **A living web of connections:** *Nexus* means a central point of connection and network — a natural fit for a personal knowledge base designed to grow continuously and link ideas through an Ontology and Knowledge Graph.
- **The knowledge home base:** Like the *Nexus* in *League of Legends* — the vital core stronghold at the heart of a team's base — this repository serves as the central headquarters for accumulated thinking, concepts, and notes.

## About

Nexus organizes personal knowledge around **two connected layers** — all stored as plain text in Git, with the Reader and Knowledge Graph generated automatically from them:

```text
  [ Documents (Notes) ] ── explains / mentions ──▶ [ Ontology Concepts ] ◀──▶ [ Other Concepts ]
           │  ▲                                     (canonical terms,          (is a, depends on,
           └──┘ links to / backlinks                 bilingual contexts)        contrasts with, ...)
```

- **Ontology Concepts** (`knowledge/data/ontology/concepts.json`) act as the semantic backbone: each concept is a canonical node with bilingual labels, aliases, definitions, and directional relations to other concepts.
- **Documents / Wiki (`knowledge/wiki/**/index.md`)** are deep-dive write-ups stored in depth-agnostic folders. Together with `concepts.json`, they form the compiled Single Source of Truth (SSOT) for Nexus: each document connects to the Concepts it explains or mentions, links to related documents (with backlinks computed automatically), and keeps any external links or citations inline as portable Markdown.
- **Compiled Knowledge Graph (Zero Manual Graph Editing)**: You only maintain plain-text `.md` and `.json` files — the Indexer automatically compiles the entire Knowledge Graph from them:
  - `index.md` frontmatter `concepts` → `Document → Concept` (`explains`)
  - `index.md` inline `[[concept.*]]` → `Document ··· Concept` (`mentions`)
  - `index.md` frontmatter `related_docs` & inline `[[doc.*]]` → `Document ↔ Document` (`links_to` + automatic backlinks)
  - `concepts.json` `relations[]` → `Concept ↔ Concept` (hierarchy, causal, contrast, and associative edges)

- **Automatic Sync & Ranking**: Whenever you add or edit a note (in your IDE or directly in the local Reader), the Indexer automatically rebuilds the category tree, backlinks, Knowledge Graph, and **BM25-ranked Top 3 Related Documents** for every concept.

## Features

- **Plain-Text, Git-First Knowledge Bundles**: Every document lives in a depth-agnostic folder (`index.md`, optional `comments.json`, and local assets) that stays 100% readable and editable in any Markdown editor without lock-in.
- **Direct In-Reader Editing & Marginalia**: Edit full Markdown directly in the `localhost` Reader (`Cmd+S` writes straight to `index.md`), jot down thoughts in the dedicated `備註` panel that surgically updates only `## 備註`, or one-click **Copy / Download Markdown** from the note sidebar.
- **Sentence-Level Comments**: Highlight any sentence in a document to attach a comment saved to `comments.json`, with two-way jump & highlight between comments and their cited sentences.
- **Ontology & Terminology Inspector**: Maintain canonical concepts (`concepts.json`) with multilingual labels, aliases, definitions, and semantic relations, inspectable via the scalable document-terms sidebar or the editorial Terminology directory (with BM25 Top 3 related documents).
- **Interactive Knowledge Graph**: Explore how Concepts and Documents connect across three views — **Full Nexus**, **Concepts**, and **Local** — with color/stroke/arrow-coded relation styles, floating legend, pan, zoom, drag, click-empty/Esc deselect, and `Related Documents` navigation.
- **Settings & Bilingual UI (`繁體中文` / `English`)**: Switch theme (Editorial Minimal Light / Dark) and unified language pack (controlling UI, Concept labels/definitions, and Knowledge Graph relations while keeping each article in its original language).
- **Instant Global Search (`Cmd+K`)**: Fuzzy-search across all documents (at any folder depth) and terminology from anywhere in the app.

## Terminology

- **Document (Note)**: A Markdown (`.md`) file representing a knowledge write-up or topic, linking to Ontology concepts and related notes, with optional in-Reader editing, sentence comments, and a notes/marginalia area.
- **Document Status**: A frontmatter maturity flag (`status`) tracking a note's lifecycle:
  - **`draft`**: Work-in-progress or private scratch notes; excluded from public/static exports.
  - **`seed`**: Early-stage idea or initial capture that will be expanded and refined over time.
  - **`evergreen`**: Mature, well-structured, concept-linked knowledge note designed to evolve and remain useful long-term.

- **Ontology Concept**: A canonical knowledge unit (`concept.<snake_case>`) with stable ID, multilingual labels, aliases, and category-anchor-first context/definition (inspired by `Ludwigia`'s ontology system). Concepts form the core semantic backbone of the Knowledge Graph.
- **Concept Kind**: An optional classification tag (`kind` in `concepts.json`) shown beside each term in the Reader to indicate what category of idea it represents:
  - **`task`**: A problem formulation or learning/reasoning objective (e.g., Clustering, Unsupervised Learning).
  - **`method`**: An algorithm, technique, or analytical approach (e.g., Representation Learning, Dimensionality Reduction).
  - **`principle`**: A foundational rule, mental model, or reasoning habit (e.g., First Principles, Reverse Engineering).
  - **`architecture`**: A structural model or system design pattern.
  - **`metric`**: A quantitative evaluation or measurement criterion.
  - **`framework`**: A cohesive conceptual system or methodology.
  - **`concept`**: Default general kind for foundational notions or phenomena (e.g., Noise) that do not fall into a narrower category above.

- **Sentence Comment & Notes Area**: Reader-created annotations (comments anchored to specific sentences, plus a document-level notes/marginalia section) persisted directly back to the repository's source files.
- **Knowledge Graph**: A multi-layer graph centered on Ontology Concepts and their relationships, connected to the Documents that explain and mention them.
- **Reader**: The `localhost` Node.js/TypeScript web application (with an optional read-only static build for GitHub Pages) for reading, editing, annotating, searching, and exploring the Knowledge Graph.
- **Indexer**: The automated script that scans `.md` and `.json` sources, validates Ontology mappings, and generates search and graph data for the Reader.

## Repository Map

- Root documentation (`README.md`, `AGENTS.md`, `TODO.md`, `HANDOFF.md`, `REVIEW.md`): Project overview, agent invariants, task backlog, session handoff, and human review queue.
- Specifications (`docs/specs/`): Data schemas for `.md` Document Bundles, Ontology JSON, sentence comments, and Knowledge Graph contracts.
- Knowledge content (`knowledge/`): Compiled SSOT with depth-agnostic `.md` Document Bundles (`knowledge/wiki/`, using professional Title Case category folders) and `.json` Ontology metadata (`knowledge/data/ontology/concepts.json`), plus optional `raw/` (unorganized raw sources, AI read-only) and `outputs/` (AI reports/analyses) folders.
- Reader application (`app/`): Node.js + TypeScript (Vite + React) `localhost` Reader/Editor UI, local file read/write API, interactive Knowledge Graph, Ontology Browser, `Cmd+K` search, and recursive Indexer.
- Generated outputs (`app/.generated/`, `app/dist/`): Auto-generated index JSON and build bundles (gitignored; never edited by hand).

## Quick start

```bash
cd app
npm install
npm run dev
```

Open `http://localhost:4321` in your browser.

Common commands (run inside `app/`):
- `npm run dev` — Launch the `localhost` Reader & Editor with live local file read/write API.
- `npm run index` — Run the recursive Indexer and validate Ontology & Document links.
- `npm test` — Run Markdown round-trip and Indexer regression tests.
- `npm run typecheck` — Type-check server and frontend TypeScript.
- `npm run build` — Build the production frontend bundle.

### Using a Separate Private Knowledge Vault (Open-Source Engine + Private Notes)

To keep this `Nexus` repo public while storing your real notes in a separate **Private GitHub repo** (e.g., `Nexus-Vault` with `wiki/`, `data/`, `raw/`, and `outputs/` folders):

1. Copy `app/.env.example` to `app/.env.local` (already gitignored).
2. Point `NEXUS_KNOWLEDGE_DIR` to your local private vault folder:

```env
NEXUS_KNOWLEDGE_DIR=/path/to/your/Nexus-Vault
```

When `NEXUS_KNOWLEDGE_DIR` is set, both `npm run dev` (including direct edits, `## 備註`, and `comments.json`) and `npm run index` read and write directly against your private vault, while `Nexus` stays clean with its built-in sample `knowledge/` dataset.

## Make one change

1. Edit `.md` documents or `concepts.json` (either in your IDE or directly in the `localhost` Reader).
2. Run the indexer / validation check (`cd app && npm run index`, or automatically triggered on local save in dev mode).
3. Inspect the updated document, annotations, and Knowledge Graph in the Reader, and commit clean plain-text diffs to Git.

## More detail

- Invariants: `AGENTS.md`
- Data schema: `docs/specs/data-schema.md`
- Technical architecture (BM25 ranking, indexer, DOM anchoring): `docs/architecture/ranking-and-indexing.md`
- Guides:
  - Note-writing philosophy & mindset: `docs/guides/writing-philosophy.md`
  - Public engine + private vault setup: `docs/guides/private-vault-setup.md`
  - Creating a note: `docs/guides/create-note.md`
  - Updating & validating the index: `docs/guides/updating-index.md`
  - Updating the Knowledge Graph: `docs/guides/updating-knowledge-graph.md`

- Agent handoff: `HANDOFF.md` for the latest stopping point; `TODO.md` for unfinished and long-term work; `REVIEW.md` for completed work awaiting review.

## Generative AI Acknowledgment

This project was designed and built collaboratively with generative AI coding assistants:

- **Google Gemini (Antigravity)**: Core architecture, data schema, recursive Indexer, BM25 ranking engine, local read/write API, interactive Knowledge Graph, bilingual i18n system, and documentation.
- **Claude Opus 5.5**: Editorial Minimal UI/UX direction, typography, and layout refinement.
