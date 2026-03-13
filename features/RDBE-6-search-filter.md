# RDBE-6: Suche & Filter

## Status: Planned
**Created:** 2026-03-13  
**Last Updated:** 2026-03-13

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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
