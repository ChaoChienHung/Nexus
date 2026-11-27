# AGENTS

## Project boundary

- **Nexus** is a local-first personal knowledge base managed in a GitHub repository. It combines Markdown (`.md`) knowledge documents (per-document bundles under `wiki/`), structured JSON (`.json`) metadata (Ontology concepts, sentence comments), a lightweight `localhost` Reader & Editor application (Node.js / TypeScript), and a concept-centric Knowledge Graph.
- **Compiled SSOT & Knowledge Pipeline**: `wiki/` (Document Bundles) and `data/ontology/concepts.json` (Ontology) are the compiled Single Source of Truth indexed by `npm run index` into search indexes, backlinks, and the Knowledge Graph. Never edit both source files and generated outputs by hand, and never maintain a manual `INDEX.md`.
- **Raw Dropzone & Human-in-the-Loop Annotations**: Vaults may also include `raw/` (unorganized raw materials such as PDFs, clippings, or transcripts — **AI read-only**, serving as provenance anchors) and `outputs/` (evolving folder for AI-generated reports/summaries). Reader `## 備註` and unresolved `comments.json` entries act as the owner's reading-time annotation queue for AI batch processing.
- **Public Engine vs. Private Vault**: `Nexus/knowledge/` is the public demo showcase dataset. Before editing real personal notes, always check `app/.env.local` for `NEXUS_KNOWLEDGE_DIR` (e.g., `../../Nexus-Vault`) — never write private personal notes into `Nexus/knowledge/`.
- **Composable Suite Boundary (Nexus + Mentorion)**: Nexus is the Composition Hub (`docs/architecture/composable-suite.md`) that discovers a sibling Mentorion backend via `~/.mentorion/runtime.json` or `MENTORION_API_URL`. External tools like Mentorion treat `Nexus-Vault` as **read-only** (never creating notes or persisting quiz question banks inside `wiki/`; Mentorion owns its own SQLite schedules and centralized `questions` bank, and only syncs lightweight `review: reviewed` status via Nexus API).
- Because the Reader supports direct editing, sentence-level comments, and notes/marginalia persisted back to source files, all write operations through the local API must preserve clean, human-readable, Git-friendly `.md` and `.json` formats.
- Keep the core workflow usable with plain text tools (any Markdown editor + Git) and a minimal Node.js/TypeScript local toolchain for the Reader app.

## Documentation ownership

- Before working, read `README.md` sections `Terminology` and `Repository Map` for shared vocabulary and folder-level responsibilities.
- Keep reader-facing navigation and workflow in `README.md`; use this file for agent-specific instructions and invariants. Keep exact data schemas and system contracts in `docs/specs/` once created.
- Update the repository map in `README.md` only when a folder's responsibility changes. Do not maintain a file-by-file map here.
- At the start of a new agent session, read `HANDOFF.md` for the previous stopping point; verify it against the user's latest request and working tree. `TODO.md` owns unfinished and long-term work; `REVIEW.md` owns completed work awaiting human review. Update `HANDOFF.md` when in-progress state changes or when no work remains; aim for at most 2,000 tokens and enforce a 6 KiB UTF-8 hard limit.

## Do and don't

- Do inspect existing project files and `package.json` (once created) before choosing a library, framework, or version.
- Do follow the Ontology concept rules (stable `concept.<snake_case>` IDs, multilingual labels/aliases, category-anchor-first contexts) when adding or normalizing concepts.
- Do keep `.md` documents human-readable and portable (avoid proprietary syntax that breaks plain Markdown viewing).
- Do insert a blank line when transitioning from a nested Markdown bullet list back to a top-level bullet for readability.
- Do keep changes focused and reuse existing components, schemas, and conventions once established.
- Don't hard-code duplicated concept definitions or hand-maintained graph edges, and don't add dependencies without confirming with the project owner.

## Non-regression rules

- Core `.md` documents and `.json` metadata must remain readable as plain text in the repository without requiring the Reader app.
- In-Reader edits, sentence comments, and notes/marginalia must write deterministically back to the source files without corrupting unrelated frontmatter or body text.
- Draft or private documents (once a visibility/draft flag is defined) must not appear in public listings or exported static builds.
- Do not add a second hand-maintained copy of generated indexes, backlinks, or Knowledge Graph data.

## Verification

- Verify documentation and file state with `git status --short`, and ensure `HANDOFF.md` stays under the 6 KiB UTF-8 limit.
- Run automated checks inside `app/`:
  - Type-check: `cd app && npm run typecheck`
  - Unit & round-trip regression tests: `cd app && npm test`
  - Ontology/document validation & index generation: `cd app && npm run index`
  - Production build: `cd app && npm run build`
- When the same mistake recurs, reproduce it, improve the module or schema boundary to remove the bad path where feasible, and add a targeted automated check.

## Safety and collaboration

- Routine read, edit, and targeted verification of documentation and agreed-upon code changes may be performed directly.
- Confirm scope before installing dependencies, scaffolding a new framework/app, performing destructive changes, renaming the workspace folder/repository, pushing, or deploying, unless the task already authorizes it.
- If a contract or requirement is unclear, report what you found, propose the smallest workable next step, and ask only for the missing decision.

## Examples and review

- Before concluding a task or preparing a PR, review the diff, relevant checks, generated files, and user-visible behavior; summarize any unverified area and record completed items awaiting human review in `REVIEW.md`.
- For high-risk behavior changes (such as Markdown/JSON round-trip writers or ontology/graph indexers), write a regression test before implementation when it catches a real failure mode.

## Where to look

- Shared terminology, repository map, setup, and everyday commands: `README.md`
- Tool-agnostic agent engineering docs (soft/hard guardrails, provenance log, evals, and workflows): `docs/agents/` (`guardrails.md`, `provenance.md`, `evals.md`, `workflows.md`)
- Unfinished tasks and decisions: `TODO.md`
- Completed work awaiting human review: `REVIEW.md`
- Previous agent's stopping point: `HANDOFF.md`
