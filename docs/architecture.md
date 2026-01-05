# Architecture Overview

This document provides a high-level overview of the PMO Tool architecture.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                     Next.js App (React 18 + Tailwind)                   ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  ││
│  │  │Dashboard │ │ Meetings │ │  Kanban  │ │Decisions │ │ Risk Register│  ││
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          API LAYER (Next.js API Routes)                      │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐ │
│  │ /meetings │ │  /action- │ │/decisions │ │  /risks   │ │   /google/    │ │
│  │           │ │   items   │ │           │ │           │ │calendar/drive │ │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
┌───────────────────────┐ ┌─────────────────┐ ┌─────────────────────────────┐
│      SUPABASE         │ │   LLM SERVICES  │ │     GOOGLE APIS             │
│  ┌─────────────────┐  │ │ ┌─────────────┐ │ │ ┌──────────┐ ┌───────────┐  │
│  │   PostgreSQL    │  │ │ │   Gemini    │ │ │ │ Calendar │ │   Drive   │  │
│  │   + pgvector    │  │ │ │  (Primary)  │ │ │ │   API    │ │    API    │  │
│  │   + RLS         │  │ │ ├─────────────┤ │ │ └──────────┘ └───────────┘  │
│  ├─────────────────┤  │ │ │   GPT-5.2   │ │ └─────────────────────────────┘
│  │   Supabase      │  │ │ │  (Fallback) │ │
│  │     Auth        │  │ │ ├─────────────┤ │
│  └─────────────────┘  │ │ │   OpenAI    │ │
└───────────────────────┘ │ │ (Embeddings)│ │
                          │ └─────────────┘ │
                          └─────────────────┘
```

---

## Core Components

### Frontend (Next.js 16 + React 18)

| Component | Purpose |
|-----------|---------|
| Dashboard | At-a-glance view of due items, recent meetings |
| Meetings | Upload, process, and review meeting transcripts |
| Kanban Board | Visual action item management |
| Decision Log | Track decisions with categories and Smart IDs |
| Risk Register | Manage risks with severity matrix |
| Project Management | Milestones with Gantt visualization |

### API Layer (Next.js API Routes)

| Route Group | Purpose |
|-------------|---------|
| `/api/meetings/` | Meeting CRUD, processing, publishing |
| `/api/action-items/` | Action item updates |
| `/api/decisions/` | Decision CRUD, supersede workflow |
| `/api/risks/` | Risk updates |
| `/api/google/calendar/` | Calendar OAuth and events |
| `/api/google/drive/` | Drive OAuth, folders, sync |
| `/api/cron/` | Scheduled jobs (Drive polling) |

### Database (Supabase PostgreSQL)

- **Row-Level Security (RLS)**: Project-scoped access control
- **pgvector**: Semantic similarity for duplicate detection
- **HNSW Index**: Fast vector search on embeddings
- **Triggers**: Circular dependency prevention, Smart ID generation

### LLM Services

| Service | Model | Purpose |
|---------|-------|---------|
| Primary | Gemini 3 Pro Preview | Meeting processing, extraction |
| Fallback | GPT-5.2 | Used when Gemini fails |
| Utility | Gemini 2.0 Flash | JSON validation/repair |
| Embeddings | text-embedding-3-small | Semantic matching |

---

## Data Flow

### Meeting Processing Flow

```
1. INGEST                   2. PROCESS                  3. REVIEW
┌──────────────┐           ┌──────────────┐           ┌──────────────┐
│   Upload     │           │  Load Open   │           │   Display    │
│  Transcript  │──────────▶│   Items as   │──────────▶│   Proposed   │
│  (or Import) │           │   Context    │           │   Changes    │
└──────────────┘           └──────────────┘           └──────────────┘
                                  │                          │
                                  ▼                          │
                           ┌──────────────┐                  │
                           │  LLM Extract │                  │
                           │  (Primary →  │                  │
                           │   Fallback)  │                  │
                           └──────────────┘                  │
                                  │                          │
                                  ▼                          │
                           ┌──────────────┐                  │
                           │   Utility    │                  │
                           │   Validate   │                  │
                           │    JSON      │                  │
                           └──────────────┘                  │
                                  │                          │
                                  ▼                          ▼
                           ┌──────────────┐           ┌──────────────┐
                           │   Vector     │           │    User      │
                           │  Duplicate   │──────────▶│  Accept/     │
                           │   Check      │           │   Reject     │
                           └──────────────┘           └──────────────┘
                                                             │
                                                             ▼
                                                      4. PUBLISH
                                                      ┌──────────────┐
                                                      │   Commit     │
                                                      │   Changes    │
                                                      │   + Refresh  │
                                                      │  Embeddings  │
                                                      └──────────────┘
