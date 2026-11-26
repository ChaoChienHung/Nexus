# Composable Local-First Suite (Design Philosophy)

Nexus is designed following the **Unix philosophy for personal knowledge tools**: each project does **one job well**, stays 100% usable standalone, and composes cleanly with sibling tools through open plain-text schemas and lightweight local APIs.

---

## 1. Core Principles

### Single-Purpose Tools, Zero Lock-In
- **Nexus** focuses on **knowledge organization & synthesis**: plain-text Document Bundles (`wiki/`), direct editing, sentence comments (`comments.json`), `## 備註`, Ontology Terminology, Knowledge Graph, and personal review status (`review: fresh | reviewed`).
- **Mentorion** focuses on **spaced repetition & active recall**: SM-2 scheduling, Review Calendar (Planit), daily task/deficit tracking, Quiz generation, and grading (`ReviewLog`).
- Neither tool should bloat into a monolith that tries to do everything, and neither should hard-require the other to run.

### Open, User-Customizable Document Schema (The Bridge)
- Tools communicate through a **minimal, open Markdown Document Schema** rather than proprietary databases or tight coupling:
  - **Required**: stable document `id`, `title`, and Markdown body.
  - **Optional**: `summary`, `status`, `review` (`fresh` | `reviewed`), `concepts`, `updated`.
- **Customizable field mapping**: Consumer tools like Mentorion should not hard-code Nexus-only conventions. By allowing users to configure a lightweight schema mapping (e.g., mapping frontmatter keys for `id`, `title`, `review`, or `tags`), Mentorion can work out of the box with `Nexus-Vault`, plain Markdown folders, or other knowledge bases — using a generic `source_doc_id` rather than a Nexus-specific foreign key.

### Clear SSOT Boundaries
When multiple tools share a knowledge directory, each layer has exactly one Single Source of Truth (SSOT):
- **Content & Knowledge Structure SSOT**: Plain-text Markdown + Ontology JSON (e.g., `Nexus-Vault/wiki/` and `data/ontology/concepts.json`), authored and refined in Nexus (or any text editor).
- **Scheduling & Execution SSOT**: Spaced-repetition state (SM-2 `ease_factor`, `interval_days`, `repetitions`, `Task`, `ReviewLog`, `JournalEvent`) owned by Mentorion's SQLite database.

---

## 2. Why Nexus Is the Composition Hub

When both Nexus and Mentorion are present, **Nexus acts as the unified composition shell (home base)**:

- **Preserves the full knowledge workspace**: Nexus already mounts the knowledge vault (`NEXUS_KNOWLEDGE_DIR`) and hosts the Reader/Editor, Terminology Inspector, and interactive Knowledge Graph. Hosting Mentorion's capabilities inside Nexus keeps all of those views intact.
- **Avoids crowding out Mentorion**: Trying to compose everything inside Mentorion would either strip away Nexus's Knowledge Graph and Terminology or force Mentorion to re-implement a full knowledge-base UI.
- **Natural progression**: Just as Nexus mounts a private `Nexus-Vault`, Nexus can optionally mount a running Mentorion backend (e.g., via `MENTORION_API_URL`) to surface SM-2 due status, Review Calendar, and Quiz flows alongside each note.

---

## 3. Standalone vs. Composed Modes

| Mode | What Runs | User Experience |
| :--- | :--- | :--- |
| **Standalone Nexus** | Nexus + Knowledge Vault | Full Reader/Editor, sentence comments, `## 備註`, Terminology, Knowledge Graph, and manual `fresh` / `reviewed` tracking. |
| **Standalone Mentorion** | Mentorion + any schema-compatible Markdown folder | Editorial Minimal Reading Mode (matching Nexus's visual comfort) + SM-2 scheduling, Planit Calendar, and Quiz/grading — **without** Terminology or Knowledge Graph, staying focused on active recall. |
| **Composed Suite (Nexus + Mentorion)** | Nexus (Hub) + Knowledge Vault + Mentorion API | One unified home base in Nexus: full Knowledge Graph & Terminology + live SM-2 review schedules, Quiz launch/grading from notes, automatic `review: reviewed` sync, and optional Graph-aware cross-concept quizzes (`subgraph`). |

---

## 4. Shared Visual Language

Even when run standalone, sibling tools in the suite should share the same **Editorial Minimal** design tokens (warm paper light theme, Zinc dark theme, comfortable reading typography, and calm accent hierarchy) so moving between standalone and composed modes feels seamless.
