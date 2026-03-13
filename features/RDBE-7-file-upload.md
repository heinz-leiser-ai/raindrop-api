# RDBE-7: File Upload (Supabase Storage)

## Status: Planned
**Created:** 2026-03-13  
**Last Updated:** 2026-03-13

## Dependencies
- RDBE-1
- RDBE-3
- RDBE-4

## User Stories
- As a user, I want to upload bookmark files so that I can store non-link resources.
- As a user, I want to upload bookmark/collection covers so that visual organization improves.
- As an admin, I want controlled upload limits so that storage abuse is prevented.
- As a user, I want uploaded files tied to my entities so that access is private and secure.

## Acceptance Criteria
- [ ] Upload endpoints for bookmark files and covers exist and return compatible payload.
- [ ] Files are stored in Supabase Storage with per-user access controls.
- [ ] File type and size validation is enforced server-side.
- [ ] Upload errors return consistent `error` and `errorMessage` shape.
- [ ] Deleting related entities handles file lifecycle policy as defined.

## Edge Cases
- Upload without file field.
- Unsupported file type or oversized file.
- Upload interrupted mid-transfer.
- Duplicate file names in same path.
- User tries to access another user's private upload.

## Technical Requirements (optional)
- Security: signed URLs or controlled public/private buckets by use case.
- Reliability: resumable strategy optional, clear failure behavior required.
- Compatibility: endpoint behavior aligns with frontend upload saga calls.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
