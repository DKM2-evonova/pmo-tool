# Contributing to PMO Tool

Thank you for your interest in contributing to the PMO Tool. This guide will help you get started.

---

## Development Setup

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase CLI
- Access to development API keys (Gemini, OpenAI)

### Getting Started

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd pmo-tool
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your development credentials
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

See [docs/getting-started.md](docs/getting-started.md) for detailed setup instructions.

---

## Code Style

### TypeScript

- Use TypeScript for all new code
- Enable strict mode (already configured in `tsconfig.json`)
- Avoid `any` types; use proper interfaces
- Prefer explicit return types on functions

### Formatting

Run Prettier before committing:
```bash
npm run format
```

ESLint will catch common issues:
```bash
npm run lint
```

### React Components

- Use functional components with hooks
- Follow Next.js App Router conventions
- Use `useCallback` and `useMemo` for performance
- Keep components focused and composable

### Styling

- Use Tailwind CSS for all styling
- Follow the Liquid Glass Design System patterns
- Reference existing components in `src/components/ui/`

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Authenticated routes
│   ├── api/                # API routes
│   └── ...
├── components/             # React components
│   ├── ui/                 # Reusable primitives
│   └── [feature]/          # Feature-specific components
├── lib/                    # Utility functions
│   ├── api/                # API utilities
│   ├── validations/        # Zod schemas
│   └── ...
└── types/                  # TypeScript types
```

### Key Conventions

- **API Routes**: Use standardized responses from `src/lib/api/responses.ts`
- **Validation**: Use Zod schemas from `src/lib/validations/`
- **Logging**: Use structured loggers from `src/lib/logger.ts`
- **Database**: Follow RLS patterns for all queries

---

## Making Changes

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation changes

Example: `feature/add-export-to-excel`

### Commit Messages

Follow conventional commits:

```
type: short description

Longer description if needed.

🤖 Generated with Claude Code

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation
- `test`: Tests
- `chore`: Build/tooling

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run tests and linting:
   ```bash
   npm run lint
   npm run build
   ```
4. Push and create a PR
5. Fill out the PR template
6. Request review

---

## Database Changes

### Creating Migrations

1. Make schema changes in a new migration file:
   ```bash
   # Create new migration
   touch supabase/migrations/00043_your_change.sql
   ```

2. Write idempotent SQL:
   ```sql
   -- Always check if exists before creating
   CREATE TABLE IF NOT EXISTS ...

   -- Use DO blocks for conditional logic
   DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM ...) THEN
       ...
     END IF;
   END $$;
   ```

3. Apply and test:
   ```bash
   npx supabase db push
   ```

### RLS Policies

All new tables must have Row-Level Security:

```sql
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their projects' data"
ON your_table FOR SELECT
USING (
  project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = auth.uid()
  )
);
```

---

## API Development

### Route Structure

```typescript
// src/app/api/[resource]/[id]/route.ts

import { createServerClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api';
import { updateSchema, validateRequest } from '@/lib/validations';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  // 1. Authenticate
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiErrors.unauthorized();

  // 2. Validate input
  const body = await request.json();
  const result = validateRequest(updateSchema, body);
  if (!result.success) return ApiErrors.validationError(result.errors);

  // 3. Check authorization
  // ... verify user has access

  // 4. Perform operation
  // ... database operations

  // 5. Return response
  return successResponse(data);
}
```

### Error Handling

Use standardized error responses:

```typescript
import { ApiErrors } from '@/lib/api';

// Common errors
return ApiErrors.unauthorized();
return ApiErrors.notFound('Action item');
return ApiErrors.badRequest('Invalid status');
return ApiErrors.validationError(zodErrors);
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.ts

# Run with coverage
npm run test:coverage
```

### Writing Tests

- Place tests next to source files: `component.test.tsx`
- Use descriptive test names
- Mock external dependencies (Supabase, LLM APIs)

---

## Documentation

### Updating Docs

- Keep README.md concise; detailed docs go in `/docs`
- Update PRD for feature changes (create new version)
- Document all API endpoints in `docs/api-reference.md`
- Update CHANGELOG.md for releases

### Documentation Structure

```
docs/
├── getting-started.md      # Setup guide
├── architecture.md         # System overview
├── api-reference.md        # API documentation
├── deployment.md           # Deployment guide
└── integrations/           # Integration guides
    ├── google-calendar.md
    └── google-drive.md

prd/
├── README.md               # PRD index
├── PRD_PMO_Tool_v2.5.md    # Current PRD
└── contracts/              # Technical specifications
```

---

## Questions?

- Check existing issues for similar questions
- Open a new issue for bugs or feature requests
- Review the PRD documents for product decisions

---

## License

By contributing, you agree that your contributions will be licensed under the project's proprietary license.
