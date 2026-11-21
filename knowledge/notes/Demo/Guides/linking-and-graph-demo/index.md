---
id: doc.linking_and_graph_demo
title: Knowledge Graph & Linking Demo
summary: How frontmatter metadata and Ontology relations compile into color-coded Knowledge Graph edges and BM25 Top 3 related documents.
concepts:
  - concept.knowledge_graph
  - concept.fleeting_note
references:
  - ref.robertson_bm25
related_docs:
  - doc.welcome_to_nexus
status: seed
created: 2026-11-21
updated: 2026-11-21
---

# Knowledge Graph & Linking Demo

Open the **Knowledge Graph** view in the left sidebar to see how this note and [[doc.welcome_to_nexus]] connect automatically.

## How Edges Are Compiled

- **Frontmatter `concepts`** generate solid green `explains` arrows from this note to [[concept.knowledge_graph]] and [[concept.fleeting_note]].
- **Inline links** like [[concept.ontology]] (when not listed in frontmatter) generate light dotted `mentions` lines.
- **Mutual `related_docs`** between this note and [[doc.welcome_to_nexus]] merge into a single bidirectional ochre arrow.
- **Ontology `relations`** render distinct visual styles: solid blue arrows for hierarchy (`is a` / `part of`), dashed terracotta arrows for causal links (`depends on` / `enables`), double-headed crimson dashed arrows for `contrasts with`, and dotted lines for `relates to`.

## 備註

- Try clicking empty canvas space or pressing `Esc` in the Knowledge Graph to deselect a node.
