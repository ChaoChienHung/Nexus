# Updating & Validating the Index

The **Indexer** (`app/server/indexer.ts`) scans your plain-text sources (`knowledge/notes/**`, `knowledge/data/ontology/concepts.json`, and `knowledge/data/references.json`) and generates the unified tree, document metadata, backlinks, search payload, and Knowledge Graph.

> Never hand-edit generated outputs (`app/.generated/nexus-index.json`). Always edit source `.md` / `.json` files and let the Indexer regenerate them.

---

## 1. Automatic Indexing (During Local Dev)

When running the Reader locally (`cd app && npm run dev`):
- Every `GET /api/index` request and every save from the Reader (`Edit`, `備註`, or `Comments`) automatically re-runs the Indexer on disk.
- If you edit `.md` or `.json` files directly in your IDE, simply refresh the browser tab (`http://localhost:4321/`) to load the latest index.

---

## 2. Manual CLI Indexing & Validation

Run the Indexer manually whenever you add new notes, edit Ontology/Reference JSON in your IDE, or before committing to Git:

```bash
cd app && npm run index
```

This writes `app/.generated/nexus-index.json` (gitignored) and prints a summary:

```text
[nexus-indexer] Indexed 2 docs, 8 concepts, 3 refs, 23 edges -> .generated/nexus-index.json
```

### Public / Draft-Filtered Index
To simulate a public/static export (excluding `status: draft` documents from the tree, search, and Knowledge Graph):

```bash
cd app && npm run index -- --public
```

---

## 3. Resolving Indexer Warnings

If the Indexer detects broken links or metadata issues, it prints warnings at the end of `npm run index`:

| Warning | Likely Cause & Fix |
| --- | --- |
| `missing frontmatter id` | Add `id: doc.<snake_case>` to the document's YAML frontmatter in `index.md`. |
| `Duplicate document id detected` | Two Document Bundles share the same `id: doc.*`; make each `id` unique. |
| `references unknown concept: concept.*` | Fix the typo in `index.md`, or add the new concept to `knowledge/data/ontology/concepts.json`. |
| `cites unknown reference: ref.*` | Fix the typo in `index.md`, or add the citation to `knowledge/data/references.json`. |
| `links to unknown document: doc.*` | Fix the target `doc.*` ID in `related_docs` or `[[doc.*]]`, or verify the target bundle has an `index.md`. |
| `Concept ... has relation to unknown target` | Fix the target `concept_id` in `knowledge/data/ontology/concepts.json`. |

---

## 4. Full Pre-Commit Verification

Before committing larger changes to `knowledge/` or `app/`:

```bash
cd app && npm run typecheck && npm test && npm run index && npm run build
```
