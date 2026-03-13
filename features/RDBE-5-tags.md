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
_To be added by /qa_

## Deployment
_To be added by /deploy_
