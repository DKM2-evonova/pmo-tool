# Changelog

All notable changes to the PMO Tool are documented here.

## [Unreleased]

### Added
- Project Status Report with PDF and Excel export (multi-sheet workbook)
- Project Contacts for managing non-login users (external stakeholders)
- Structured logging utility with scoped loggers (`src/lib/logger.ts`)
- Processing time estimation based on historical LLM performance data

### Fixed
- LLM JSON output reliability improvements with better validation
- Race condition in publish route (atomic lock acquisition)
- Missing authentication checks on process and debug routes
- N+1 query performance issue in action item/risk detail pages
- Type safety improvements (replaced `any` types with proper interfaces)

### Security
- Added admin authorization to all debug routes
- Added project membership verification on update routes
- Improved error handling in authentication middleware

### Changed
- Migrated console logging to structured logger in API routes
- Lock timeout now configurable via `LOCK_TIMEOUT_MINUTES` env variable

---

## Version History

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
