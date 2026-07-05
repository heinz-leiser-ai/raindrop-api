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

**Tested:** 2026-03-13  
**Methode:** Code Review (kein laufender Server)  
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Listing
- [x] GET backups liefert user-scoped Backup-Objekte

#### AC-2: Creation
- [x] GET backup erzeugt HTML-Backup und speichert in Storage
- [ ] **BUG-16:** Storage-Pfad nutzt integer `userId` statt auth UUID. RLS-Policies pruefen `auth.uid()::text` im Pfad.

#### AC-3: Metadata
- [x] _id, created, status, format in Response

#### AC-4: Retention
- [ ] Keine Retention-Policy implementiert (kein Auto-Cleanup)

#### AC-5: Access Control
- [x] RLS auf backups-Tabelle (user_id Check)
- [x] getUser() + profile in Handler

### Edge Cases

- [ ] **BUG-17:** Synchrone Backup-Erstellung kann bei vielen Raindrops (>10k) Edge Function Timeout ueberschreiten
- [x] Download mit Format-Konvertierung (HTML -> CSV on-the-fly)

### Bugs Found

#### BUG-16: Backup Storage-Pfad inkompatibel mit RLS
- **Severity:** High
- **Datei:** `backups.ts` -> `createBackup()`
- **Problem:** Speichert unter `${userId}/${backupId}.html` wobei `userId` der Integer-ID ist. raindrop-files Storage RLS prueft `auth.uid()::text` (UUID). Upload klappt via Service Client, aber Download-Pfad ist inkonsistent mit anderen Uploads.
- **Fix:** `authUid` (UUID) statt `userId` (Integer) fuer Storage-Pfad verwenden.

#### BUG-17: Synchrone Backup-Erstellung ohne Limit
- **Severity:** Medium
- **Datei:** `backups.ts` -> `createBackup()`
- **Problem:** Laedt ALLE Raindrops in einem Query. Bei 50k+ Bookmarks Speicher-/Timeout-Risiko.
- **Fix:** Pagination oder Limit einbauen. Alternativ: Async Job mit Status-Tracking.

### Summary
- **Acceptance Criteria:** 3.5/5 bestanden (Storage-Pfad Bug, keine Retention)
- **Bugs Found:** 2 total (1 High, 1 Medium)
- **Production Ready:** NEIN (BUG-16 muss gefixt werden)

## Deployment
_To be added by /deploy_