```

### Owner Resolution Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Direct Email   │─No─▶│  Project        │─No─▶│    Email        │
│  Match (Users)  │     │  Contacts Match │     │   Inference     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │Yes                    │Yes                    │Yes
        ▼                       ▼                       ▼
  ┌───────────┐          ┌───────────┐          ┌───────────┐
  │ Resolved  │          │ Resolved  │          │ Resolved  │
  └───────────┘          └───────────┘          └───────────┘
                                                       │No
                                                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Fuzzy Match   │◀─No─│  Conference     │◀─No─│     Unknown     │
│   (Needs Conf)  │     │  Room Heuristic │     │   (Manual)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Security Architecture

### Authentication

- **Provider**: Supabase Auth
- **Methods**: Google OAuth, Microsoft OAuth
- **Session**: JWT tokens with automatic refresh

### Authorization

| Layer | Mechanism |
|-------|-----------|
| API Routes | Supabase client authentication check |
| Database | Row-Level Security (RLS) policies |
| Admin Routes | Global role check (`admin` required) |
| Review Lock | Optimistic locking with TTL |

### Data Protection

- **Project Scoping**: Users only see assigned projects
- **RLS Policies**: Enforced at database level
- **OAuth Tokens**: Encrypted storage in `user_oauth_tokens`
- **Webhook Auth**: HMAC-SHA256 verification

---

## Integration Architecture

### Google Calendar

```
┌──────────┐     ┌─────────────┐     ┌────────────────┐
│  User    │────▶│   OAuth     │────▶│  Google        │
│  Profile │     │   Flow      │     │  Calendar API  │
└──────────┘     └─────────────┘     └────────────────┘
                        │                     │
                        ▼                     ▼
                 ┌─────────────┐       ┌────────────┐
                 │   Store     │       │  Fetch     │
                 │   Tokens    │       │  Events    │
                 └─────────────┘       └────────────┘
```

### Google Drive Auto-Ingestion

```
┌────────────────────────────────────────────────────────────────┐
│                    REAL-TIME PATH                               │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐│
│  │  Drive   │────▶│  Webhook │────▶│  Process │────▶│ Create ││
│  │  Change  │     │  Handler │     │   File   │     │ Draft  ││
│  └──────────┘     └──────────┘     └──────────┘     │Meeting ││
└───────────────────────────────────────────────────────────────┘
                                                             │
┌────────────────────────────────────────────────────────────┘───┐
│                    POLLING PATH (Backup)                        │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐│
│  │  Cron    │────▶│  Poll    │────▶│  Process │────▶│ Create ││
│  │  (hourly)│     │  Folders │     │  New     │     │ Draft  ││
│  └──────────┘     └──────────┘     │  Files   │     │Meeting ││
└────────────────────────────────────└──────────┘─────────────────┘
```

---

## Performance Considerations

### Caching

| Cache | TTL | Purpose |
|-------|-----|---------|
| Embedding LRU | 30 min | Avoid regenerating embeddings |
| Fuse.js Index | 1 min | Fast fuzzy matching |
| OAuth Tokens | Until expiry | Reduce token refreshes |

### Database Optimization

| Optimization | Implementation |
|--------------|----------------|
| Vector Index | HNSW on action_items, decisions, risks |
| Query Indexes | Composite indexes on common filters |
| Atomic Operations | RPC functions for status updates |
| Parallel Queries | Promise.all for independent fetches |

### Context Filtering

For projects with >25 open items:
- Sample first 8,000 chars for embedding
- Filter context by 0.3 similarity threshold
- Always include items updated in last 14 days
