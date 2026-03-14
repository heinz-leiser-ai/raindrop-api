# RDBE-8: Import / Export

## Status: Backend Done
**Created:** 2026-03-13  
**Last Updated:** 2026-03-13

### Backend-Dateien
- `supabase/functions/api/routes/import-export.ts` – Import/Export Endpunkte

## Dependencies
- RDBE-1
- RDBE-3
- RDBE-4
- RDBE-7

## User Stories
- As a user, I want to import bookmarks from files so that migration is easy.
- As a user, I want duplicate detection so that imports do not create clutter.
- As a user, I want export options so that I keep data portability.
- As an admin, I want import progress and failure visibility so that support is possible.

## Acceptance Criteria
- [ ] Import file upload endpoint accepts supported formats and returns parsed preview/result.
- [ ] Duplicate URL check endpoint is available for pre-import filtering.
- [ ] Batch creation flow for imported items works with progress reporting contract.
- [ ] Export endpoint provides user-scoped data dump in defined format.
- [ ] Import/export operations require authentication and enforce ownership.

## Edge Cases
- Corrupted import file.
- Unsupported format version.
- Very large import causing timeout.
- Partial import success with per-item failures.
- Export request while concurrent edits are running.

## Technical Requirements (optional)
- Reliability: long-running operations may require async job model.
- Performance: chunked processing for large imports.
- Compatibility: align with `src/data/sagas/import.js` behavior expectations.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results

**Tested:** 2026-03-13  
**Methode:** Code Review (kein laufender Server)  
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Import File Upload
- [x] POST import/file akzeptiert FormData mit `import` Feld
- [x] Netscape-HTML-Parser extrahiert Ordner, Bookmarks, Tags, Datum, Beschreibungen
- [x] Response: `{result, items, count}`

#### AC-2: Duplicate URL Check
- [x] POST import/url/exists prueft bis zu 500 URLs
- [x] Response: `{result, ids, duplicates}`

#### AC-3: Batch Creation
- [x] Nutzt bestehenden POST raindrops Endpoint (RDBE-4)

#### AC-4: Export
- [x] CSV-Export mit korrekter Escaping
- [x] HTML-Export im Netscape-Format
- [ ] **BUG-11:** Export-Routen nicht erreichbar (Routing-Bug)

#### AC-5: Auth
- [x] getUser() + profile Check in allen Handlern

### Security Audit

- [ ] **BUG-12:** Export-Responses (CSV/HTML) haben keine CORS-Headers. Browser blockiert Response bei credentials:include.

### Bugs Found

#### BUG-11: Export-Routen nicht erreichbar (Routing-Bug)
- **Severity:** High
- **Datei:** `index.ts` (Router)
- **Problem:** `raindrops/{id}/export.csv` matcht `path.startsWith('raindrop')` (Zeile 40) und wird an `handleRaindropRoutes` geschickt. Dort matcht Regex `^raindrops\/(-?\d+)(.*)$` und ruft `listRaindrops` statt Export auf. Der Export-Check auf Zeile 53 ist unerreichbarer Code.
- **Fix:** Export-Route VOR der raindrop-Route pruefen, oder Export direkt in `handleRaindropRoutes` integrieren.

#### BUG-12: Export/Download ohne CORS-Headers
- **Severity:** Medium
- **Datei:** `import-export.ts` -> `exportRaindrops()`, `backups.ts` -> `downloadBackup()`
- **Problem:** Gibt `new Response()` ohne CORS-Headers zurueck. Frontend mit `credentials: include` bekommt Response vom Browser blockiert.
- **Fix:** CORS-Headers auch bei File-Responses setzen.

### Summary
- **Acceptance Criteria:** 4/5 bestanden (Export nicht erreichbar)
- **Bugs Found:** 2 total (1 High, 1 Medium)
- **Production Ready:** NEIN (BUG-11 blockiert Export komplett)

## Deployment
_To be added by /deploy_
