# Changelog

All notable changes to the PMO Tool are documented here.

---

## [1.1.1] - December 21, 2025

### Added
- **Milestones tab in Project Status Report dashboard**: View all project milestones with status and target dates
- **Milestones worksheet in Excel export**: 4th worksheet with same professional styling as other sheets
  - Color-coded status badges (Not Started, In Progress, Behind Schedule, Complete)
  - Strikethrough for completed milestones
  - Overdue date highlighting
  - Summary footer with status counts

---

## [1.1.0] - December 21, 2025

### Added
- **Toast notification system** replacing all browser alerts
- **Code optimization complete**: 109 issues identified, all critical/high/medium resolved
- AbortController cleanup in fetch-based useEffect hooks
- Evidence table RLS policies for UPDATE/DELETE operations

### Changed
- ReviewUI component split into 8 smaller components (1,467 → 901 lines)
- Duplicate detection now runs in parallel (Promise.all)
- Fuse.js index caching with 1-minute TTL
- Embedding caching with LRU (500 entries, 30-min TTL)

### Fixed
- Race condition in publish route (atomic lock acquisition)
- OAuth CSRF vulnerability (added HMAC-SHA256 signatures)
- Audit log column name mismatches in batch function
- JSON parsing error handling across all API routes

---

## [1.0.0] - December 15, 2025

### Added
- **Liquid Glass Design System**: Premium glassmorphism UI
- **Google Calendar Integration**: OAuth connection for meeting import
- **Project Status Reports**: PDF and Excel export (multi-sheet workbook)
- **Project Contacts**: External stakeholder management
- **Structured logging**: Scoped loggers with timed operations
- **Processing time estimation**: Based on historical LLM performance
- **Error Boundary component**: Graceful error handling with fallback UI
- Reusable `FilterSelect` component for URL-based filtering
- UUID validation utility (`isValidUUID`)

### Changed
- Complete UI overhaul with glass panels, cards, and animations
- Dashboard: Glass stat cards with gradients
- Kanban board: Premium drag animations, glass columns
- All tables: Consistent glass styling, gradient avatars
- Core UI components updated: Button, Input, Select, Badge, Modal

### Security
- Admin authorization on all debug routes
- Project membership verification on update routes
- UUID format validation on API parameters
- Error message sanitization (no technical details exposed)
- Production safety checks for environment variables
- Replaced weak ID generation with `crypto.randomUUID()`

### Fixed
- LLM JSON output reliability improvements
- Missing authentication on process and debug routes
- N+1 query performance in detail pages
- Type safety improvements (removed `any` types)

---

## [0.9.0] - December 13, 2025

### Added
- Initial PRD v2.3 approval
- Core MVP features complete:
  - Meeting transcript processing (VTT, TXT, DOCX, PDF)
  - AI extraction with Gemini 3 Pro / GPT-5.2 fallback
  - Action items, decisions, and risk management
  - Review workflow with lock mechanism
  - Owner resolution pipeline (7 steps)
  - Semantic duplicate detection (pgvector)
  - Dashboard with due items and lookahead
  - CSV/DOCX/PDF exports
  - RBAC with project scoping

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 1.1.1 | Dec 21, 2025 | Milestones in status reports (dashboard + Excel) |
| 1.1.0 | Dec 21, 2025 | Code optimization complete, toast system |
| 1.0.0 | Dec 15, 2025 | Liquid Glass UI, Google Calendar, security hardening |
| 0.9.0 | Dec 13, 2025 | MVP approval, core features complete |
