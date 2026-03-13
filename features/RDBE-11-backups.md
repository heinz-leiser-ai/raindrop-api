# RDBE-11: Backups

## Status: Backend Done
**Created:** 2026-03-13  
**Last Updated:** 2026-03-13

### Backend-Dateien
- `supabase/migrations/20260313000007_backups.sql` – Backups Tabelle + RLS
- `supabase/functions/api/routes/backups.ts` – List, Create, Download Endpunkte

## Dependencies
- RDBE-1
- RDBE-3
- RDBE-4
- RDBE-8

## User Stories
- As a user, I want to view available backups so that I know my recovery points.
- As a user, I want to trigger a backup so that I can secure current state before risky actions.
- As an admin, I want backup retention control so that storage remains manageable.
- As a user, I want restore path defined so that recovery is possible.

## Acceptance Criteria
- [ ] Backups listing endpoint returns user-scoped backup objects.
- [ ] Backup creation trigger endpoint exists and reports status.
- [ ] Backup metadata includes timestamp, size/state, and type.
- [ ] Retention policy rules are enforceable.
- [ ] Access to backups is restricted to owner/admin scope.

## Edge Cases
- Backup job fails mid-process.
- User triggers backup too frequently.
- Restore requested from missing/corrupted backup.
- Backup includes references to deleted storage objects.
- Concurrent backup and large import run at same time.

## Technical Requirements (optional)
- Reliability: background job execution with retry and observability.
- Security: encrypted backup artifacts at rest.
- Compatibility: endpoint contracts satisfy frontend `backups` sagas.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
