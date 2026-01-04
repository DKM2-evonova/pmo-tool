# PMO Tool

An AI-powered Project Management Office tool that converts meeting transcripts into structured project data including action items, decisions, risks, and meeting recaps.

## Overview

The PMO Tool is a full-stack project management office solution built with **Next.js 16**, **React 18**, **TypeScript**, and **Supabase**. The codebase comprises approximately **38,800 lines of code** across **192 TypeScript/TSX files**, organized into **12 component modules** and **11 API route groups**. The database schema has evolved through **40 migrations**, reflecting significant feature maturity.

The application serves as an automation layer that sits on top of an organization's existing work management ecosystem. It converts meeting conversations into structured project data (action items, risks/issues, decisions, recaps, tone) and reusable artifacts, reducing the time Project Consultants and Program/Portfolio Managers spend on 'work about work'.

Key capabilities include meeting management with AI-powered processing (via OpenAI and Google GenAI), action item tracking with Kanban boards, decision logging, risk management, and Google Calendar/Drive integration. The application supports document ingestion (PDF, DOCX) and multi-format exports (PDF, Word, Excel). The UI is styled with **Tailwind CSS** using a custom Liquid Glass design system with primitives like modals, tooltips, and badges.

**Core Loop**: Ingest (Transcript) → Interpret (LLM) → Action (Structured Data)

**Deployment Model**: Single-tenant (standalone deployment per client organization)

## Features

- **Meeting Processing**: Upload transcripts (VTT, TXT, DOCX, PDF) or import from Google Calendar
- **Google Drive Auto-Ingestion**: Automatically import meeting transcripts from Google Drive's "Meet Recordings" folder
- **AI Extraction**: Uses Gemini 3 Pro Preview and GPT-5.2 to extract structured data with evidence citations
- **Context-Aware Updates**: Favors updating existing items over creating duplicates using semantic matching
- **Smart Context Filtering**: Uses vector similarity to filter relevant open items, reducing token usage for large projects
- **5 Meeting Categories**: Project, Governance, Discovery, Alignment, Remediation
- **Review Workflow**: Staging area for human validation with edit and reject capabilities before publishing
- **Owner Resolution**: 7-step pipeline for resolving owner identity from transcripts (including project contacts)
- **Duplicate Detection**: Semantic matching using pgvector embeddings (threshold: 0.85)
- **Decision Log**: Track key decisions with outcomes and decision makers
- **Risk Register**: Risk/issue management with probability/impact assessment and severity matrix
- **Kanban Board**: Visual task management for action items with optimistic UI updates
- **Dashboard Reporting**: Due today/past due items and 5-business-day lookahead for proactive task management
- **Export**: CSV/DOCX/PDF export for action items, decisions, risks, and project status reports
- **Project Contacts**: Manage non-login users (external stakeholders) for owner resolution
- **RBAC**: Role-based access control with project scoping
- **Evidence Trail**: All extracted items include transcript evidence for auditability
- **Cost Monitoring**: Circuit breaker alerts when fallback LLM usage exceeds 15% in 24-hour window
- **Processing Time Estimation**: Dynamic processing time estimates based on historical LLM performance data

## Tech Stack

- **Frontend**: Next.js 16 + Tailwind CSS + Liquid Glass Design System
- **Backend**: Supabase (Postgres + RLS + pgvector)
- **LLM**:
  - Primary: Gemini 3 Pro Preview (recaps, decisions, risk analysis)
  - Fallback: OpenAI GPT-5.2 (used if Gemini fails)
  - Utility: Gemini 2.0 Flash (formatting, JSON validation/repair)
- **Deployment**: Google Cloud Run
- **Authentication**: Supabase Auth with Google/Microsoft OAuth support

## UI Design System

The application features a premium **Liquid Glass** design system with modern glassmorphism effects:

### Key Design Elements

- **Glass Panels**: Frosted glass containers with backdrop blur and subtle gradients
- **Glass Cards**: Elevated cards with hover effects and drag-and-drop support
- **Premium Shadows**: Layered shadows including `shadow-glass`, `shadow-card-elevated`, and glow effects
- **Smooth Animations**: Scale, fade, float, and shimmer effects for polished interactions
- **Status Indicators**: Glowing status dots with pulse animations for active states

### CSS Utilities

The design system provides reusable utility classes in `globals.css`:

```css
.glass-panel      /* Frosted glass containers */
.glass-card       /* Draggable cards with hover states */
.glass-column     /* Kanban columns with color accents */
.glass-badge      /* Small frosted badges */
.glass-avatar     /* Gradient avatars with glow */
.status-dot-*     /* Glowing status indicators */
.due-chip         /* Date chips with overdue states */
.empty-drop-zone  /* Empty state drop targets */
```

