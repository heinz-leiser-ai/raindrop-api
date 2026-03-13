# RDBE-6: Suche & Filter

## Status: Backend Done
**Created:** 2026-03-13  
**Last Updated:** 2026-03-13

### Backend-Dateien
- `supabase/functions/api/routes/raindrops.ts` – Listing mit Search/Sort/Page/Nested + Recent Searches
- `supabase/functions/api/routes/tags.ts` – Filters-Endpoint (Tags, Types, Domains)
- `supabase/functions/api/routes/collections.ts` – lastAction Freshness-Check
- `supabase/migrations/20260313000004_recent_searches.sql` – Recent Searches Tabelle

## Dependencies
- RDBE-1
- RDBE-3
- RDBE-4
- RDBE-5

## User Stories
- As a user, I want full-text search over my bookmarks so that I find items fast.
- As a user, I want sort and pagination so that large result sets are usable.
- As a user, I want filter metadata (tags/types/etc.) so that I can narrow results.
- As a user, I want collection-aware filters so that each space reflects its own data.

## Acceptance Criteria
- [ ] Search endpoint supports expected query operators from frontend usage.
- [ ] Sort options and pagination are accepted and return deterministic results.
- [ ] Filter endpoint returns data structure required by frontend reducers.
- [ ] `lastAction/version` style freshness endpoints are available for reload optimization.
- [ ] Access control ensures users only search in permitted data.

## Edge Cases
- Invalid search operator syntax.
- Query returns extremely large result set.
- Stale pagination after data mutation.
- Nested collection filter with partial permissions.
- Empty query should still return default sorted results.

## Technical Requirements (optional)
- Performance: indexed search fields and stable pagination strategy.
- Compatibility: contracts align with `src/data/sagas/filters.js` and `bookmarks/space.js`.
- Security: prevent data leakage across users via search endpoints.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Architektur-Entscheid

Suche und Filter sind ueber mehrere bestehende Route-Handler verteilt (keine eigene Datei noetig):

- **Volltextsuche**: Postgres `tsvector` in `raindrops` (gewichtet: title A, excerpt B, note C, domain D)
- **Operatoren**: `#tag`, `type:xxx`, `domain:xxx`, `important:true/false`, Freitext
- **Sortierung**: `-created`, `created`, `score`, `-sort`, `title`, `-title`, `domain`, `-domain`
- **Pagination**: Offset-basiert (`page * perpage`, max 50)
- **Filters**: Aggregation aus `raindrops` → Tags, Types, Domains, Important-Count
- **Freshness**: `collection/{id}/lastAction` liefert Timestamp
- **Recent Searches**: Eigene Tabelle, wird bei jeder Suche automatisch befuellt

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
