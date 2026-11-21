# REVIEW

## Awaiting review

- [ ] Nexus schema specification and sample knowledge base
  - **Delivered:** Created `docs/specs/data-schema.md`, `knowledge/data/ontology/concepts.json`, `knowledge/data/references.json`, and 2 sample Document Bundles (`clustering-foundations` with `comments.json`, and `first-principles-and-reverse-engineering`).
  - **Evidence:** All files written cleanly under `/Users/ludwigchao/Desktop/Ludwig/Projects/Nexus/` following the locked depth-agnostic Document Bundle and `Ludwigia`-compatible Ontology contracts.
  - **Review focus:** Confirm the sample `.md` frontmatter, `comments.json` anchoring format, and `concepts.json` relations feel right.
- [ ] Nexus v0 Reader + Local Read/Write API + Indexer + Knowledge Graph (`app/`)
  - **Delivered:** Full Vite + React + TypeScript Reader app (`app/`) styled after `Ludwigia` (Warm Paper light default + Neutral Charcoal dark toggle, collapsible right drawer), recursive depth-agnostic Indexer, local REST API (`GET /api/index`, `PUT /api/docs/:id/markdown`, `PUT /api/docs/:id/notes`, `POST/PATCH/DELETE /api/docs/:id/comments`, `GET /api/assets/:id/*`), direct Markdown editing, cross-tag DOM sentence-comment highlighting & two-way jump, surgical `## 備註` editor, `Terminology` inspector, `Cmd+K` search palette, Ontology Browser, spacious interactive SVG Knowledge Graph (11 Concept relation types + directional arrows + `Related Documents` multi-doc card), `docs/guides/updating-knowledge-graph.md`, and `README.md` features + `Why "Nexus"?`.
  - **Evidence:** `npm run typecheck`, `npm test` (6/6 passing), `npm run index` (2 docs, 8 concepts, 3 refs, 23 edges, 0 warnings), and `npm run build` all exited 0; live dev server verified on `http://localhost:4321`.
  - **Review focus:** Review the live Reader & Knowledge Graph UX on `http://localhost:4321` and decide next feature priorities in `TODO.md`.