### Tailwind Extensions

Custom theme extensions in `tailwind.config.ts`:

- **Shadows**: `shadow-glass`, `shadow-glass-hover`, `shadow-card-elevated`, `glow-primary/success/warning`
- **Animations**: `animate-float`, `animate-shimmer`, `animate-pulse-soft`, `animate-scale-in`
- **Backdrop Blur**: `backdrop-blur-glass`, `backdrop-blur-heavy`

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

# Optional: Google Calendar Integration (for importing meetings)
GOOGLE_CALENDAR_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CALENDAR_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/google/calendar/callback

# Optional: Google Drive Integration (for auto-importing transcripts)
GOOGLE_DRIVE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/api/google/drive/callback
WEBHOOK_SECRET=random-string-for-webhook-verification
CRON_SECRET=random-string-for-cron-authentication
NEXT_PUBLIC_APP_URL=http://localhost:3000
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

6. (Optional) Set up Google Calendar integration:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the **Google Calendar API** at: APIs & Services > Library > Google Calendar API
   - Create OAuth 2.0 credentials: APIs & Services > Credentials > Create Credentials > OAuth client ID
   - Set application type to "Web application"
   - Add authorized redirect URI: `http://localhost:3000/api/google/calendar/callback` (or your production URL)
   - Copy the Client ID and Client Secret to your `.env.local` file

7. (Optional) Set up Google Drive auto-ingestion:
   - Enable the **Google Drive API** in the same Google Cloud project
   - Add authorized redirect URI: `http://localhost:3000/api/google/drive/callback`
   - You can reuse the same OAuth credentials from Google Calendar
   - Generate random secrets for `WEBHOOK_SECRET` and `CRON_SECRET`
   - See `docs/GOOGLE_DRIVE_INTEGRATION.md` for detailed setup

8. Start the development server:
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
│   ├── llm/                # LLM client, prompts, and context filtering
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
- `project_contacts` - Non-login users/external stakeholders per project
- `meetings` - Meeting records with transcripts
- `action_items` - Action items with embeddings and status updates
- `decisions` - Decision log with outcomes and decision makers
- `risks` - Risk/issue register with probability/impact assessment and status updates
- `evidence` - Transcript evidence for traceability
- `proposed_change_sets` - Staging area for reviews
- `audit_logs` - Change audit trail
- `llm_metrics` - LLM usage tracking

### Database Functions

- `get_avg_processing_time_ms()` - Returns average processing time from recent successful LLM requests (last 7 days) for analytics and user experience improvements

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

### Logging

The application uses a structured logging utility (`src/lib/logger.ts`) for consistent debugging and monitoring:

```typescript
import { logger, loggers, createLogger } from '@/lib/logger';

// Use pre-configured scoped loggers
loggers.llm.info('LLM request completed', { model: 'gemini', latencyMs: 1500 });
loggers.embedding.debug('Embedding generated', { textLength: 500 });
loggers.publish.error('Publish failed', { meetingId, error: err.message });

// Or create custom scoped loggers
const log = createLogger('my-feature');
log.info('Operation completed', { context: 'value' });

// Timed operations
await log.timed('Processing data', async () => {
  // ... async operation
}, { itemCount: 100 });
```

**Available scoped loggers:** `llm`, `embedding`, `owner`, `publish`, `api`, `auth`, `file`

**Log levels:** `debug`, `info`, `warn`, `error`

**Environment configuration:**
- Set `LOG_LEVEL=debug` for verbose output in development
- Defaults to `info` in production, `debug` in development

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

The system uses intelligent context filtering to optimize LLM processing:

- **Semantic Relevance Filtering**: When projects have many open items (>25), the system uses vector embeddings to filter context to only semantically relevant items, reducing token usage and improving LLM focus
- **Similarity Threshold**: Uses a 0.3 similarity threshold (broader matches) to include contextually relevant items
- **Recency Fallback**: Always includes items updated within the last 14 days, regardless of similarity
- **Cost Optimization**: Samples the first 8,000 characters of transcripts for embedding generation
- **Passthrough Mode**: Projects with ≤25 total open items bypass filtering and include all items

This filtered context is injected into the LLM prompt to favor UPDATE/CLOSE operations over CREATE, reducing duplicates while maintaining efficiency.

### Owner Resolution Pipeline

