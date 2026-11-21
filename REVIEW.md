# REVIEW

## Awaiting review

- [ ] Nexus schema specification and sample knowledge base
  - **Delivered:** Created `docs/specs/data-schema.md`, `knowledge/data/ontology/concepts.json`, `knowledge/data/references.json`, and 2 sample Document Bundles (`clustering-foundations` with `comments.json`, and `first-principles-and-reverse-engineering`).
  - **Evidence:** All files written cleanly under `/Users/ludwigchao/Desktop/Ludwig/Projects/Nexus/` following the locked depth-agnostic Document Bundle and `Ludwigia`-compatible Ontology contracts.
  - **Review focus:** Confirm the sample `.md` frontmatter, `comments.json` anchoring format, and `concepts.json` relations feel right.
- [ ] Nexus v0 Reader + Local Read/Write API + Indexer + Knowledge Graph (`app/`)
  - **Delivered:** Modern minimal Vite + React + TypeScript Reader app (`app/`, Light & Zinc Dark themes, collapsible right drawer), `knowledge/notes/` with Title Case categories, recursive depth-agnostic Indexer, BM25 + structural-boost Top 3 concept-to-document ranking (`app/server/ranking.ts`), local REST API, direct Markdown editing, cross-tag DOM sentence-comment highlighting & two-way jump, surgical `## 備註` editor, scalable right-sidebar `Terminology` list & inspector with human-readable relation labels, `Cmd+K` search palette, editorial Terminology directory, spacious dot-grid SVG Knowledge Graph (11 Concept relation types + directional arrows + `Related Documents`), plus `docs/guides/` (`create-note.md`, `updating-index.md`, `updating-knowledge-graph.md`), `docs/architecture/ranking-and-indexing.md`, and `README.md` (`Why "Nexus"?`, `About`, `Features`, `Document Status`).
  - **Evidence:** `npm run typecheck`, `npm test` (8/8 passing), `npm run index` (2 docs, 8 concepts, 3 refs, 23 edges, 0 warnings), and `npm run build` all exited 0; live dev server verified on `http://localhost:4321`.
  - **Review focus:** Review the live Reader & Knowledge Graph UX on `http://localhost:4321` and decide next feature priorities in `TODO.md`.
