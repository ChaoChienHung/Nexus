# Updating the Knowledge Graph

Nexus never requires you to hand-edit graph coordinates or edge lists. The Knowledge Graph is **automatically generated** from two sources:

1. **Document Bundles** (`knowledge/notes/**/index.md`) — automatically produce Document nodes and `explains`, `mentions`, `links_to`, and `cites` edges.
2. **Curated Metadata** (`knowledge/data/ontology/concepts.json` and `knowledge/data/references.json`) — define canonical Concept nodes, Concept-to-Concept semantic relations, and shared Reference nodes.

---

## Step-by-Step Workflow When Adding a New Note

### 1. Create the Document Bundle
Create a folder anywhere under `knowledge/notes/` (any category depth works; use clean Title Case for category folders) containing `index.md`:

```text
knowledge/notes/<Category/...>/<doc-slug>/index.md
```

Fill in the frontmatter with stable IDs:

```yaml
---
id: doc.rq_kmeans
title: RQ-KMeans & Semantic IDs
summary: Residual quantization k-means for building hierarchical discrete item identifiers.
concepts:
  - concept.clustering
  - concept.representation_learning
references:
  - ref.bengio_representation_2013
related_docs:
  - doc.clustering_foundations
status: seed # draft | seed | evergreen
created: 2026-11-21
updated: 2026-11-21
---
```

What updates **automatically** from `index.md`:
- `concepts` → `Document --explains--> Concept`
- Inline `[[concept.*]]` in the body (if not already in frontmatter `concepts`) → `Document --mentions--> Concept`
- `related_docs` and inline `[[doc.*]]` → `Document --links_to--> Document` (and automatic backlinks)
- `references` → `Document --cites--> Reference`

### 2. Add New Concepts or Concept Relations (Only When Needed)
If your note introduces a **new core concept** not yet in `knowledge/data/ontology/concepts.json`, add an entry:

```json
{
  "concept_id": "concept.residual_quantization",
  "kind": "method",
  "labels": {
    "en": "Residual Quantization",
    "zh-Hant": "殘差量化"
  },
  "aliases": ["RQ", "residual vector quantization"],
  "contexts": {
    "en": "Residual Quantization is a vector quantization method. It iteratively quantizes the remaining approximation error across multiple stages to build compact hierarchical codes.",
    "zh-Hant": "殘差量化是一種向量量化方法。它透過多階段反覆對前一層的殘差誤差進行量化，將連續向量壓縮成階層式的離散編碼。"
  },
  "relations": [
    { "type": "depends_on", "target": "concept.clustering" },
    { "type": "enables", "target": "concept.representation_learning" }
  ]
}
```

#### Supported Concept → Concept Relation Types

| Category | Relation | Meaning (`Source` → `Target`) |
| --- | --- | --- |
| Taxonomic / Structural | `is_a` | Source is a specific kind of Target |
| | `part_of` | Source is a component inside Target |
| | `generalizes` | Source is a broader abstraction of Target |
| | `example_of` | Source is a concrete instance of Target |
| Functional / Causal | `depends_on` | Source requires or builds on Target |
| | `enables` | Source makes Target possible or more effective |
| | `solves` | Source addresses or mitigates Target |
| | `used_in` | Source is commonly applied inside Target |
| | `influences` | Source shapes or affects Target |
| Associative / Comparative | `contrasts_with` | Source is conceptually contrasted with Target |
| | `relates_to` | General bidirectional / loose conceptual link |

### 3. Add New External References (Only When Needed)
If your note cites a new paper, book, or article, add it once to `knowledge/data/references.json` with a `ref.<snake_case>` ID, then list it under `references:` in your document frontmatter.

### 4. Validate & Refresh the Knowledge Graph
Run the Indexer to validate that every `concept.*`, `ref.*`, and `doc.*` ID resolves cleanly with zero warnings:

```bash
cd app && npm run index
```

- While running `npm run dev` on `http://localhost:4321`, the local API re-indexes on demand — simply reload the page (or save in the Reader) to see your new nodes and edges immediately.
- If `npm run index` prints any warning (e.g., an unknown `concept.*` ID or typo), fix it before committing to Git.
