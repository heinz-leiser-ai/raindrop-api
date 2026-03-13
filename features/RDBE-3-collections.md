# RDBE-3: Collections CRUD

## Status: Backend Done
**Created:** 2026-03-13  
**Last Updated:** 2026-03-13

### Backend-Dateien
- `supabase/migrations/20260313000002_collections.sql` – Tabelle, RLS, Trigger
- `supabase/functions/api/routes/collections.ts` – Alle Collection-Endpunkte
- `supabase/functions/api/index.ts` – Router (erweitert)
- `supabase/functions/api/routes/user.ts` – user/stats mit echten Counts

## Dependencies
- RDBE-1
- RDBE-2

## User Stories
- As a user, I want to create collections so that I can organize bookmarks.
- As a user, I want nested collections so that structure stays clean.
- As a user, I want to rename and reorder collections so that navigation matches my workflow.
- As a user, I want to delete collections safely so that items are moved as expected.

## Acceptance Criteria
- [ ] Root and child collection listing endpoints return compatible items.
- [ ] Create/update/delete collection flows work for authorized users.
- [ ] Reorder and expand/collapse operations are supported.
- [ ] Collection access rights are enforced for write operations.
- [ ] System collection counters can be returned as required by frontend.

## Edge Cases
- Create collection with duplicate title under same parent.
- Move collection under invalid or circular parent.
- Delete collection containing nested children.
- User without write rights tries to update shared collection.
- Bulk operations with partially invalid IDs.

## Technical Requirements (optional)
- Data integrity: Parent-child relationships must prevent loops.
- Security: Ownership/membership check for all mutating calls.
- Compatibility: Endpoints used in `src/data/sagas/collections/*` must match payload contract.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Architektur-Entscheid

Collections werden als eigene Postgres-Tabelle mit Self-Referencing Parent-Beziehung abgebildet. Edge Functions liefern die v1-kompatible REST-Fassade. RLS sichert den Zugriff ab.

**Warum Postgres-Tabelle statt verschachtelter JSON-Dokumente?**
- Parent-Child-Beziehungen lassen sich sauber mit Foreign Keys abbilden.
- Sortierung, Counts und Batch-Updates sind performant ausfuehrbar.
- RLS kann direkt auf Zeilenebene greifen.

### Endpunkt-Zuordnung (Frontend -> Backend)

```
Frontend-Call                           -> Edge Function Route
-------------------------------------------------------------
GET  collections/all                    -> v1/collections/all
GET  collection/{id}                    -> v1/collection/{id}
POST collection                         -> v1/collection
PUT  collection/{id}                    -> v1/collection/{id}
DEL  collection/{id}                    -> v1/collection/{id}
PUT  collections (reorder/expand/view)  -> v1/collections
DEL  collections (bulk delete)          -> v1/collections
PUT  collections/merge                  -> v1/collections/merge
PUT  collections/clean                  -> v1/collections/clean
GET  user/stats                         -> v1/user/stats
GET  collection/{id}/lastAction         -> v1/collection/{id}/lastAction
```

### Datenmodell (Klartext)

```
Jede Collection hat:
- _id (Integer, auto-increment, primaer)
- title (Text, Name der Collection)
- parent_id (Integer, nullable, Verweis auf uebergeordnete Collection)
- user_id (Integer, Besitzer, Verweis auf profiles)
- color (Text, optional, HEX-Farbcode)
- cover (Text-Array, Cover-URL)
- view (Text, Standard "list", erlaubt: list/simple/grid/masonry)
- public (Boolean, Standard false)
- expanded (Boolean, Standard false)
- sort (Integer, Reihenfolge)
- count (Integer, automatisch gepflegt)
- created (Timestamp)
- last_update (Timestamp)

System-Collections (_id = -1 "Unsorted", _id = -99 "Trash"):
- Werden nicht in der Tabelle gespeichert
- Existieren virtuell und werden bei Abfragen dynamisch erzeugt
- Counts kommen aus der Raindrops-Tabelle (WHERE collection_id IN (-1, -99))
```

### Komponenten-Uebersicht

```
Collections System
+-- Edge Functions (API-Fassade)
|   +-- v1/collections/all (Root + Children als flache Liste)
|   +-- v1/collection/{id} (Einzelne Collection laden)
|   +-- v1/collection (POST: neue Collection anlegen)
|   +-- v1/collection/{id} (PUT: aktualisieren)
|   +-- v1/collection/{id} (DEL: loeschen, Raindrops -> Trash)
|   +-- v1/collections (PUT: bulk reorder/expand/view)
|   +-- v1/collections (DEL: bulk delete)
|   +-- v1/collections/merge (PUT: Collections zusammenfuehren)
|   +-- v1/collections/clean (PUT: leere Collections entfernen)
|   +-- v1/user/stats (GET: System-Collection-Counts)
|   +-- v1/collection/{id}/lastAction (GET: Freshness-Check)
+-- Postgres
|   +-- collections Tabelle (mit RLS Policy: owner oder Sharing-Mitglied)
|   +-- Trigger/Function fuer automatisches Count-Update
|   +-- Check Constraint: parent_id darf nicht auf sich selbst verweisen
+-- Response-Mapping
    +-- Integer _id bleibt erhalten
    +-- parent.$id Notation fuer verschachtelte Ausgabe
    +-- access.level wird aus Besitz/Sharing-Status berechnet
    +-- access.draggable wird aus Ownership abgeleitet
```

### Loeschverhalten

