# PMO Tool

An AI-powered Project Management Office tool that converts meeting transcripts into structured project data including action items, decisions, risks, and meeting recaps.

---

## Overview

The PMO Tool is a full-stack automation layer that sits on top of an organization's existing work management ecosystem. It converts meeting conversations into structured project data, reducing the time Project Consultants and Program/Portfolio Managers spend on 'work about work'.

**Core Loop**: Ingest (Transcript) → Interpret (LLM) → Action (Structured Data)

### Key Capabilities

- **Meeting Processing**: Upload transcripts (VTT, TXT, DOCX, PDF) or auto-import from Google Drive
- **AI Extraction**: Uses Gemini 3 Pro Preview to extract action items, decisions, risks with evidence citations
- **Context-Aware Updates**: Favors updating existing items over creating duplicates
- **Review Workflow**: Staging area for human validation before publishing
- **Decision Log**: Track decisions with Smart IDs, 6 categories, and superseded workflows
- **Risk Register**: Probability/impact assessment with severity matrix
- **Milestone Management**: Gantt visualization with finish-to-start dependencies
- **Kanban Board**: Visual task management with optimistic UI updates
- **Dashboard**: Due today/past due items and 5-business-day lookahead

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16 + React 18 + Tailwind CSS |
| Backend | Supabase (Postgres + RLS + pgvector) |
| LLM | Gemini 3 Pro Preview (primary), GPT-5.2 (fallback) |
| Deployment | Google Cloud Run |
| Design | Liquid Glass Design System |

---

## Quick Start

```bash
# Clone and install
git clone <repository-url>
cd pmo-tool
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Set up database
npx supabase link --project-ref your-project-ref
npx supabase db push

# Start development
npm run dev
```

See [docs/getting-started.md](docs/getting-started.md) for detailed setup instructions.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | Setup and installation guide |
| [Architecture](docs/architecture.md) | System overview and data flow |
| [API Reference](docs/api-reference.md) | Complete API documentation |
| [Deployment](docs/deployment.md) | Cloud Run and Vercel deployment |
| [Contributing](CONTRIBUTING.md) | Development guidelines |

### Integrations

| Guide | Description |
|-------|-------------|
| [Google Calendar](docs/integrations/GOOGLE_CALENDAR_INTEGRATION.md) | Import meetings from Calendar |
| [Google Drive](docs/integrations/GOOGLE_DRIVE_INTEGRATION.md) | Auto-import transcripts from Drive |

### Product Requirements

| Document | Description |
|----------|-------------|
| [PRD v2.5](prd/PRD_PMO_Tool_v2.5.md) | Current product requirements |
| [Technical Contracts](prd/contracts/) | Enums, schemas, specifications |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
├── components/             # React components organized by feature
├── lib/                    # Utility functions and integrations
└── types/                  # TypeScript type definitions

supabase/migrations/        # Database migration files
prd/                        # Product requirements documents
docs/                       # Documentation
```

---

## Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm run db:push` | Push database migrations |
| `npm run db:generate` | Generate TypeScript types |

### Code Style

- TypeScript for all code
- Tailwind CSS for styling
- Next.js App Router conventions
- Run `npm run format` before committing

---

## Troubleshooting

### Common Issues

**LLM Processing Errors**
- Verify API keys in `.env.local`
- Check `llm_metrics` table for usage patterns
- Review circuit breaker alerts in admin dashboard

**Database Issues**
- Ensure migrations are current: `npx supabase db push`
- Verify RLS policies are enabled
- Check `audit_logs` for error details

**OAuth Redirect Errors**
- Verify redirect URIs match exactly in Google Cloud Console
- Check `NEXT_PUBLIC_APP_URL` environment variable

See [docs/getting-started.md#troubleshooting](docs/getting-started.md#troubleshooting) for more solutions.

---

## License

Proprietary - All rights reserved

---

## Additional Resources

- **Changelog**: See [CHANGELOG.md](CHANGELOG.md) for version history
- **Database Schema**: See `supabase/migrations/` for schema definitions
- **Type Definitions**: See `src/types/` for TypeScript interfaces