1. **Direct email match (Users)**: Map email from Meet API or attendee list to user profile
2. **Direct email match (Contacts)**: Map email to project contacts (non-login users)
3. **Email inference**: Match names to emails from meeting invites (best effort)
4. **Conference-room heuristic**: Infer owner from room device responses
5. **Fuzzy match**: Match names against project roster (requires confirmation)
6. **Ambiguous**: Multiple matches require manual selection
7. **Fallback**: Assign to 'Unknown' for manual resolution

### Semantic Duplicate Detection

- Uses pgvector embeddings for semantic similarity
- Threshold: 0.85 (configurable)
- Embeddings generated/regenerated on Publish
- Flagged items appear in Review UI as 'Potential Duplicate'

### Google Drive Auto-Ingestion

Automatically imports meeting transcripts from Google Drive's "Meet Recordings" folder:

- **Real-time Detection**: Uses Google Drive Push Notifications (webhooks) for instant detection of new files
- **Hourly Backup Polling**: Vercel cron job ensures no files are missed if webhooks fail
- **Draft Status**: Imported meetings are created in Draft status for user review and project assignment
- **Multi-User Deduplication**: Content fingerprinting (SHA-256) and title/date matching prevent duplicate imports when multiple attendees have the same recording
- **Supported Formats**: Google Docs transcripts, DOCX, PDF, TXT, RTF

**User Workflow**:
1. Connect Google Drive from Profile > Integrations
2. Add the "Meet Recordings" folder (auto-detected)
3. New transcripts are automatically imported as Draft meetings
4. Review and assign to projects before processing

### Decision Log

The Decision Log is designed to handle 100+ decisions across hybrid projects (Software Development + Business Process Transformation):

- **Smart IDs**: Auto-generated category-prefixed identifiers (e.g., TECH-001, PROC-042, GOV-015)
- **6 Categories**: Process & Operating Model, Technology & Systems, Data & Reporting, People & Change Management, Governance & Compliance, Strategy & Commercial
- **5 Impact Areas**: Scope, Cost/Budget, Time/Schedule, Risk, Customer Experience (multi-select)
- **Status Lifecycle**: Proposed → Approved / Rejected / Superseded
- **Superseded Workflow**: Link replacement decisions with visual strikethrough and navigation
- **Manual Entry**: Create decisions directly without a meeting source
- **Faceted Filtering**: Sidebar with category, impact, and status checkboxes with real-time counts
- **Saved Views**: Pre-configured filter presets (Technical, Business Process, Governance, Active, Pending)
- **LLM Auto-Classification**: AI automatically assigns category and impact areas during meeting processing
- Evidence-based decisions with transcript citations

### Risk Register

- Risk/issue management with probability/impact assessment
- Severity matrix calculation (High/Med/Low) based on risk scores
- Status tracking with update history and comments
- Visual dashboard showing risk distribution by severity
- Filtering by severity (High/Medium/Low) and status

### Dashboard Reporting

The main dashboard provides at-a-glance visibility into urgent and upcoming work:

- **Due Today / Past Due**: Shows all open action items that are due today or overdue, sorted by due date (oldest first). Past due items display with red badges, items due today show yellow badges.
- **Coming Up**: Displays action items due within the next 5 business days (excluding weekends), helping users plan their upcoming workload.
- **Quick Actions**: Easy access to process meetings, create action items, or view the Kanban board.
- **Recent Meetings**: Latest 5 processed meetings with status indicators.

All items are clickable and link directly to their detail views for quick access.

## Security

### Authentication & Authorization

- **Supabase Auth**: All API routes require authenticated users
- **Row-Level Security (RLS)**: Database enforces project-scoped access automatically
- **Project Membership Verification**: Update operations verify user has access to the project
- **Admin-Only Routes**: Debug and admin routes require `global_role = 'admin'`
- **Middleware Protection**: Auth errors are handled gracefully with redirect to login

### API Security

- All update routes (`/api/action-items/[id]/update`, `/api/risks/[id]/update`) verify:
  1. User is authenticated
  2. User is either a project member OR has admin role
- Debug routes require admin privileges to prevent data exposure
- Service client (RLS bypass) is only used after authorization checks

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

- **Product Requirements**: See `PRD - MDs/` directory for detailed specifications
- **Database Schema**: See `supabase/migrations/` for schema definitions
- **Type Definitions**: See `src/types/` for TypeScript interfaces
- **Changelog**: See `CHANGELOG.md` for version history
- **Google Calendar Setup**: See `docs/GOOGLE_CALENDAR_INTEGRATION.md`
- **Google Drive Setup**: See `docs/GOOGLE_DRIVE_INTEGRATION.md`
- **Code Optimizations**: See `docs/CODE_OPTIMIZATION_PLAN.md` for optimization summary

