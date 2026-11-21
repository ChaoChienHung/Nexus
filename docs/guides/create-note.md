# Creating a New Note (Document Bundle)

Every knowledge note in Nexus is a self-contained **Document Bundle** stored as plain text under `knowledge/notes/`.

---

## 1. Choose a Folder Location (Depth-Agnostic)

Create a new folder at **any category depth** under `knowledge/notes/` and place an `index.md` inside it:

```text
knowledge/notes/<Category/...>/<doc-slug>/
├── index.md          # Required: frontmatter, body, and optional ## 備註
├── comments.json     # Optional: created automatically when you add sentence comments in the Reader
└── diagram.svg       # Optional: local images or attachments referenced as ./diagram.svg
```

- Any folder containing `index.md` is treated as a **Document Bundle**.
- Parent folders without `index.md` automatically form the **Category Tree** in the Reader sidebar — use clear, professional Title Case names (e.g., `Artificial Intelligence/Machine Learning/`, `Thinking & Methodology/`).
- Moving a Document Bundle to a different category folder later will **not** break internal links, because Nexus resolves links by frontmatter `id` (`doc.*`), not file path.

---

## 2. Author `index.md`

Start from this template:

```markdown
---
id: doc.<snake_case_id>
title: Human-Readable Title
summary: 1–2 sentence overview shown in search results, document header, and graph previews.
concepts:
  - concept.clustering
related_docs:
  - doc.clustering_foundations
status: seed # draft | seed | evergreen
created: 2026-11-21
updated: 2026-11-21
---

# Human-Readable Title

Write standard GitHub-Flavored Markdown (GFM).

- Link to canonical terminology inline using `[[concept.clustering]]`.
- Link to another note using `[[doc.clustering_foundations]]`.
- Embed local bundle assets with relative paths like `![Diagram](./diagram.svg)`.

## 備註

- Optional marginalia or follow-up ideas (can also be edited directly from the Reader's `備註` tab).
```

### Frontmatter Field Guide
- `id` *(required)*: Stable identifier prefixed with `doc.` in `snake_case` (must be unique across the repository).
- `title` *(required)*: Display title in the sidebar, Reader, search, and Knowledge Graph.
- `summary` *(optional)*: Short overview used in the Reader callout, `Cmd+K` search, and Graph detail cards.
- `concepts` *(optional)*: Canonical `concept.*` IDs from `knowledge/data/ontology/concepts.json` that this note primarily explains.
- `related_docs` *(optional)*: Canonical `doc.*` IDs for related notes (backlinks are computed automatically).
- `status` *(optional, default `seed`)*:
  - `draft` — Private / work-in-progress; hidden from public/static exports (`--public`).
  - `seed` — Early-stage capture that will grow over time.
  - `evergreen` — Mature, well-structured, concept-linked note.

---

## 3. Add New Concepts (If Needed)

- If your note introduces a concept not yet in `knowledge/data/ontology/concepts.json`, see [updating-knowledge-graph.md](./updating-knowledge-graph.md).
- For external links or citations, write standard Markdown links directly inside `index.md` so each note remains self-contained in plain text.

---

## 4. Validate & Preview

Run the Indexer to verify frontmatter IDs and links have zero warnings:

```bash
cd app && npm run index
```

Then open (or refresh) the local Reader at `http://localhost:4321/` (`cd app && npm run dev`) to read, refine, add sentence comments, and inspect its connections in the Knowledge Graph.
