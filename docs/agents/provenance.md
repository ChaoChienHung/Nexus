# Provenance & Failure Log

Append-only record of agent workflow experiments, prompt/boundary failures, and the durable guardrails created in response. Keeping failure provenance explicit prevents new sessions or different models from repeating the same mistakes.

| Date | Workflow / Change | What was tried / failed | Durable fix / Guardrail |
| --- | --- | --- | --- |
| 2026-11-27 | Private Vault vs. Public Demo Separation | Agents could mistake `Nexus/knowledge/` for personal notes when `NEXUS_KNOWLEDGE_DIR` is configured externally. | Require checking `app/.env.local` before editing notes; isolate private vaults in sibling `Nexus-Vault`. |
| 2026-11-27 | Compiled SSOT vs. Generated Outputs | Hand-editing generated index/graph outputs or maintaining a manual `INDEX.md` causes drift from `.md` and `concepts.json`. | Treat `wiki/` + `concepts.json` as SSOT; regenerate strictly via `cd app && npm run index` and protect writers with `npm test`. |

<!-- Append new rows above as workflows evolve. -->
