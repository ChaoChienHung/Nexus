# Handoff

## Snapshot

- Updated: 2026-11-26. Workspace: `/Users/ludwigchao/Desktop/Ludwig/Projects/Nexus` (`main` branch).
- Stopping point: Implemented the Nexus Hero landing page (`HomeView.tsx` with Hero → About Nexus → 3/4 icon option cards + clickable brand title), renamed Mentorion nav label to `Mentorion`, added `MENTORION_PORT` fallback alongside `MENTORION_API_URL`, `GET /api/capabilities`, `/api/integrations/mentorion/*` proxy, startup probe + hot-unlock, and lazy `MentorionView.tsx`. In sibling `Mentorion`, added flexible port (`MENTORION_PORT`/`PORT`), `GET /health`, `logs/` in `.gitignore`, user-customizable schema mapping & folder sync (`schema_source.py` + `/api/schema-sync/preview|import` + `source_doc_id`), Editorial Minimal Reading Mode (`EditorialReaderView.tsx`), and Schema Source UI (`SchemaSourcePanel.tsx`).
- Working tree: Local verified changes ready for review/commit.

## In-progress work

No active in-progress tasks remain. Completed deliverables are tracked in `REVIEW.md`.

## Suggested next steps

1. Test the installed `nexus-query` Global Skill from another workspace (e.g., `Halcyon`) by asking an agent to look up a concept or note in `Nexus-Vault`.
2. Drop raw materials (PDFs, transcripts, clippings) into `Nexus-Vault/raw/` and test compiling them into `Nexus-Vault/wiki/` + `data/ontology/concepts.json`.
3. Pick next engine enhancements in `Nexus` from `TODO.md` (e.g., creating new Documents/Concepts from UI, static GitHub Pages export, inline Terminology hover-cards, or long-term Hybrid GraphRAG).
