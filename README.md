# Nexus

A local-first personal knowledge base managed in a Git repository, combining Markdown (`.md`) knowledge documents (per-document bundles with `comments.json` and local assets), structured JSON (`.json`) Ontology & Reference metadata, a `localhost` TypeScript/React Reader with direct editing, sentence-level comments, and notes/marginalia, plus a concept-centric Knowledge Graph.

## Why "Nexus"?

- **A living web of connections:** *Nexus* means a central point of connection and network — a natural fit for a personal knowledge base designed to grow continuously and link ideas through an Ontology and Knowledge Graph.
- **The knowledge home base:** Like the *Nexus* in *League of Legends* — the vital core stronghold at the heart of a team's base — this repository serves as the central headquarters for accumulated thinking, concepts, and references.

## Features

- **Plain-Text, Git-First Knowledge Bundles**: Every document lives in a depth-agnostic folder (`index.md`, optional `comments.json`, and local assets) that stays 100% readable and editable in any Markdown editor without lock-in.
- **Direct In-Reader Editing & Marginalia**: Edit full Markdown directly in the `localhost` Reader (`Cmd+S` writes straight to `index.md`), or jot down thoughts in the dedicated `備註` panel that surgically updates only the `## 備註` section without touching frontmatter or main body.
- **Sentence-Level Comments**: Highlight any sentence in a document to attach a comment saved to `comments.json`, with two-way jump & highlight between comments and their cited sentences.
- **Ontology & Terminology Inspector**: Maintain canonical concepts (`concepts.json`) with multilingual labels, aliases, definitions, and semantic relations (`is_a`, `depends_on`, `contrasts_with`, `relates_to`), inspectable inline while reading or via the Ontology Browser.
- **Shared External References**: Manage books, papers, and links once in `references.json` and cite them across any number of documents.
- **Interactive Knowledge Graph**: Explore how Concepts, Documents, and References connect across three views — **Full Nexus**, **Concepts Only**, and **Local (Active Doc)** — with pan, zoom, drag, and direct navigation.
- **Instant Global Search (`Cmd+K`)**: Fuzzy-search across all documents (at any folder depth), terminology, and references from anywhere in the app.
- **Clean Reading Experience**: Warm Paper light theme and Neutral Charcoal dark theme inspired by `Ludwigia`, with a collapsible annotations panel for distraction-free reading.

## Terminology

- **Document (Note)**: A Markdown (`.md`) file representing a knowledge write-up or topic, linking to Ontology concepts and citing external References, with optional in-Reader editing, sentence comments, and a notes/marginalia area.
- **Ontology Concept**: A canonical knowledge unit (`concept.<snake_case>`) with stable ID, multilingual labels, aliases, and category-anchor-first context/definition (inspired by `Ludwigia`'s ontology system). Concepts form the core semantic backbone of the Knowledge Graph.
- **Reference**: A structured external source (paper, book, article, URL) stored in JSON so multiple documents can cite it without duplication.
- **Sentence Comment & Notes Area**: Reader-created annotations (comments anchored to specific sentences, plus a document-level notes/marginalia section) persisted directly back to the repository's source files.
- **Knowledge Graph**: A multi-layer graph centered on Ontology Concepts and their relationships, connected to the Documents that explain them and the References that ground them.
- **Reader**: The `localhost` Node.js/TypeScript web application (with an optional read-only static build for GitHub Pages) for reading, editing, annotating, searching, and exploring the Knowledge Graph.
- **Indexer**: The automated script that scans `.md` and `.json` sources, validates Ontology mappings, and generates search and graph data for the Reader.

## Repository Map

- Root documentation (`README.md`, `AGENTS.md`, `TODO.md`, `HANDOFF.md`, `REVIEW.md`): Project overview, agent invariants, task backlog, session handoff, and human review queue.
- Specifications (`docs/specs/`): Data schemas for `.md` Document Bundles, Ontology JSON, References JSON, sentence comments, and Knowledge Graph contracts.
- Knowledge content (`knowledge/`): Hand-authored depth-agnostic `.md` Document Bundles (`knowledge/docs/`) and `.json` metadata (`knowledge/data/ontology/concepts.json`, `knowledge/data/references.json`).
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
- `npm run index` — Run the recursive Indexer and validate Ontology/Reference links.
- `npm test` — Run Markdown round-trip and Indexer regression tests.
- `npm run typecheck` — Type-check server and frontend TypeScript.
- `npm run build` — Build the production frontend bundle.

## Make one change

1. Edit `.md` documents or `.json` Ontology/Reference files (either in your IDE or directly in the `localhost` Reader).
2. Run the indexer / validation check (`cd app && npm run index`, or automatically triggered on local save in dev mode).
3. Inspect the updated document, annotations, and Knowledge Graph in the Reader, and commit clean plain-text diffs to Git.

## More detail

- Invariants: `AGENTS.md`
- Data schema: `docs/specs/data-schema.md`
- Updating the Knowledge Graph: `docs/guides/updating-knowledge-graph.md`
- Agent handoff: `HANDOFF.md` for the latest stopping point; `TODO.md` for unfinished and long-term work; `REVIEW.md` for completed work awaiting review.
