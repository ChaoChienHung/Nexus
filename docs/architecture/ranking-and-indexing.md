# Nexus Technical Architecture: Tech Stack, Ranking, Indexing & Anchoring

This document records the core tech stack, algorithms, and technical mechanisms powering Nexus (`app/server/` and `app/src/`).

---

## 0. Tech Stack & Vault Path Resolution

### Tech Stack
- **Runtime & Language**: Node.js (v22+) + TypeScript (strict mode)
- **Frontend**: React 19 + Vite 6 + `lucide-react` icons + custom Editorial Minimal CSS (`app/src/styles.css`, Light warm cream/brown & low-glare Charcoal Dark)
- **Markdown & Frontmatter**: `marked` (GFM rendering) + `gray-matter` (YAML frontmatter parsing)
- **Local Read/Write API**: Custom Vite server middleware plugin (`app/server/apiPlugin.ts`) — zero separate backend daemon required during local development
- **Testing & CLI**: `vitest` (unit & round-trip regression tests) + `tsx` (CLI indexer)
- **i18n**: Lightweight typed dictionary (`app/src/i18n.ts`) supporting `zh-Hant` and `en` for UI, Ontology concepts, and Knowledge Graph relations

### Vault Path Resolution (`app/server/config.ts`)
To support a **Public Engine (`Nexus`) + Private Vault (`Nexus-Vault`)** architecture without git submodules, `resolveKnowledgeDir(appDir)` resolves the active knowledge directory in strict priority order:
1. Shell environment variable `NEXUS_KNOWLEDGE_DIR`
2. `NEXUS_KNOWLEDGE_DIR` in `app/.env.local` (gitignored) or `app/.env` (supports `~/` home expansion and relative paths resolved from `app/`)
3. Default fallback: `../knowledge` (the built-in demo dataset inside the public `Nexus` repo)

Both `app/vite.config.ts` (live dev server + REST API) and `app/server/cli-index.ts` (`npm run index`) share this single resolver.

---

## 1. Concept-to-Document Ranking (BM25 + Structural Boost)

Implemented in `app/server/ranking.ts` (`rankRelatedDocumentsForConcepts`).

As a knowledge base grows, a single Ontology Concept may be referenced across dozens of notes. To surface the **Top 3 most relevant documents** (`conceptTopDocs`) for each concept in the Terminology browser, Terminology inspector, and Knowledge Graph, Nexus combines **Okapi BM25** with deterministic **structural link boosts**.

### 1.1 Bilingual Tokenization (`tokenizeBilingual`)
Because Nexus notes mix English and Traditional/Simplified Chinese without external NLP dependencies:
- **ASCII / English**: Lowercased alphanumeric word tokens (`/[a-z0-9]+/g`, length >= 2).
- **CJK**: Overlapping character bigrams across contiguous CJK runs (`[\u4e00-\u9fff]+`), falling back to unigrams for 1-character runs. For example, `分群分析` produces `["分群", "群分", "分析"]`, enabling accurate Chinese recall without a dictionary.
- Raw wiki-link tokens (`[[concept.*]]`, `[[doc.*]]`) are stripped from the Markdown body before tokenization so internal IDs do not distort natural-language term statistics.

### 1.2 Field-Weighted Document Representation
Each document is tokenized with field multiplicity:
- **Title**: `3x`
- **Summary**: `2x`
- **Body**: `1x`

### 1.3 Concept Query Construction
Each Ontology Concept's query terms are weighted by semantic authority:
- `labels.en`, `labels['zh-Hant']`: `2.0`
- `labels['zh-Hans']`, `aliases[]`: `1.8`
- `contexts.en`, `contexts['zh-Hant']`: `0.5`

### 1.4 Scoring Formula
For a corpus of $N$ documents with average field-weighted length $\text{avgdl}$, Okapi BM25 ($k_1 = 1.5,\; b = 0.75$) computes:

$$\text{IDF}(t) = \ln\left(\frac{N - df(t) + 0.5}{df(t) + 0.5} + 1\right)$$

$$\text{BM25}(c, d) = \sum_{t \in Q(c)} w_q(t) \cdot \text{IDF}(t) \cdot \frac{tf(t, d) \cdot (k_1 + 1)}{tf(t, d) + k_1 \cdot \left(1 - b + b \cdot \frac{|d|}{\text{avgdl}}\right)}$$

Finally, explicit graph edges add a deterministic structural boost:
- Frontmatter `concepts` (`explains` edge): `+2.5`
- Inline `[[concept.*]]` (`mentions` edge): `+1.0`

$$\text{Score}(c, d) = \text{BM25}(c, d) + \text{StructuralBoost}(c, d)$$

Documents with a structural link or $\text{BM25}(c, d) \ge 0.45$ are sorted descending by `Score` (tie-broken by `docId`) and truncated to **Top 3** (`topK = 3`).

---

## 2. Depth-Agnostic Recursive Indexer

Implemented in `app/server/indexer.ts` (`buildNexusIndex`):
- Recursively walks `knowledge/wiki/`: any directory containing `index.md` is indexed as a **Document Bundle**; ancestor folders without `index.md` form the **Category Tree**.
- Parses YAML frontmatter via `gray-matter`, reads optional sidecar `comments.json`, computes bidirectional `backlinks`, validates all `concept.*` and `doc.*` links, and builds the Knowledge Graph (`concept` and `document` nodes + 11 Concept relation types + `explains`, `mentions`, `links_to` edges).
- Supports `includeDrafts: false` (`npm run index -- --public`) to exclude `status: draft` documents from public exports.

---

## 3. Cross-Tag DOM Sentence-Comment Anchoring

Implemented in `app/src/components/DocumentReader.tsx` (`applyCommentHighlights`, `findQuoteRange`):
- Comments are stored in `comments.json` with `{ quote, prefix, suffix }` so `index.md` remains 100% clean plain Markdown.
- After `marked` renders HTML, a `TreeWalker(container, NodeFilter.SHOW_TEXT)` flattens all text nodes into an offset map, locates `quote` (disambiguating repeated occurrences with `prefix` / `suffix`), and wraps the exact overlapping text-node slices in `<mark class="comment-highlight">` in reverse DOM order.
- This allows highlights and two-way scroll-to-sentence jumps to work reliably even when a cited sentence spans `<strong>`, `<em>`, `<code>`, or `<a>` inline tags.

---

## 4. Surgical `## 備註` Round-Trip Persistence

Implemented in `app/server/markdown.ts` (`extractNotesSection`, `updateNotesSection`):
- Skips past the YAML frontmatter boundary, locates `^##[ \t]+(備註|Notes)[ \t]*$`, and replaces only the slice up to the next `## ` heading (or EOF), guaranteeing byte-for-byte preservation of frontmatter and body text.

---

## 5. Force-Directed Knowledge Graph Layout

Implemented in `app/src/components/KnowledgeGraph.tsx`:
- Runs a deterministic 180-iteration force-directed simulation (inverse-square repulsion + explicit minimum-distance collision push + Hooke spring edges + gentle center gravity) directly in React/SVG with pan, zoom, drag, directional arrowheads, and 3 view modes (`Full Nexus`, `Concepts`, `Local`).
