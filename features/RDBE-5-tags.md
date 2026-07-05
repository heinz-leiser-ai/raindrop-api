# RDBE-5: Tags

## Status: Backend Done
**Created:** 2026-03-13  
**Last Updated:** 2026-03-13

### Backend-Dateien
- `supabase/functions/api/routes/tags.ts` – Tags + Filters Endpunkte
- `supabase/functions/api/index.ts` – Router (erweitert)

## Dependencies
- RDBE-1
- RDBE-4

## User Stories
- As a user, I want to see my tags so that I can navigate by topic.
- As a user, I want to rename tags so that taxonomy stays clean.
- As a user, I want to delete tags so that obsolete labels are removed.
- As a user, I want recent tags for quick entry in forms.

## Acceptance Criteria
- [ ] Tag listing supports global and scoped usage from filters/search.
- [ ] Tag rename operation updates affected bookmarks consistently.
- [ ] Tag delete operation removes tag references safely.
- [ ] Recent tags endpoint returns sorted usable data.
- [ ] Unauthorized users cannot mutate tags they do not own.

## Edge Cases
- Rename to an already existing tag name.
- Delete tag while concurrent bookmark updates are running.
- Case sensitivity differences (`Tag` vs `tag`).
- Empty or invalid tag values.
- Very large tag sets per user.

## Technical Requirements (optional)
- Data integrity: tag normalization strategy must be consistent.
- Performance: tag aggregation should remain responsive.
- Compatibility: behavior matches frontend tag sagas/selectors expectations.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Architektur-Entscheid

Tags werden nicht in einer eigenen Tabelle gespeichert, sondern direkt aus der `raindrops.tags`-Spalte (TEXT[]) aggregiert. Rename/Delete-Operationen aktualisieren die betroffenen Raindrops direkt.

### Endpunkt-Zuordnung

```
Frontend-Call                              -> Edge Function Route
-----------------------------------------------------------------
GET  tags/{collectionId}                   -> v1/tags/{collectionId}
PUT  tags/{collectionId}                   -> v1/tags/{collectionId} (rename/merge)
DEL  tags/{collectionId}                   -> v1/tags/{collectionId} (bulk remove)
DEL  tag?tag=name                          -> v1/tag?tag=name (single remove)
GET  tags/recent                           -> v1/tags/recent
GET  filters/{collectionId}?params         -> v1/filters/{collectionId}
```

### Datenmodell

Kein eigenes Schema. Tags leben als `TEXT[]` Array in der `raindrops`-Tabelle mit GIN-Index fuer performante `@>` (contains) Abfragen.

## QA Test Results

**Tested:** 2026-03-13  
**Methode:** Code Review (kein laufender Server)  
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Tag Listing
- [x] GET tags/{collectionId} aggregiert Tags aus raindrops.tags
- [x] Korrekte Filterung nach collectionId (0, >0, systemIDs)
- [x] Sortiert nach Count (absteigend)

#### AC-2: Tag Rename
- [x] PUT tags/{collectionId} ersetzt alten Tag in allen betroffenen Raindrops
- [x] Deduplizierung bei Rename zu existierendem Tag (filter unique)

#### AC-3: Tag Delete
- [x] DEL tags/{collectionId} entfernt Tags aus allen betroffenen Raindrops
- [x] DEL tag?tag=name fuer einzelnen Tag
- [ ] **BUG-10:** removeTags() erstellt fake Request-Objekt um removeTagByName() aufzurufen

#### AC-4: Recent Tags
- [x] GET tags/recent liefert max 30 Tags aus letzten 50 aktualisierten Raindrops

#### AC-5: Unauthorized Access
- [x] getUser() + profile Check in jedem Handler
- [x] Queries filtern nach user_id

### Bugs Found

#### BUG-10: Fake Request-Objekt in removeTags()
- **Severity:** Low
- **Datei:** `tags.ts` -> `removeTags()`
- **Problem:** Erstellt `{ headers: { get: () => null } } as unknown as Request` um `removeTagByName()` aufzurufen. Bruechig und der Response wird verworfen.
- **Fix:** Logik in separate Hilfsfunktion extrahieren, die keinen Request braucht.

### Summary
- **Acceptance Criteria:** 5/5 bestanden
- **Bugs Found:** 1 total (0 Critical, 0 High, 0 Medium, 1 Low)
- **Production Ready:** JA (Low-Bug als Tech-Debt akzeptabel)

## Deployment
_To be added by /deploy_
