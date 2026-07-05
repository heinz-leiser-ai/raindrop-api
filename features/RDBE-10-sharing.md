# RDBE-10: Collection Sharing & Kollaboration

## Status: Backend Done
**Created:** 2026-03-13  
**Last Updated:** 2026-03-13

### Backend-Dateien
- `supabase/migrations/20260313000006_sharing.sql` – collection_sharing Tabelle + RLS
- `supabase/functions/api/routes/collections.ts` – Sharing Endpunkte (list, invite, update, remove, unshare, join)

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

**Tested:** 2026-03-13  
**Methode:** Code Review (kein laufender Server)  
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Sharing List
- [x] GET collection/{id}/sharing liefert Collaborators mit user_id, role, joined

#### AC-2: Invite Link
- [x] POST collection/{id}/sharing erzeugt Token + Link
- [ ] **BUG-13:** Kein Ownership-Check – jeder authentifizierte User kann Invite-Links fuer fremde Collections erstellen

#### AC-3: Role Updates
- [ ] **BUG-14:** PUT collection/{id}/sharing/{userId} prueft nicht ob Caller Owner ist

#### AC-4: Unshare
- [ ] **BUG-15:** DEL collection/{id}/sharing prueft nicht ob Caller Owner ist – loescht alle Sharing-Eintraege

#### AC-5: Join by Token
- [x] GET collaborators/join?token= claimed Invite und setzt user_id
- [x] Bereits verwendete Tokens werden abgelehnt (user_id IS NULL Check)

### Security Audit

- [ ] **BUG-13/14/15 (Critical):** Sharing-Endpoints verwenden Service Client (bypassed RLS), pruefen aber NICHT ob der aufrufende User Owner der Collection ist. Jeder authentifizierte User kann:
  - Invite-Links fuer fremde Collections erstellen
  - Rollen in fremden Collections aendern
  - Fremde Collections komplett unssharen
- [x] Join-Token: Einmalverwendung korrekt implementiert
- [x] collection_sharing RLS existiert, wird aber durch Service Client umgangen

### Bugs Found

#### BUG-13: createSharingInvite ohne Ownership-Check
- **Severity:** Critical
- **Datei:** `collections.ts` -> `createSharingInvite()`
- **Problem:** Prueft nicht ob `userId` Owner der `collectionId` ist. Service Client bypassed RLS.
- **Fix:** Vor Insert pruefen: `SELECT 1 FROM collections WHERE _id = collectionId AND user_id = userId`

#### BUG-14: updateSharingUser ohne Ownership-Check
- **Severity:** Critical
- **Datei:** `collections.ts` -> `updateSharingUser()`
- **Problem:** Jeder authentifizierte User kann Rollen in beliebigen Collections aendern.
- **Fix:** Ownership-Query vor dem Update.

#### BUG-15: unshareCollection ohne Ownership-Check
- **Severity:** Critical
- **Datei:** `collections.ts` -> `unshareCollection()`
- **Problem:** Loescht alle Sharing-Eintraege einer Collection ohne Ownership-Pruefung.
- **Fix:** Ownership-Query vor dem Delete.

### Summary
- **Acceptance Criteria:** 2/5 bestanden (3 fehlende Ownership-Checks)
- **Bugs Found:** 3 total (3 Critical)
- **Security:** SCHWERE LUECKEN – Authorization Bypass in Sharing
- **Production Ready:** NEIN (alle 3 Critical Bugs muessen gefixt werden)

## Deployment
_To be added by /deploy_
