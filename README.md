# SLR NébulaLabs

Automated tooling for conducting **Systematic Literature Reviews (SLR)** using academic APIs and AI-assisted screening. Built for the NébulaLabs research team.

## What it does

Automates the identification and collection phase of an SLR:

1. Queries academic databases (OpenAlex) with multiple search strings
2. Normalizes and deduplicates results by DOI
3. Persists papers to a Supabase database
4. Logs PRISMA-compliant event counts for reporting

## Project structure

```
src/
├── run-search.js          # Entry point — define topic and search strings here
├── agents/
│   └── search-agent.js    # Core search, dedup, and save logic
├── utils/
│   └── prisma-logger.js   # PRISMA flow event and audit logging
└── db/
    ├── client.js          # Supabase client initialization
    └── test-connection.js # DB connectivity check
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file in the root:

```env
SUPABASE_URL=https://your-project.supabase.co
DB_KEY=your-supabase-anon-or-service-role-key
LRM_MODEL_KEY=your-llm-api-key
```

### 3. Test database connection

```bash
npm run test:db
```

## Running a search

Edit `src/run-search.js` to set your topic and search strings, then run:

```bash
node src/run-search.js
```

The script will:
- Create a `run` record in Supabase with status `searching`
- Query OpenAlex for each search string (200 results max per string)
- Deduplicate results across strings by DOI
- Save unique papers to the `studies` table
- Update the run status to `search_done`
- Log PRISMA events for each step

## Database tables

| Table | Purpose |
|---|---|
| `runs` | One record per SLR execution |
| `studies` | Individual papers found per run |
| `prisma_events` | PRISMA flow counts per stage |
| `audit_log` | General action audit trail |

## Tech stack

- **Runtime**: Node.js (ESM)
- **Database**: Supabase (PostgreSQL)
- **Academic API**: OpenAlex (free, no auth required)
- **Key dependency**: `@supabase/supabase-js`
