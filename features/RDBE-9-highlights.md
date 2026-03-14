# RDBE-9: Highlights

## Status: Backend Done
**Created:** 2026-03-13  
**Last Updated:** 2026-03-13

### Backend-Dateien
- `supabase/functions/api/routes/highlights.ts` – GET highlights + GET highlights/{collectionId}
- `supabase/functions/api/routes/raindrops.ts` – Highlights Merge/Add/Remove Logik in updateRaindrop

## Dependencies
- RDBE-1
- RDBE-4

## User Stories
- As a user, I want to save text highlights for bookmarks so that key content is preserved.
- As a user, I want to list and edit highlights so that notes stay useful.
- As a user, I want highlight operations to respect bookmark permissions.

## Acceptance Criteria
- [ ] Highlight create/read/update/delete is available for authorized users.
- [ ] Highlights are linked to valid bookmark IDs.
- [ ] Highlight response format is compatible with frontend expectations.
- [ ] Deleting a bookmark handles dependent highlights according to policy.
- [ ] Unauthorized highlight access is blocked.

## Edge Cases
- Highlight references a bookmark that no longer exists.
- Empty/oversized highlight text.
- Duplicate highlights with same range/text.
- Concurrent updates to same highlight.
- Highlight create on bookmark without read permission.

## Technical Requirements (optional)
- Data integrity: enforce foreign key/reference consistency.
- Security: ownership or sharing checks on every highlight operation.
- Compatibility: align with `v1/highlights.md` and frontend highlight usage.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results

**Tested:** 2026-03-13  
**Methode:** Code Review (kein laufender Server)  
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: CRUD
- [x] Add: Highlights ohne `_id` werden mit UUID + Timestamps erstellt
- [x] Update: Highlights mit `_id` werden gemergt + `lastUpdate` gesetzt
- [x] Delete: Highlights mit `_id` und `text: ''` werden entfernt
- [x] List: GET highlights + GET highlights/{collectionId}

#### AC-2: Bookmark-Verknuepfung
- [x] Highlights leben als JSONB in `raindrops.highlights`
- [x] Listing liefert `raindropRef`, `link`, `title` pro Highlight

#### AC-3: Response-Format
- [x] Items mit `_id, text, color, note, created, tags, raindropRef, link, title`
- [x] Pagination mit `page`, `perpage`, `count`

#### AC-4: Cascading Delete
- [x] Highlights sind Teil des Raindrop-Records (automatisch geloescht)

#### AC-5: Auth
- [x] getUser() + profile Check
- [x] user_id Filter in Queries

### Summary
- **Acceptance Criteria:** 5/5 bestanden
- **Bugs Found:** 0
- **Production Ready:** JA

## Deployment
_To be added by /deploy_
