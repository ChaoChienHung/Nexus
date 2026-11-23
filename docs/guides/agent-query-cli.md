# Agent Knowledge Graph Query CLI & Skill Guide

To let Coding Agents or LLMs query your Nexus Knowledge Graph without scanning the entire repository, Nexus provides a progressive-disclosure query engine (`app/server/query.ts`) and CLI (`npm run query`).

## Recommended Progressive-Disclosure Workflow

1. **Orient / Search first (low token):**
   ```bash
   cd /Users/ludwigchao/Desktop/Ludwig/Projects/Nexus/app
   npm run query -- search "Ontology"
   npm run query -- overview
   ```
2. **Explore Concept Neighborhood or Path:**
   ```bash
   npm run query -- subgraph concept.ontology --hops 2
   npm run query -- path concept.ontology concept.evergreen_note
   ```
3. **Read only the needed Document(s):**
   ```bash
   npm run query -- doc doc.getting_started_with_nexus --comments
   ```
4. **Check Reading-Time Annotation Queue (`comments.json` + `## 備註`):**
   ```bash
   npm run query -- annotations
   ```

All commands automatically resolve `NEXUS_KNOWLEDGE_DIR` from `app/.env.local` (or `--vault <path>`), and support `--public` (exclude drafts) and `--compact` (single-line JSON).

---

## Global Skill Template (`SKILL.md`)

Save the following as `~/.gemini/config/skills/nexus-query/SKILL.md` (Antigravity's global skills folder) so any agent in any workspace can query your personal `Nexus-Vault` on demand with near-zero idle context overhead:

```markdown
---
name: nexus-query
description: Query Ludwig's personal Nexus Knowledge Graph (Ontology concepts, 1-2 hop subgraphs, semantic paths, and evergreen notes) on demand via CLI without scanning the repository.
---

# Nexus Knowledge Graph Query

Use the Nexus CLI in `/Users/ludwigchao/Desktop/Ludwig/Projects/Nexus/app` to inspect concepts, relations, and notes via progressive disclosure:

1. Search concepts & documents first:
   `cd /Users/ludwigchao/Desktop/Ludwig/Projects/Nexus/app && npm run query -- search "<query>" --compact`
2. Expand 1-2 hop concept neighborhood (includes definitions, edges, and Top 3 related doc summaries):
   `cd /Users/ludwigchao/Desktop/Ludwig/Projects/Nexus/app && npm run query -- subgraph <concept_id> --hops 1 --compact`
3. Find shortest semantic path between two concepts:
   `cd /Users/ludwigchao/Desktop/Ludwig/Projects/Nexus/app && npm run query -- path <from_id> <to_id> --compact`
4. Fetch full Markdown only for the specific document(s) needed:
   `cd /Users/ludwigchao/Desktop/Ludwig/Projects/Nexus/app && npm run query -- doc <doc_id> --comments --compact`
5. Inspect pending reading annotations (`comments.json` + `## 備註`):
   `cd /Users/ludwigchao/Desktop/Ludwig/Projects/Nexus/app && npm run query -- annotations --compact`
```
