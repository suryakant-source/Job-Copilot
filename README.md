# AI Job Search Co-Pilot 🤖🚀

> A production-quality, local-first system that replaces manual spreadsheet job workflows entirely. Ingest job postings, score them against your resume with explainable reasoning, generate tailored ATS-optimized application assets, continuously discover new openings, and view your entire pipeline in a live terminal dashboard.

---

## Architecture Diagram

```mermaid
graph TD
    User([Candidate / CLI User])
    CLI[job-copilot CLI Node.js / TypeScript]
    DB[(SQLite Database job-copilot.db)]
    Watcher[Watcher Daemon job-copilot watch]
    Parsers[Parsers: Greenhouse, Lever, Ashby, Workday]
    Scoring[Scoring Engine: Composite 0-100 & Tiers]
    Tailor[Tailoring Engine: ATS Resume & PDF Generator]
    Validator[Truthfulness Validator: Claim Diffing]
    LLM[Provider-Agnostic LLM Adapter: OpenAI / Anthropic / Ollama]
    API[JSON-RPC / HTTP API :3847]
    TUI[Go TUI Dashboard job-copilot-dash: Bubble Tea + Lip Gloss]

    User -->|npx job-copilot <cmd>| CLI
    CLI --> Parsers
    CLI --> Scoring
    CLI --> Tailor
    Tailor --> Validator
    Scoring --> LLM
    CLI --> DB
    Watcher --> Parsers
    Watcher --> Scoring
    Watcher --> DB
    DB --> API
    API --> TUI
    DB --> TUI
```

---

## Module Breakdown

1. **Module 1 — Job Ingestion & Parsing (`job-copilot add <url>`)**
   - Native parsers for Greenhouse, Lever, Ashby, Workday, SmartRecruiters.
   - Generic Readability extraction fallback for non-standard career pages.
   - Normalizes titles, locations, salaries, required skills, and seniority.
   - SHA-256 company+title+location deduplication.

2. **Module 2 — Fit Scoring Engine (`job-copilot score <job-id>`)**
   - Evaluates resume fit on a 0–100 scale across 6 weighted dimensions:
     - Skills match (35%) — semantic synonyms & framework overlap
     - Experience & Seniority alignment (25%)
     - Career trajectory fit (15%)
     - Compensation fit (10%)
     - Location & Remote policy fit (10%)
     - Company signals (5%)
   - Classifies jobs into Tiers: **Tier A (80+)**, **Tier B (60–79)**, **Tier C (40–59)**, **Tier D (<40)**.
   - Generates an explainable scorecard markdown report in `./reports/`.

3. **Module 3 — Tailored Resume Generation (`job-copilot tailor <job-id>`)**
   - Single-column, ATS-compliant Markdown + PDF resume generation.
   - Strict truthfulness validator diffing every claim/metric against `resume.md`.
   - Generates `./applications/<company-slug>/`:
     - `resume.pdf` (Rendered ATS PDF)
     - `resume.md` (Tailored markdown source)
     - `changes.md` (Diff summary & ATS coverage score before/after)
     - `cover-letter.md` (Optional grounded cover letter)

4. **Module 4 — Automated Job Discovery (`job-copilot watch`)**
   - Scans company job boards listed in `watchlist.yaml` on a schedule.
   - Maintains a persistent `watcher_seen` ledger so jobs are reported once.
   - Generates daily Markdown digests in `./digests/YYYY-MM-DD.md`.

5. **Module 5 — Application Pipeline Dashboard (`job-copilot-dash`)**
   - Terminal UI built with Go (Bubble Tea + Lip Gloss).
   - Kanban-style pipeline (`Discovered → Scored → Tailored → Applied → Screening → Interviewing → Offer → Rejected`).
   - Vim keybindings (`h/j/k/l` navigation, `H/L` move cards, `Tab` view toggle, `Enter` detail pane).

---

## 5-Minute Quickstart

### 1. Prerequisites
- **Node.js**: v20+
- **npm**: v10+
- **Go** (optional for building native `job-copilot-dash` binary): 1.21+

### 2. Installation
```bash
# Clone repository
git clone https://github.com/your-username/job-copilot.git
cd job-copilot

# Install dependencies and build Node CLI
npm install
npm run build
```

### 3. Configure Your Profile
Edit `resume.md` with your ground-truth experience, and customize `config.yaml` and `watchlist.yaml`.

### 4. Basic CLI Usage
```bash
# Ingest & score a job posting
node dist/cli.js add https://boards-api.greenhouse.io/v1/boards/stripe/jobs/12345

# Score an existing job
node dist/cli.js score gh_1a2b3c4d5e6f

# Tailor resume + PDF + cover letter
node dist/cli.js tailor gh_1a2b3c4d5e6f --cover-letter

# Run single-pass watchlist scan
node dist/cli.js watch --once

# Start local HTTP API server
node dist/cli.js server --port 3847
```

### 5. Launch Go TUI Dashboard
```bash
cd dashboard
go run main.go
```

---

## Running Tests

```bash
# Run unit & integration test suite
npm test

# Run Go tests
cd dashboard && go test ./...
```

---

## License

MIT © Antigravity AI Systems
