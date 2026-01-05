# Getting Started

This guide walks you through setting up the PMO Tool for local development.

---

## Prerequisites

Before you begin, ensure you have:

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 20+ | [Download](https://nodejs.org/) |
| npm | 10+ | Included with Node.js |
| Supabase Account | - | [Sign up](https://supabase.com/) |
| Google Cloud Account | - | [Console](https://console.cloud.google.com/) (for Gemini API) |
| OpenAI Account | - | [Platform](https://platform.openai.com/) (for embeddings + fallback) |

---

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd pmo-tool
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your values. At minimum, you need:

```bash
# Supabase (from your project settings)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# LLM APIs
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
OPENAI_API_KEY=sk-...
```

### 4. Set Up the Database

```bash
# Link to your Supabase project
npx supabase link --project-ref your-project-ref

# Apply all migrations
npx supabase db push
```

### 5. Configure Authentication

In your Supabase dashboard:

1. Go to **Authentication > Providers**
2. Enable **Google** OAuth
3. Enable **Microsoft/Azure** OAuth (optional)
4. Set redirect URLs to `http://localhost:3000/auth/callback`

### 6. Start the Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Optional: Google Integrations

### Google Calendar Integration

Allows importing meeting metadata from your calendar.

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the **Google Calendar API**
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Redirect URI: `http://localhost:3000/api/google/calendar/callback`
5. Add credentials to `.env.local`:
   ```bash
   GOOGLE_CALENDAR_CLIENT_ID=xxx.apps.googleusercontent.com
   GOOGLE_CALENDAR_CLIENT_SECRET=xxx
   GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/google/calendar/callback
   ```

See [integrations/google-calendar.md](integrations/GOOGLE_CALENDAR_INTEGRATION.md) for details.

### Google Drive Auto-Ingestion

Automatically imports meeting transcripts from Google Drive.

1. Enable the **Google Drive API** in the same project
2. Add redirect URI: `http://localhost:3000/api/google/drive/callback`
3. Generate security secrets:
   ```bash
   openssl rand -hex 16  # WEBHOOK_SECRET
   openssl rand -hex 16  # CRON_SECRET
   ```
4. Add to `.env.local`:
   ```bash
   GOOGLE_DRIVE_CLIENT_ID=xxx.apps.googleusercontent.com
   GOOGLE_DRIVE_CLIENT_SECRET=xxx
   GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/api/google/drive/callback
   WEBHOOK_SECRET=xxx
   CRON_SECRET=xxx
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

See [integrations/google-drive.md](integrations/GOOGLE_DRIVE_INTEGRATION.md) for details.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run db:push` | Push database migrations |
| `npm run db:generate` | Generate TypeScript types from schema |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
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
│   └── ui/                 # Reusable UI components
├── lib/                    # Utility functions
│   ├── api/                # API utilities
│   ├── embeddings/         # Embedding generation
│   ├── export/             # Export utilities
│   ├── google/             # Google API clients
│   ├── llm/                # LLM client and prompts
│   ├── supabase/           # Supabase clients
│   └── validations/        # Zod schemas
└── types/                  # TypeScript types

supabase/
└── migrations/             # Database migrations

prd/                        # Product requirements
├── contracts/              # Technical specifications
└── PRD_PMO_Tool_v2.5.md    # Main PRD

docs/                       # Documentation
├── integrations/           # Integration guides
└── archive/                # Historical docs
```

---

## Next Steps

1. **Create a project**: Log in as admin and create your first project
2. **Add team members**: Invite users and assign them to projects
3. **Process a meeting**: Upload a transcript or connect Google Calendar
4. **Review and publish**: Validate extracted items before publishing

---

## Troubleshooting

### "Invalid API key" errors

- Verify your API keys are correctly set in `.env.local`
- Ensure no trailing whitespace in key values
- Restart the dev server after changing environment variables

### Database connection issues

- Verify Supabase URL and keys are correct
- Run `npx supabase db push` to apply migrations
- Check that RLS policies are enabled

### OAuth redirect errors

- Verify redirect URIs match exactly in Google Cloud Console
- Check that the API is enabled in your Google Cloud project
- Ensure you're using the correct OAuth client credentials

See [Troubleshooting](../README.md#troubleshooting) for more solutions.
