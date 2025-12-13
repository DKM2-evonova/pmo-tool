# PMO Tool

An AI-powered Project Management Office tool that converts meeting transcripts into structured project data including action items, decisions, risks, and meeting recaps.

## Overview

The PMO Tool is an automation layer that sits on top of an organization's existing work management ecosystem. It converts meeting conversations into structured project data (action items, risks/issues, decisions, recaps, tone) and reusable artifacts, reducing the time Project Consultants and Program/Portfolio Managers spend on 'work about work'.

**Core Loop**: Ingest (Transcript) → Interpret (LLM) → Action (Structured Data)

**Deployment Model**: Single-tenant (standalone deployment per client organization)

## Features

- **Meeting Processing**: Upload transcripts (VTT, TXT, DOCX, PDF) or connect to Google Meet API
- **AI Extraction**: Uses Gemini 3 Pro Preview and GPT-4o to extract structured data with evidence citations
- **Context-Aware Updates**: Favors updating existing items over creating duplicates using semantic matching
- **5 Meeting Categories**: Project, Governance, Discovery, Alignment, Remediation
- **Review Workflow**: Staging area for human validation with edit and reject capabilities before publishing
- **Owner Resolution**: 6-step pipeline for resolving owner identity from transcripts
- **Duplicate Detection**: Semantic matching using pgvector embeddings (threshold: 0.85)
- **Decision Log**: Track key decisions with outcomes and decision makers
- **Risk Register**: Risk/issue management with probability/impact assessment and severity matrix
- **Kanban Board**: Visual task management for action items
- **Export**: CSV/DOCX/PDF export for action items, decisions, and risks
- **RBAC**: Role-based access control with project scoping
- **Evidence Trail**: All extracted items include transcript evidence for auditability
- **Cost Monitoring**: Circuit breaker alerts when fallback LLM usage exceeds 15% in 24-hour window

## Tech Stack

- **Frontend**: Next.js 16 + Tailwind CSS
- **Backend**: Supabase (Postgres + RLS + pgvector)
- **LLM**: 
  - Primary: Gemini 3 Pro Preview (recaps, decisions, risk analysis)
  - Fallback: OpenAI GPT-4o (used if Gemini fails)
  - Utility: Gemini Flash (formatting, JSON validation/repair)
- **Deployment**: Google Cloud Run
- **Authentication**: Supabase Auth with Google/Microsoft OAuth support

## Getting Started

### Prerequisites

- Node.js 20+
- Supabase account
- Google Cloud account (for Gemini API)
- OpenAI account (for embeddings and fallback)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd pmo-tool
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:

Create a `.env.local` file in the root directory with the following variables:
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LLM API Keys
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key

# Optional: Google Meet API (for automatic transcript fetching)
GOOGLE_MEET_API_KEY=your-google-meet-api-key
```

**Note**: Never commit `.env.local` to version control. It's already included in `.gitignore`.

4. Set up the database:
```bash
# Link to your Supabase project
npx supabase link --project-ref your-project-ref

# Run migrations
npx supabase db push
```

5. Configure OAuth providers in Supabase:
   - Enable Google OAuth
   - Enable Microsoft/Azure OAuth
   - Set redirect URLs

6. Start the development server:
```bash
npm run dev
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (dashboard)/        # Authenticated routes
│   ├── api/                # API routes
│   ├── auth/               # Auth callback
│   └── login/              # Login page
├── components/             # React components
│   ├── action-items/       # Action item components
│   ├── admin/              # Admin components
│   ├── decisions/          # Decision components
│   ├── export/             # Export components
│   ├── layout/             # Layout components
│   ├── meetings/           # Meeting components
│   ├── projects/           # Project components
│   ├── risks/              # Risk components
│   └── ui/                 # Reusable UI components (Button, Input, Textarea, Modal, etc.)
├── lib/                    # Utility functions
│   ├── embeddings/         # Embedding generation
│   ├── export/             # Export utilities
│   ├── llm/                # LLM client and prompts
│   ├── supabase/           # Supabase clients
│   └── utils.ts            # Helper functions
└── types/                  # TypeScript types
    ├── database.ts         # Database types
    ├── enums.ts            # Enum definitions
    └── llm-contract.ts     # LLM output schema

supabase/
└── migrations/             # Database migrations
```

## Database Schema

### Core Tables

- `profiles` - User profiles (extends Supabase auth)
- `projects` - Project definitions with milestones
- `project_members` - Project membership (for RLS)
- `meetings` - Meeting records with transcripts
- `action_items` - Action items with embeddings and status updates
- `decisions` - Decision log with outcomes and decision makers
- `risks` - Risk/issue register with probability/impact assessment and status updates
- `evidence` - Transcript evidence for traceability
- `proposed_change_sets` - Staging area for reviews
- `audit_logs` - Change audit trail
- `llm_metrics` - LLM usage tracking

## Deployment

### Google Cloud Run

1. Create secrets in Secret Manager:
```bash
gcloud secrets create supabase-anon-key --data-file=- <<< "your-anon-key"
gcloud secrets create supabase-service-role-key --data-file=- <<< "your-service-key"
gcloud secrets create gemini-api-key --data-file=- <<< "your-gemini-key"
gcloud secrets create openai-api-key --data-file=- <<< "your-openai-key"
```

2. Grant access to Cloud Run service account:
```bash
gcloud secrets add-iam-policy-binding supabase-anon-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

3. Deploy using Cloud Build:
```bash
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_SUPABASE_URL="your-supabase-url",_REGION="us-central1"
```

## Meeting Categories

