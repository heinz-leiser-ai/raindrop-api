# RDBE-2: User-Profil & Config

## Status: Planned
**Created:** 2026-03-13  
**Last Updated:** 2026-03-13

## Dependencies
- RDBE-1

## User Stories
- As a user, I want to load my profile so that the app can show my account data.
- As a user, I want to update profile fields so that my account stays current.
- As a user, I want to store app settings so that UI behavior is persistent.
- As a user, I want subscription-related fields to be available so that feature flags are correct.

## Acceptance Criteria
- [ ] Authenticated `user` endpoint returns profile data in frontend-compatible shape.
- [ ] Profile updates are validated and persisted.
- [ ] User config fields used by frontend can be saved and reloaded.
- [ ] Unauthorized access to user profile endpoints is blocked.
- [ ] Optional avatar upload path is defined and secured.

## Edge Cases
- Partial update with invalid field types.
- Profile update race condition from multiple clients.
- Missing optional config fields for legacy users.
- Avatar upload with unsupported type or too large file.
- Client reads stale profile right after update.

## Technical Requirements (optional)
- Security: User can only read/write own profile.
- Data integrity: Server-side validation for config schema.
- Compatibility: Keep keys expected in `src/data/sagas/user.js`.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
