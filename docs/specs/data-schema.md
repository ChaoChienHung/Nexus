# Nexus Data Schema Specification

Version: `0.1`  
Status: Active baseline for Nexus v0

## 1. Directory Layout

```text
knowledge/
├── raw/                                 # Optional: unorganized raw sources (PDFs, transcripts, clippings; AI read-only)
├── wiki/                                # Compiled SSOT: depth-agnostic category tree + Document Bundles
│   └── <Category/...>/<doc-slug>/       # Any folder containing index.md is a Document Bundle
│       ├── index.md                     # Source of truth for document metadata, body, and notes area
│       ├── comments.json                # Optional sentence-level comments sidecar
│       └── <asset.*>                    # Local images, diagrams, or attachments
├── outputs/                             # Optional: AI-generated reports, analyses, and health-check logs
└── data/
    └── ontology/
        └── concepts.json                # Canonical Ontology concepts & semantic relations
```

### Depth-Agnostic Rule
- A directory under `knowledge/wiki/` is a **Document Bundle** if and only if it contains `index.md`.
- Ancestor directories without `index.md` form the **Category Tree** (arbitrary nesting depth). Use clear, professional Title Case names (e.g., `Artificial Intelligence/Machine Learning/`) because category folder names render directly in the Reader sidebar.
- Moving a Document Bundle to a shallower or deeper category folder never breaks internal links because references resolve by stable frontmatter `id` (`doc.*`), not file path.

---

## 2. Document (`index.md`)

### Frontmatter
```yaml
---
id: doc.clustering_foundations
title: Clustering Foundations
summary: How unsupervised clustering reveals latent structure without labels.
concepts:
  - concept.clustering
  - concept.unsupervised_learning
  - concept.noise
related_docs:
  - doc.first_principles_and_reverse_engineering
status: evergreen # draft | seed | evergreen
created: 2026-11-21
updated: 2026-11-21
---
```

- `id` (required): Stable identifier prefixed with `doc.` in `snake_case`.
- `title` (required): Human-readable title.
- `summary` (optional): 1–2 sentence overview for search results and graph previews.
- `concepts` (optional): Canonical `concept.*` IDs from `concepts.json`.
- `related_docs` (optional): Canonical `doc.*` IDs.
- `status` (optional, default `seed`): `draft` documents are hidden from public/static exports.

### Body & Linking
- Standard GitHub-Flavored Markdown (GFM).
- External links and citations live directly in the Markdown body (e.g., inline links or a `## 參考資料` / `## References` section) so every `.md` file remains 100% self-contained in plain text.
- Supports explicit wiki-links (`[[concept.clustering]]` or `[[doc.clustering_foundations]]`) and relative asset links (`./diagram.svg`).
- Reader may also highlight terms matching Ontology `labels` / `aliases` for inline Concept Hover Cards.

### Notes / Marginalia Section
- The Reader's **Notes area** reads and writes a dedicated trailing section headed by `## 備註` (or `## Notes`).
- Saving from the Notes panel only replaces content inside that section (creating `## 備註` at the end of `index.md` if absent), preserving frontmatter and main body untouched.

---

## 3. Sentence-Level Comments (`comments.json`)

Stored alongside `index.md` inside the Document Bundle so the Markdown body stays 100% clean.

```json
{
  "version": 1,
  "doc_id": "doc.clustering_foundations",
  "comments": [
    {
      "id": "cmt_20261121_01",
      "quote": "Clustering reveals latent group structure in unlabeled data.",
      "prefix": "Unlike supervised classification, ",
      "suffix": " It relies on a meaningful notion of distance.",
      "body": "Worth connecting this directly to Representation Learning / embeddings later.",
      "resolved": false,
      "created_at": "2026-11-21T08:45:00+08:00",
      "updated_at": "2026-11-21T08:45:00+08:00"
    }
  ]
}
```

- `quote` + `prefix` + `suffix` allow resilient re-anchoring even if surrounding paragraphs are edited.

---

## 4. Ontology (`knowledge/data/ontology/concepts.json`)

Compatible with `Ludwigia`'s ontology schema (`concept_id`, `labels`, `aliases`, `contexts`), extended with `kind` and directional `relations` for Nexus's Knowledge Graph.

```json
{
  "version": 1,
  "concepts": [
    {
      "concept_id": "concept.clustering",
      "kind": "task",
      "labels": {
        "en": "Clustering",
        "zh-Hant": "分群",
        "zh-Hans": "聚类"
      },
      "aliases": ["clustering", "cluster analysis", "分群分析"],
      "contexts": {
        "en": "Clustering is an unsupervised learning task. It groups similar data points together to reveal hidden structure in unlabeled data.",
        "zh-Hant": "分群是一種非監督式學習任務。它把彼此相似的資料點分到同一群，用來揭露未標註資料中的潛在結構。"
      },
      "relations": [
        { "type": "is_a", "target": "concept.unsupervised_learning" },
        { "type": "contrasts_with", "target": "concept.supervised_learning" }
      ]
    }
  ]
}
```

### Rules
- `concept_id`: Stable `concept.<snake_case>` ID.
- `labels` & `contexts`: `en` and `zh-Hant` required; `zh-Hans` optional (for frictionless compatibility with `Ludwigia`).
- `contexts` style: Always state **what it is** (category anchor) first, then **what it does / its role**.
- `kind` (optional): `task` | `method` | `principle` | `architecture` | `metric` | `framework` | `concept`.
- `relations[].type`:
  - Taxonomic / structural: `is_a`, `part_of`, `generalizes`, `example_of`
  - Functional / causal: `depends_on`, `enables`, `solves`, `used_in`, `influences`
  - Associative / comparative: `contrasts_with`, `relates_to`

---

## 5. Generated Knowledge Graph Contract

Generated automatically by the Indexer (never hand-edited):

- **Nodes**:
  - `type: "concept"` (from `concepts.json`)
  - `type: "document"` (from `index.md`, excluding `status: "draft"` in static/public exports)
- **Edges**:
  - Concept → Concept: `is_a`, `part_of`, `generalizes`, `example_of`, `depends_on`, `enables`, `solves`, `used_in`, `influences`, `contrasts_with`, `relates_to`
  - Document → Concept: `explains` (frontmatter `concepts`) and `mentions` (inline links / alias hits)
  - Document → Document: `links_to` (`related_docs` or `[[doc.*]]`)
