# Deployment Guide

This guide covers deploying the PMO Tool to production environments.

---

## Deployment Options

| Platform | Best For | Features |
|----------|----------|----------|
| Google Cloud Run | Primary recommended | Container-based, auto-scaling, Secret Manager |
| Vercel | Alternative | Zero-config, edge functions, built-in cron |

---

## Google Cloud Run (Recommended)

### Prerequisites

- Google Cloud account with billing enabled
- `gcloud` CLI installed and authenticated
- Docker installed locally (for testing)

### 1. Set Up Secrets

Store sensitive values in Google Secret Manager:

```bash
# Supabase credentials
gcloud secrets create supabase-anon-key --data-file=- <<< "your-anon-key"
gcloud secrets create supabase-service-role-key --data-file=- <<< "your-service-key"

# LLM API keys
gcloud secrets create gemini-api-key --data-file=- <<< "your-gemini-key"
gcloud secrets create openai-api-key --data-file=- <<< "your-openai-key"

# Google OAuth (if using integrations)
gcloud secrets create google-calendar-client-secret --data-file=- <<< "your-secret"
gcloud secrets create google-drive-client-secret --data-file=- <<< "your-secret"
gcloud secrets create webhook-secret --data-file=- <<< "your-webhook-secret"
gcloud secrets create cron-secret --data-file=- <<< "your-cron-secret"
```

### 2. Grant Access to Service Account

```bash
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')

for secret in supabase-anon-key supabase-service-role-key gemini-api-key openai-api-key; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

### 3. Configure Cloud Build

The repository includes `cloudbuild.yaml` for CI/CD:

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/pmo-tool', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/pmo-tool']
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'pmo-tool'
      - '--image=gcr.io/$PROJECT_ID/pmo-tool'
      - '--region=${_REGION}'
      - '--platform=managed'
      - '--allow-unauthenticated'
      - '--set-env-vars=NEXT_PUBLIC_SUPABASE_URL=${_SUPABASE_URL}'
```

### 4. Deploy

```bash
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_SUPABASE_URL="https://xxx.supabase.co",_REGION="us-central1"
```

### 5. Set Up Custom Domain (Optional)

```bash
gcloud run domain-mappings create \
  --service=pmo-tool \
  --domain=pmo.yourdomain.com \
  --region=us-central1
```

---

## Vercel Deployment

### 1. Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your Git repository
4. Vercel auto-detects Next.js

### 2. Configure Environment Variables

In Project Settings > Environment Variables, add:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
OPENAI_API_KEY=sk-...

# For Google integrations
GOOGLE_CALENDAR_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=xxx
GOOGLE_CALENDAR_REDIRECT_URI=https://yourdomain.vercel.app/api/google/calendar/callback

GOOGLE_DRIVE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=xxx
GOOGLE_DRIVE_REDIRECT_URI=https://yourdomain.vercel.app/api/google/drive/callback

WEBHOOK_SECRET=xxx
CRON_SECRET=xxx
NEXT_PUBLIC_APP_URL=https://yourdomain.vercel.app
```

### 3. Configure Cron Jobs

The `vercel.json` includes cron configuration:

```json
{
  "crons": [
    {
      "path": "/api/cron/drive-sync",
      "schedule": "0 * * * *"
    }
  ]
}
```

This runs hourly to:
- Poll watched Drive folders for new files
- Renew expiring webhook channels
- Clean up expired channels

### 4. Deploy

```bash
vercel --prod
```

---

## Database Setup

### Apply Migrations

After deploying, ensure database migrations are applied:

```bash
npx supabase link --project-ref your-project-ref
npx supabase db push
```

### Enable Required Extensions

Verify these extensions are enabled in Supabase:

```sql
-- In Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

---

## Environment-Specific Configuration

### Development

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/google/calendar/callback
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/api/google/drive/callback
LOG_LEVEL=debug
```

### Production

```env
NEXT_PUBLIC_APP_URL=https://pmo.yourdomain.com
GOOGLE_CALENDAR_REDIRECT_URI=https://pmo.yourdomain.com/api/google/calendar/callback
GOOGLE_DRIVE_REDIRECT_URI=https://pmo.yourdomain.com/api/google/drive/callback
LOG_LEVEL=info
```

---

## Google OAuth Configuration

Update your Google Cloud Console OAuth credentials for production:

1. Go to APIs & Services > Credentials
2. Edit your OAuth 2.0 Client ID
3. Add authorized redirect URIs:
   - `https://pmo.yourdomain.com/api/google/calendar/callback`
   - `https://pmo.yourdomain.com/api/google/drive/callback`

---

## Monitoring

### Cloud Run Metrics

Monitor in Google Cloud Console:
- Request count and latency
- Memory and CPU utilization
- Error rate

### Vercel Analytics

Enable in Vercel Dashboard:
- Web Vitals
- Function duration
- Error tracking

### Application Metrics

The PMO Tool logs to:
- `llm_metrics` table: LLM usage and latency
- `audit_logs` table: User actions
- Structured console logs (JSON format in production)

---

## Health Checks

### API Health

```bash
curl https://pmo.yourdomain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-01-04T12:00:00Z"
}
```

### Cron Job Verification

Check Drive sync is running:

```bash
# View recent sync logs
curl -H "Authorization: Bearer ${CRON_SECRET}" \
  https://pmo.yourdomain.com/api/cron/drive-sync
```

---

## Troubleshooting

### Container Won't Start

- Check Cloud Run logs for startup errors
- Verify all secrets are correctly configured
- Ensure Dockerfile EXPOSE port matches Cloud Run port

### Database Connection Errors

- Verify Supabase URL is correct
- Check service role key has required permissions
- Ensure RLS policies are not blocking access

### OAuth Redirect Errors

- Verify redirect URIs match exactly in Google Console
- Check `NEXT_PUBLIC_APP_URL` matches your domain
- Ensure OAuth consent screen is configured

### Cron Jobs Not Running

- Verify `vercel.json` cron configuration
- Check CRON_SECRET is set correctly
- Review function logs for errors

---

## Rollback

### Cloud Run

```bash
# List revisions
gcloud run revisions list --service=pmo-tool --region=us-central1

# Rollback to previous revision
gcloud run services update-traffic pmo-tool \
  --to-revisions=pmo-tool-00001-abc=100 \
  --region=us-central1
```

### Vercel

Use Vercel Dashboard > Deployments to promote a previous deployment.
