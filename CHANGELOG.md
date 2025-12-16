# Changelog

All notable changes to the PMO Tool are documented here.

## [Unreleased]

### Added
- Project Status Report with PDF and Excel export (multi-sheet workbook)
- Project Contacts for managing non-login users (external stakeholders)
- Structured logging utility with scoped loggers (`src/lib/logger.ts`)
- Processing time estimation based on historical LLM performance data
- Reusable `FilterSelect` UI component for URL-based filtering (`src/components/ui/filter-select.tsx`)
- UUID validation utility function (`isValidUUID` in `src/lib/utils.ts`)

### Fixed
- LLM JSON output reliability improvements with better validation
- Race condition in publish route (atomic lock acquisition)
- Missing authentication checks on process and debug routes
- N+1 query performance issue in action item/risk detail pages
- Type safety improvements (replaced `any` types with proper interfaces)
- Removed debug console.log statements from production code
- Fixed error tracking in clear-database route (now returns 207 Multi-Status on partial failures)

### Security
- Added admin authorization to all debug routes
- Added project membership verification on update routes
- Improved error handling in authentication middleware
- **Critical**: Added authentication and admin authorization to `/api/admin/refresh-schema` route
- Replaced weak ID generation (`Date.now() + Math.random()`) with cryptographically secure `crypto.randomUUID()`
- Added UUID format validation on all API route parameters to prevent injection attacks
- Sanitized error messages to not expose technical details to clients (generic messages for users, detailed logs for server)
- Added email format validation with RFC 5322 regex on contacts route
- Production safety: Service role key now throws error if missing in production environment

### Changed
- Migrated console logging to structured logger in API routes
- Lock timeout now configurable via `LOCK_TIMEOUT_MINUTES` env variable
- Refactored `OwnerFilter` and `ProjectFilter` components to use shared `FilterSelect` component (DRY principle)
- Improved type safety in LLM processor with `RawLLMOutput` interface

---

## Version History

### December 15, 2025 (Evening)
- **Comprehensive Security & Code Quality Review**
- Fixed critical unauthenticated admin route vulnerability
- Replaced weak ID generation with crypto.randomUUID() across 3 routes
- Added UUID validation to prevent parameter injection
- Sanitized error messages (no technical details exposed to clients)
- Removed console.log statements from production code
- Created reusable FilterSelect component (DRY refactor)
- Added type safety improvements to LLM processor
- Production safety checks for required environment variables

### December 15, 2025
- PRD updated to v2.4
- Added Project Status Report feature (US-F4)
- Added Project Contacts table for external stakeholder management
- Security fixes for debug routes and update authorization

### December 14, 2025
- Code review fixes (14 issues addressed)
- Bug fixes from automated analysis (8 critical/high issues resolved)
- Implemented structured logging

### December 13, 2025
- Initial PRD v2.3 approval
- Core MVP features complete
