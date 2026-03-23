# ADR-001: Architecture of the SLR Automation Tool

**Status:** Accepted
**Date:** 2026-03-15
**Authors:** NébulaLabs

---

## Context

Conducting a Systematic Literature Review (SLR) requires searching multiple academic databases with multiple search strings, collecting thousands of papers, deduplicating them, and screening them for relevance. This process is manual, repetitive, and error-prone when done by hand. The goal is to automate the identification stage of the PRISMA flow.

---

## Decision 1: Node.js with ES Modules as runtime

**Chosen:** Node.js (ESM, `"type": "module"`)

**Alternatives considered:**
- Python — common in academic tooling, but the team has stronger JS/TS experience
- Deno — cleaner ESM support but less ecosystem maturity

**Rationale:** The team is JS-native. The Supabase JS client is first-class and well-maintained. No significant computation or ML is happening in this layer, so runtime performance is not a differentiator.

---

## Decision 2: Supabase as the database

**Chosen:** Supabase (hosted PostgreSQL + JS client)

**Alternatives considered:**
- Local PostgreSQL — requires infra management
- SQLite — not suitable for multi-user or future API access
- MongoDB — no benefit for structured academic metadata

**Rationale:** Supabase provides a managed PostgreSQL instance with a simple JS client, built-in auth, and a dashboard for inspecting data during development. The free tier is sufficient for SLR-scale data volumes. The `service_role` key gives full table access from the Node.js backend without RLS complications.

---

## Decision 3: OpenAlex as the primary academic database

**Chosen:** OpenAlex API (`api.openalex.org`)

**Alternatives considered:**
- PubMed — biomedical focus, less relevant for CS/engineering topics
- Semantic Scholar — good API but rate limits are more restrictive
- Scopus / Web of Science — require institutional licenses

**Rationale:** OpenAlex is free, has no authentication requirement (just a `mailto` param for polite pool), covers 250M+ works across all disciplines, and provides structured metadata including abstracts as inverted indexes, DOIs, authorships, and open access status.

**Known limitation:** Abstracts are stored as inverted indexes (word → positions) and must be reconstructed before use. This is handled in `reconstructAbstract()` in `search-agent.js`.

---

## Decision 4: Agent-based code structure

**Chosen:** Separate `agents/` directory with one agent per SLR stage

**Rationale:** An SLR has distinct phases (identification → screening → extraction → synthesis). Each phase will become its own agent with its own logic, inputs, and outputs. This keeps concerns separated and allows phases to be run independently.

Current agents:
- `search-agent.js` — identification phase

Planned agents:
- `screening-agent.js` — title/abstract screening (LLM-assisted)
- `extraction-agent.js` — data extraction from full text
- `synthesis-agent.js` — summary and reporting

---

## Decision 5: PRISMA-compliant event logging

**Chosen:** A `prisma_events` table that records counts at each flow stage

**Rationale:** The PRISMA 2020 framework requires reporting how many records were identified, deduplicated, screened, and included at each stage. Rather than reconstructing these numbers after the fact, we log them in real time as each operation completes. This makes generating the PRISMA flow diagram straightforward at the end of the review.

PRISMA stages tracked:
| Stage | Events logged |
|---|---|
| Identification | records per search string, total before dedup, duplicates removed, total after dedup |
| Screening | (planned) records screened, excluded with reason |
| Inclusion | (planned) records included in final review |

---

## Decision 6: Deduplication by DOI at the run level

**Chosen:** Check DOI uniqueness scoped to `run_id` before insertion

**Alternatives considered:**
- Global deduplication across all runs — would prevent re-running searches for the same topic
- In-memory deduplication only — would not catch papers already in DB from partial runs

**Rationale:** Scoping deduplication to the current run allows the same paper to appear in different runs (different topics or time ranges) while still preventing duplicates within a single SLR execution. Papers without a DOI are not deduplicated and may appear multiple times.

**Known limitation:** ~15-20% of papers in OpenAlex lack a DOI. These are not deduplicated.

---

## Data flow

```
run-search.js
    │
    └── runSearchAgent(topic, searchStrings, options)
            │
            ├── supabase: insert run (status: searching)
            │
            ├── for each searchString:
            │       ├── searchOpenAlex() → raw results
            │       ├── normalizeRecord() → structured paper objects
            │       └── logPrismaEvent() → prisma_events
            │
            ├── deduplicateStudies() → mark is_duplicate by DOI
            ├── logPrismaEvent() → duplicates_removed, after_dedup
            │
            ├── saveStudies() → insert in batches of 100
            │
            └── supabase: update run (status: search_done)
```

---

## Consequences

- The system is currently write-only from the agent perspective — no read-back or validation after insertion.
- Batch size of 100 is a pragmatic choice based on Supabase's default request size limits.
- The `LRM_MODEL_KEY` in `.env.example` anticipates a future LLM screening step but is not yet used.
- Re-running the same search will create a new `run` and insert new `studies` records; old runs are not overwritten.
