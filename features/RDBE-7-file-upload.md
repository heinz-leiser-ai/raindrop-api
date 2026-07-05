# RDBE-7: File Upload (Supabase Storage)

## Status: Backend Done
**Created:** 2026-03-13  
**Last Updated:** 2026-03-13

### Backend-Dateien
- `supabase/migrations/20260313000005_storage_buckets.sql` – Storage Buckets + RLS Policies
- `supabase/functions/api/routes/raindrops.ts` – PUT raindrop/file + PUT raindrop/{id}/cover
- `supabase/functions/api/routes/collections.ts` – PUT collection/{id}/cover

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

### Storage-Architektur

- **raindrop-files** Bucket (privat): Hochgeladene Dateien als Bookmarks. Zugriff nur fuer Owner.
- **raindrop-covers** Bucket (public read): Cover-Bilder fuer Raindrops und Collections. Public lesbar.
- Dateipfad-Schema: `{auth_uid}/{id_or_uuid}.{ext}`

### Limits
- Dateien: max 100MB
- Covers: max 10MB, nur PNG/JPEG/GIF/WEBP
- Storage-Policies pruefen `auth.uid()` im Ordnernamen

## QA Test Results

**Tested:** 2026-03-13  
**Methode:** Code Review (kein laufender Server)  
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Upload Endpoints
- [x] PUT raindrop/file (Datei-Upload, erzeugt neuen Raindrop)
- [x] PUT raindrop/{id}/cover (Cover-Upload, aktualisiert Raindrop)
- [x] PUT collection/{id}/cover (Collection-Cover)

#### AC-2: Storage mit Access Control
- [x] raindrop-files Bucket (privat) mit Owner-RLS
- [x] raindrop-covers Bucket (public read, Owner-write)
- [x] Pfad-Schema: `{auth_uid}/{id}.{ext}`

#### AC-3: Validierung
- [x] Datei: Max 100MB
- [x] Cover: Max 10MB, nur PNG/JPEG/GIF/WEBP
- [x] Fehlende Datei: 400 Error

#### AC-4: Error Shape
- [x] Konsistentes `{error, errorMessage}` Format

#### AC-5: File Lifecycle
- [ ] **BUG-9:** Siehe RDBE-4 – Storage-Dateien werden bei permanentem Raindrop-Delete nicht entfernt

### Summary
- **Acceptance Criteria:** 4.5/5 bestanden (File Lifecycle unvollstaendig)
- **Bugs Found:** 1 (BUG-9 in RDBE-4 dokumentiert, Medium)
- **Production Ready:** BEDINGT (Orphan-Files als Tech-Debt akzeptabel)

## Deployment
_To be added by /deploy_
