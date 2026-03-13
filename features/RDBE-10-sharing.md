# RDBE-10: Collection Sharing & Kollaboration

## Status: Planned
**Created:** 2026-03-13  
**Last Updated:** 2026-03-13

## Dependencies
- RDBE-1
- RDBE-3
- RDBE-4

## User Stories
- As a collection owner, I want to invite collaborators so that we can work together.
- As a collaborator, I want role-based permissions so that edit rights are controlled.
- As a user, I want to accept invite links so that onboarding into shared collections is easy.
- As an owner, I want to revoke access so that sharing stays secure.

## Acceptance Criteria
- [ ] Sharing list endpoint returns collaborators for a collection.
- [ ] Invite link/token generation endpoint is available.
- [ ] Role updates and collaborator removal work with permission checks.
- [ ] Unshare endpoint removes shared access cleanly.
- [ ] Join-by-token endpoint adds user to collection and returns target collection ID.

## Edge Cases
- Expired or invalid invite token.
- User already collaborator and gets invited again.
- Owner removes own access by mistake.
- Permission downgrade while collaborator is editing.
- Shared collection deleted while invites are active.

## Technical Requirements (optional)
- Security: strict role model (viewer/editor/owner behavior defined).
- Auditability: key sharing changes should be traceable.
- Compatibility: behavior aligns with `src/data/sagas/collections/sharing.js`.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
