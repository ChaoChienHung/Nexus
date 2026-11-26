# Note-Writing Philosophy & Mindset

Nexus notes are written to be **absorbed quickly, recalled easily, and refined over time** — not to dump walls of textbook prose.

---

## Core Principles

### 1. Keep Paragraphs Short & Scannable
- Limit each paragraph to **one clear idea** (ideally 2–4 lines).
- Long, dense paragraphs create cognitive friction and make it hard to follow the thread when revisiting a note months later.
- Prefer short paragraphs, clear subheadings, and structured lists over walls of text.

### 2. Progressive Zoom-In: Abstract First, Details Second
Always move from **high-level intuition** down to **minor details**, not the other way around:
1. **Start at the abstract level**: What problem does this solve? What is the overarching shape or big direction?
2. **Bridge with an analogy**: Map the unfamiliar idea onto something already intuitive.
3. **Unfold into details**: Only after the mental model clicks, expand into formulas, mechanics, trade-offs, and implementation specifics.

### 3. Imperfect Analogies Are a Feature, Not a Bug
- An analogy **does not need to be 100% technically identical** to be valuable.
- Its purpose is to establish a rough, accurate-enough mental scaffold quickly so you can navigate the whole domain.
- **Just-in-time refinement**: Subtle differences and edge cases are much easier to internalize *when you actually encounter them* in practice. Learning the big direction first and calibrating the fine differences later yields much higher learning efficiency than trying to memorize every caveat upfront.

### 4. Synthesize Without Loss: Organize, Never Over-Compress (`raw/` → `wiki/`)
- **Goal: highly detailed, lossless synthesis** — *ensure that no data is condensed away and no meaningful information is lost.*
- **Organization (統整), not lossy compression (壓縮)**: When compiling a new source from `raw/` into `wiki/`, retain **all** substantive details, knowledge points, mechanisms, numbers, formulas, examples, trade-offs, and nuances from the original material.
- **Scannable ≠ shallow**: Keeping paragraphs short (Principle 1) and leading with the big picture (Principle 2) is about *layering and readability*, never an excuse to summarize away detail. Instead of condensing dense content into vague high-level bullets, break it down into well-structured subheadings, short paragraphs, lists, or comparison tables so every detail stays intact and easy to read.
- **Split rather than shrink**: If a single `raw/` artifact is too rich for one note, split it into multiple focused Document Bundles linked via `related_docs` / `[[doc.*]]` rather than compressing everything into a superficial overview.

### 5. Follow Natural Reading Logic & Coherent Flow（符合閱讀邏輯）
- **Exhaustive AND coherent**: Completeness alone is not enough — a note must read like a well-paced explanation rather than a shuffled pile of extracted facts.
- **Causal & progressive sequencing**: Order sections so each concept prepares the ground for the next (e.g., historical motivation / problem statement → core intuition & analogy → formal specification / mathematical rules → concrete worked example or empirical results → edge cases, heuristics, and caveats).
- **Explicit transitions**: Connect sections with brief bridging sentences explaining *why* the next mechanism or rule exists (e.g., *why* a floor constant like `1.3` was introduced after observing real-world behavior), so the reader understands both *what* the rule is and *why* it took that exact form.

---

## Recommended Note Blueprint

When writing or compiling a new note in `knowledge/wiki/` (especially from `raw/`), aim for this flow — making sure every substantive detail from the source lands in the right layer rather than being dropped:

1. **The Big Picture (1 short paragraph)**: What it is and why it matters.
2. **Intuition / Analogy**: A concrete, relatable analogy to anchor the mental model (even if approximate).
3. **How It Actually Works (Complete Details)**: Full, lossless breakdown of every mechanism, data point, formula, example, and step in short, digestible paragraphs, subheadings, or lists.
4. **Nuances, Caveats & Calibration**: Edge cases, trade-offs, limitations, and places where the rough analogy breaks down (both from the original source and added over time).
5. **`## 備註`**: Open questions, next topics to connect, and personal takeaways.