```
Beim Loeschen einer Collection:
1. Alle Raindrops in der Collection werden nach Trash (-99) verschoben
2. Alle Kind-Collections werden rekursiv gleich behandelt
3. Die Collection selbst wird aus der Tabelle entfernt

Beim Loeschen von Trash (DEL collection/-99):
- Alle Raindrops mit collection_id = -99 werden permanent geloescht
```

### Tech-Entscheidungen

| Entscheidung | Wahl | Begruendung |
|---|---|---|
| Speicher | Postgres-Tabelle mit Self-Reference | Baum-Struktur, effiziente Queries, RLS-faehig |
| System-Collections | Virtuell (nicht in Tabelle) | Wie im Original; Counts dynamisch berechnet |
| Count-Pflege | Trigger bei Raindrop Insert/Update/Delete | Automatisch und konsistent |
| Loop-Prevention | Check Constraint + Validierung in Edge Function | Verhindert zirkulaere Parent-Beziehungen |
| Sortierung | Integer sort-Feld | Einfach, kompatibel mit Frontend reorder-Logik |

### Dependencies

- Supabase Edge Functions
- Postgres RLS Policies (pro User / pro Sharing-Scope)
- RDBE-1 (Auth muss stehen, damit RLS greift)

## QA Test Results

**Tested:** 2026-03-13  
**Methode:** Code Review (kein laufender Server)  
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Root/Child Collection Listing
- [x] GET collections/all liefert flache Liste mit `items`
- [x] formatCollection() mappt korrekt: `parent.$id`, `user.$id`, `access.level/draggable`
- [x] Sortierung nach `sort`-Feld

#### AC-2: Create/Update/Delete
- [x] POST collection erstellt mit title, parent, cover, color, view
- [x] PUT collection/{id} aktualisiert Felder selektiv
- [x] DELETE collection/{id} verschiebt Raindrops in Trash, loescht Collection
- [x] DELETE collection/-99 leert Trash

#### AC-3: Reorder/Expand
- [x] PUT collections mit `{expanded: bool}` klappt alle auf/zu
- [x] PUT collections mit `{sort: method}` sortiert um
- [x] PUT collections mit `{view: ...}` aendert Ansicht fuer alle

#### AC-4: Access Rights
- [x] RLS Policies pruefen user_id Ownership
- [x] Edge Function prueft Auth via getUser()
- [x] Service Client bypassed RLS (beabsichtigt, Auth-Check davor)

#### AC-5: System Collection Counters
- [x] user/stats liefert Counts fuer _id 0, -1, -99
- [ ] **BUG-4:** user/stats fragt `raindrops`-Tabelle ab, die noch nicht existiert

### Edge Cases Status

#### EC-1: Doppelter Titel unter gleichem Parent
- [x] Erlaubt (wie Original) – kein Bug

#### EC-2: Zirkulaere Parent-Referenz
- [x] Direkte Selbstreferenz: CHECK Constraint `_id != parent_id`
- [ ] **BUG-5:** Indirekte Zyklen (A->B->A) werden nicht verhindert

#### EC-3: Loeschen mit verschachtelten Kindern
- [x] getDescendantIds() sammelt rekursiv alle Kind-IDs
- [x] Raindrops aller betroffenen Collections -> Trash
- [x] CASCADE loescht Kind-Collections

#### EC-4: Nicht-berechtigter Schreibzugriff
- [x] RLS blockiert Zugriff auf fremde Collections

#### EC-5: Bulk-Ops mit ungueltige IDs
- [x] RLS ignoriert nicht-eigene IDs (kein Fehler, kein Effekt)

### Security Audit

- [x] Authentication: Jeder Route-Handler prueft Auth
- [x] Authorization: RLS + user_id Check
- [x] Input Validation: Grundlegende Feldpruefung vorhanden
- [x] Kein SQL-Injection-Risiko (Supabase Client parametrisiert)
- [ ] **BUG-5:** Cycle-Prevention nur fuer direkte Selbstreferenz

### Bugs Found

#### BUG-4: user/stats referenziert nicht-existente raindrops-Tabelle
- **Severity:** High
- **Datei:** `user.ts` -> `handleUserStats()`
- **Problem:** Query auf `raindrops`-Tabelle fuer Unsorted/Trash Counts. Tabelle existiert erst mit RDBE-4 Migration.
- **Fix:** Try-Catch um raindrops-Queries, oder Counts auf 0 defaulten wenn Tabelle fehlt.
- **Priority:** Wird automatisch durch RDBE-4 Migration geloest. Interim: Error-Handling einbauen.

#### BUG-5: Indirekte zirkulaere Parent-Referenzen moeglich
- **Severity:** Medium
- **Datei:** `collections.ts` -> `updateCollection()`
- **Problem:** Collection A als Parent von B, dann B als Parent von A setzen erzeugt Endlosschleife in getDescendantIds().
- **Fix:** Vor parent_id Update pruefen, ob neuer Parent in den Descendants liegt.
- **Priority:** Fix before deployment

### Summary
- **Acceptance Criteria:** 4.5/5 bestanden (user/stats hat Tabellen-Abhaengigkeit)
- **Bugs Found:** 2 total (1 High, 1 Medium)
- **Security:** Gut – Auth/RLS sauber implementiert
- **Production Ready:** NEIN (BUG-5 Cycle-Fix noetig, BUG-4 loest sich mit RDBE-4)
- **Recommendation:** BUG-5 sofort fixen, BUG-4 wird durch RDBE-4 behoben

## Deployment
_To be added by /deploy_