| Category | Outputs |
|----------|---------|
| **Project** | Recap, Action Items, Risks/Issues |
| **Governance** | Recap, Decisions (with outcomes), Strategic Risks |
| **Discovery** | Detailed Recap, Action Items, Decisions |
| **Alignment** | Recap, Tone Analysis |
| **Remediation** | Detailed Recap, Fishbone Diagram, RAID |

## Roles and Permissions

| Capability | Admin | Consultant | Program Manager |
|------------|-------|------------|-----------------|
| Create/delete projects | ✓ | ✗ | ✗ |
| Manage members/RBAC | ✓ | ✗ | ✗ |
| Process meetings | ✓ | ✓ | ✓ |
| Review & publish | ✓ | ✓ | ✓ |
| View analytics | ✓ | ✗ | ✗ |

## Development

### Code Style

- Use TypeScript for all new code
- Follow Next.js App Router conventions
- Use Tailwind CSS for styling
- Run `npm run format` before committing

### Database Migrations

The database schema is managed through Supabase migrations in `supabase/migrations/`. To apply migrations:

```bash
npx supabase db push
```

To generate TypeScript types from your database schema:

```bash
npm run db:generate
```

### Project Structure

Key directories:
- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - React components organized by feature
- `src/lib/` - Utility functions and integrations
- `src/types/` - TypeScript type definitions
- `supabase/migrations/` - Database migration files
- `PRD - MDs/` - Product Requirements Documents

## API Documentation

### Meeting Processing

- **POST** `/api/meetings/[meetingId]/process` - Process a meeting transcript
- **POST** `/api/meetings/[meetingId]/publish` - Publish reviewed changes

### Action Items

- **PUT** `/api/action-items/[id]/update` - Update action item status and add comments

### Decisions

- Decision log accessible at `/decisions` with filtering and sorting capabilities

### Risks

- **PUT** `/api/risks/[id]/update` - Update risk status and add comments
- Risk register accessible at `/risks` with severity matrix dashboard

### Authentication

- Uses Supabase Auth with OAuth providers (Google/Microsoft)
- All routes under `(dashboard)` require authentication
- Row-Level Security (RLS) enforces project-scoped access

## Meeting Categories

| Category | Outputs |
|----------|---------|
| **Project** | Recap, Action Items, Risks/Issues |
| **Governance** | Recap, Decisions (with outcomes), Strategic Risks |
| **Discovery** | Detailed Recap, Action Items, Decisions |
| **Alignment** | Recap, Tone Analysis |
| **Remediation** | Detailed Recap, Fishbone Diagram, RAID |

## Roles and Permissions

| Capability | Admin | Consultant | Program Manager |
|------------|-------|------------|-----------------|
| Create/delete projects | ✓ | ✗ | ✗ |
| Manage members/RBAC | ✓ | ✗ | ✗ |
| Process meetings | ✓ | ✓ | ✓ |
| Review & publish | ✓ | ✓ | ✓ |
| View analytics | ✓ | ✗ | ✗ |

## Key Features Explained

### Review Workflow

The PMO Tool includes a comprehensive review system that allows users to validate and modify AI-extracted data before publishing:

- **Lock Mechanism**: Prevents concurrent reviews of the same meeting
- **Edit Functionality**: Modify descriptions, titles, and other fields of proposed items
  - Action Items: Edit title and description
  - Decisions: Edit title, rationale, and outcome
  - Risks: Edit title, description, and mitigation strategy
- **Reject Items**: Remove items that are already resolved or not relevant
- **Owner Resolution**: Assign or resolve owners for action items and risks
- **Evidence Review**: All items include transcript citations for validation

### Context-Aware Processing

The system pre-fetches all open action items, risks, and decisions for the selected project before LLM processing. This context is injected into the LLM prompt to favor UPDATE/CLOSE operations over CREATE, reducing duplicates.

### Owner Resolution Pipeline

1. **Direct match**: Map email from Meet API or attendee list to profile
2. **Email inference**: Match names to emails from meeting invites
3. **Conference-room heuristic**: Infer owner from room device responses
4. **Fuzzy match**: Match names against project roster (requires confirmation)
5. **Ambiguous**: Multiple matches require manual selection
6. **Fallback**: Assign to 'Unknown' for manual resolution

### Semantic Duplicate Detection

- Uses pgvector embeddings for semantic similarity
- Threshold: 0.85 (configurable)
- Embeddings generated/regenerated on Publish
- Flagged items appear in Review UI as 'Potential Duplicate'

### Decision Log

- Comprehensive decision tracking across all meeting categories
- Captures decision makers, outcomes, and implementation status
- Filtering and sorting by project, decision maker, and status
- Evidence-based decisions with transcript citations

### Risk Register

- Risk/issue management with probability/impact assessment
- Severity matrix calculation (High/Med/Low) based on risk scores
- Status tracking with update history and comments
- Visual dashboard showing risk distribution by severity

## Troubleshooting

### LLM Processing Issues

- Check API keys are correctly set in `.env.local`
- Verify Supabase connection and RLS policies
- Review `llm_metrics` table for usage patterns
- Check circuit breaker alerts in admin dashboard

### Database Issues

- Ensure migrations are up to date: `npx supabase db push`
- Verify RLS policies are enabled for all tables
- Check `audit_logs` table for processing errors

## Contributing

1. Follow the existing code style and TypeScript conventions
2. Reference PRD documents in `PRD - MDs/` for feature constraints
3. Update documentation as needed
4. Test all changes locally before submitting
5. Ensure RLS policies are properly configured for new features

## License

Proprietary - All rights reserved

## Additional Resources

- Product Requirements: See `PRD - MDs/` directory for detailed specifications
- Database Schema: See `supabase/migrations/` for schema definitions
- Type Definitions: See `src/types/` for TypeScript interfaces

