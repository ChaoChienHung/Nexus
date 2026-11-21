# Public Engine + Private Vault Setup (`Nexus` + `Nexus-Vault`)

Nexus is designed so you can keep the **application engine** (`Nexus`) public/open-source while storing your real personal knowledge base in a separate **Private GitHub repository** (e.g., `Nexus-Vault`).

---

## Why Separate Repos?

- **Zero accidental leaks**: Your private notes, sentence comments, and Ontology live in a dedicated Private repo with completely isolated Git history.
- **Full Git backup & version control**: Your personal knowledge base still gets full Git history, clean diffs, and cloud sync on GitHub.
- **No git-submodule friction**: No submodule pointer commits or detached HEAD issues — just one local environment variable.
- **Instant public demo**: The public `Nexus` repo retains its lightweight `knowledge/` sample dataset so anyone cloning `Nexus` can run a working demo immediately.

---

## Vault Directory Structure

Your private vault repository (`Nexus-Vault`) mirrors the exact layout of `Nexus/knowledge/`:

```text
Nexus-Vault/
├── README.md
├── .gitignore
├── notes/
│   └── <Category/...>/<doc-slug>/
│       ├── index.md
│       ├── comments.json      # Optional, created by Reader
│       └── <asset.*>          # Optional local images/files
└── data/
    ├── ontology/
    │   └── concepts.json
    └── references.json
```

---

## Step-by-Step Setup

### 1. Create the Private Vault Repo on GitHub
Create a **Private** repository on GitHub (for example, `https://github.com/<your-username>/Nexus-Vault.git`).

### 2. Initialize & Push Your Local Vault
Place `Nexus-Vault` next to `Nexus` (e.g., `Projects/Nexus-Vault`):

```bash
cd /path/to/Nexus-Vault
git init -b main
git add .
git commit -m "chore: initialize Nexus-Vault"
git remote add origin https://github.com/<your-username>/Nexus-Vault.git
git push -u origin main
```

### 3. Connect `Nexus` to Your Private Vault
Inside `Nexus/app/`, copy `.env.example` to `.env.local` (already gitignored):

```bash
cd /path/to/Nexus/app
cp .env.example .env.local
```

Edit `app/.env.local` and set `NEXUS_KNOWLEDGE_DIR` (supports absolute paths, `~/`, or paths relative to `Nexus/app/`):

```env
NEXUS_KNOWLEDGE_DIR=../../Nexus-Vault
```

### 4. Start Nexus & Verify
Restart the dev server or run the Indexer:

```bash
cd /path/to/Nexus/app
npm run dev
```

Check the terminal startup log to confirm it mounted your private vault:

```text
[nexus] Knowledge directory (dotenv): /path/to/Nexus-Vault
```

---

## Daily Workflow

- **Writing / Editing Notes**: Edit directly in the Reader (`http://localhost:4321`) or inside `Nexus-Vault/` in your IDE, then commit & push inside `Nexus-Vault/`.
- **Validating Links**: Run `cd /path/to/Nexus/app && npm run index` — it automatically reads `NEXUS_KNOWLEDGE_DIR` and validates your private vault.
- **Updating the Nexus Engine**: Pull or commit engine updates in `Nexus/` without touching your private notes.
- **Temporarily Switching Back to the Demo Dataset**: Run `NEXUS_KNOWLEDGE_DIR=../knowledge npm run dev` (shell env vars take precedence over `.env.local`).
