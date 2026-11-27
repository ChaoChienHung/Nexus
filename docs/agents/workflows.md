# Agent Workflows

Tool-agnostic workflow lifecycle (`Scope → Build → Eval → Schedule`) for designing, testing, and automating recurring knowledge tasks in Nexus without locking into a single vendor platform.

## Scope → Build → Eval → Schedule

1. **Scope**: Define a minimal v0 boundary—target inputs, allowed write paths, read-only sources (`raw/`), and explicit non-goals.
2. **Build**: Reuse existing shared modules (`app/server/query.ts`, `app/server/indexer.ts`, `npm run query`) and plain-text Git-friendly formats.
3. **Eval**: Verify against [evals.md](evals.md) criteria (round-trip preservation, link validity, bounded diffs) on manual runs first.
4. **Schedule**: Only after manual runs pass Eval consistently, attach a recurring schedule or batch cadence (e.g., via `/schedule` or cron) and route digests to `outputs/`.

## Candidate Workflows & Next Directions

- **`raw/` Inbox Compilation**: Convert `pending` raw sources into `seed` or `evergreen` Document Bundles under `wiki/` with `raw/...` provenance anchors, leaving `raw/` untouched.
- **Annotation Queue Triage**: Batch-process `## 備註` and unresolved `comments.json` entries into proposed edits or `outputs/` synthesis drafts for owner review.
- **Vault Health & Synthesis Digests**: Periodically scan for orphan notes, missing concept anchors, or unlinked concepts, writing dated summaries to `outputs/` without mutating reviewed Evergreen notes.
- **Next Directions**: Add per-workflow Eval fixtures before enabling unattended schedules.


## Annotation inventory and cleanup

Run from `app/` against the configured vault (or add `--vault <path>`):

- `npm run query -- annotations --text` lists note titles, paths, notes and unresolved comments with their quoted text; `npm run query -- annotations` emits JSON for agents. Add `--all` to include resolved comments, or `--public` to omit drafts.
- `npm run query -- cleanup-comments --dry-run` previews eligible sidecars. `npm run query -- cleanup-comments` removes empty or fully resolved `comments.json` files in document bundles, reporting skipped invalid or unresolved files. It never changes `index.md` or `raw/`.

Only remove a completed sidecar after the owner's annotations have been handled and marked resolved. The cleanup checks each entry for explicit `resolved: true`, retains malformed sidecars, and does not follow directory symlinks.
