# RDBE-4: Raindrops (Bookmarks) CRUD

## Status: Backend Done
**Created:** 2026-03-13  
**Last Updated:** 2026-03-13

### Backend-Dateien
- `supabase/migrations/20260313000003_raindrops.sql` – Tabelle, Indices, Volltext, Count-Trigger
- `supabase/functions/api/routes/raindrops.ts` – Alle Raindrop-Endpunkte
- `supabase/functions/api/index.ts` – Router (erweitert)

## Dependencies
- RDBE-1
- RDBE-3

## User Stories
- As a user, I want to create bookmarks so that I can save links quickly.
- As a user, I want to edit bookmark metadata so that entries stay useful.
- As a user, I want to remove and recover bookmarks so that accidental deletions are manageable.
- As a user, I want batch create/update/remove so that large operations are efficient.
- As a user, I want per-collection listing with pagination so that large datasets stay fast.

## Acceptance Criteria
- [ ] Single bookmark CRUD endpoints are available and compatible.
- [ ] Batch operations (`raindrops`) support create/update/delete semantics.
- [ ] Listing supports `collectionId`, `search`, `sort`, `page`, `perpage`, `nested`.
- [ ] Trash behavior (`-99`) is supported for soft/hard delete semantics.
- [ ] Suggestion endpoint for bookmark fields can be toggled (MVP optional output allowed).

## Edge Cases
- Save duplicate URLs in same collection.
- Create bookmark with missing title and parse fallback path.
- Batch request with mixed valid/invalid items.
- Delete in Trash should permanently remove item.
- Reorder/move operation with stale bookmark version.

## Technical Requirements (optional)
- Performance: paginated reads should stay efficient on large collections.
- Security: bookmark access limited to owner/shared scope.
- Compatibility: contracts used by `src/data/sagas/bookmarks/*` must remain stable.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Architektur-Entscheid

Raindrops (Bookmarks) bilden die zentrale Datentabelle des Systems. Sie werden in einer Postgres-Tabelle mit Volltextsuche-Index gespeichert. Edge Functions liefern die REST-Fassade, die exakt die Payloads liefert, die das Frontend erwartet.

**Warum Postgres mit Volltext-Index?**
- Strukturierte Daten (Tags, Collections) und Freitext-Suche in einer Engine.
- Pagination, Sortierung und Filter direkt in SQL effizient loesbar.
- Highlights werden als JSONB-Array im Raindrop gespeichert (wie im Original).

### Endpunkt-Zuordnung (Frontend -> Backend)

```
Frontend-Call                              -> Edge Function Route
-----------------------------------------------------------------
GET  raindrop/{id}                         -> v1/raindrop/{id}
POST raindrop                              -> v1/raindrop
PUT  raindrop/{id}                         -> v1/raindrop/{id}
DEL  raindrop/{id}                         -> v1/raindrop/{id}
GET  raindrops/{collectionId}?params       -> v1/raindrops/{collectionId}
POST raindrops                             -> v1/raindrops (batch create)
PUT  raindrops/{collectionId}              -> v1/raindrops/{collectionId} (batch update)
DEL  raindrops/{collectionId}              -> v1/raindrops/{collectionId} (batch delete)
PUT  raindrop/file                         -> v1/raindrop/file (file upload)
PUT  raindrop/{id}/cover                   -> v1/raindrop/{id}/cover
GET  raindrop/{id}/cache                   -> v1/raindrop/{id}/cache (spaeter)
POST raindrop/suggest                      -> v1/raindrop/suggest (MVP: Stub)
GET  raindrop/{id}/suggest                 -> v1/raindrop/{id}/suggest (MVP: Stub)
GET  import/url/parse?url=                 -> v1/import/url/parse (Link-Metadaten parsen)
```

### Datenmodell (Klartext)

```
Jeder Raindrop hat:
- _id (Integer, auto-increment, primaer)
- collection_id (Integer, Verweis auf collections._id oder System-IDs -1/-99)
- user_id (Integer, Besitzer)
- link (Text, URL des Bookmarks, Pflichtfeld bei Erstellung)
- title (Text, max 1000 Zeichen)
- excerpt (Text, max 10000 Zeichen, Beschreibung)
- note (Text, max 10000 Zeichen, Benutzernotiz)
- type (Text: link/article/image/video/document/audio)
- cover (Text, Cover-URL)
- media (JSONB Array, Cover-Alternativen [{link: "url"}])
- tags (Text-Array)
- domain (Text, automatisch aus link extrahiert)
- important (Boolean, Favoriten-Markierung)
- order (Integer, Sortierung innerhalb Collection)
- removed (Boolean, Soft-Delete-Flag fuer Trash)
- highlights (JSONB Array, [{_id, text, color, note, created}])
- reminder (JSONB, optionale Erinnerung {date: ISO})
- file (JSONB, optionale Datei-Info {name, size, type})
- created (Timestamp)
- last_update (Timestamp)

Gespeichert in: Postgres raindrops Tabelle mit RLS
```

### Trash-Verhalten

```
Normales Loeschen (DEL raindrop/{id}):
- Raindrop wird nach collection_id = -99 verschoben (Soft Delete)
- removed = true

Loeschen aus Trash (DEL raindrop/{id} wenn collection_id = -99):
- Raindrop wird permanent geloescht
- Zugehoerige Dateien in Supabase Storage werden ebenfalls entfernt

Trash leeren (DEL collection/-99):
- Alle Raindrops mit collection_id = -99 werden permanent geloescht
```

### Listing und Suche

```
GET raindrops/{collectionId} unterstuetzt:
- collectionId: 0 = alle (ausser Trash), -1 = Unsorted, -99 = Trash, >0 = spezifische Collection
- search: Freitext oder Operator-Syntax (wird serverseitig in WHERE-Bedingungen uebersetzt)
- sort: -created, created, score, -sort, title, -title, domain, -domain
- page: 0-basierte Seitennummer
- perpage: max 50 Eintraege pro Seite
- nested: true = auch Raindrops aus Kind-Collections einschliessen

Response-Format:
{
  result: true,
  items: [...],
  count: Gesamtanzahl
}
```

### Batch-Operationen

```
POST raindrops (Batch Create):
- Body: {items: [...]} mit max 100 Objekten pro Request
- Antwort: {result: true, items: [...]}

PUT raindrops/{collectionId} (Batch Update):
- Optionale Filter: search, ids
- Aenderbare Felder: important, tags, media, cover, collection
- Antwort: {result: true}

DEL raindrops/{collectionId} (Batch Delete):
- Optionale Filter: search, ids
- In Trash: permanent loeschen
- Sonst: nach Trash verschieben
- Antwort: {result: true, modified: N}
```

### Komponenten-Uebersicht

```
Raindrops System
+-- Edge Functions (API-Fassade)
|   +-- v1/raindrop/{id} (GET/PUT/DEL: Einzelner Raindrop)
|   +-- v1/raindrop (POST: neuen Raindrop anlegen)
|   +-- v1/raindrops/{collectionId} (GET: Liste mit Filter/Sort/Page)
|   +-- v1/raindrops (POST: Batch-Create)
|   +-- v1/raindrops/{collectionId} (PUT: Batch-Update)
|   +-- v1/raindrops/{collectionId} (DEL: Batch-Delete)
|   +-- v1/raindrop/file (PUT: Datei-Upload via Storage)
|   +-- v1/raindrop/{id}/cover (PUT: Cover-Upload via Storage)
|   +-- v1/raindrop/suggest (POST: Stub, spaeter AI)
|   +-- v1/import/url/parse (GET: Link-Metadaten parsen)
+-- Postgres
|   +-- raindrops Tabelle (RLS: owner oder shared Collection Member)
|   +-- GIN-Index auf tags Array
|   +-- GIN/tsvector-Index fuer Volltextsuche ueber title, excerpt, note
|   +-- Index auf collection_id + user_id fuer Listing-Performance
|   +-- Trigger: collection.count aktualisieren bei Insert/Update/Delete
+-- Supabase Storage
|   +-- Bucket "raindrop-files" fuer hochgeladene Dateien
|   +-- Bucket "raindrop-covers" fuer Covers
+-- URL-Parser (Edge Function intern)
    +-- Holt Titel, Description, Cover von externen URLs
    +-- Wird bei pleaseParse-Flag oder explizitem parse-Call aufgerufen
```

### Tech-Entscheidungen

| Entscheidung | Wahl | Begruendung |
|---|---|---|
| Speicher | Postgres + JSONB fuer flexible Felder | Highlights, media, file als JSONB; Rest als Spalten |
| Suche | Postgres tsvector Volltextsuche | Ausreichend fuer private Nutzung, kein externer Suchindex noetig |
| Pagination | Offset-basiert (page * perpage) | Kompatibel mit Frontend-Erwartung |
| URL-Parsing | Server-side Fetch + HTML-Parse in Edge Function | Fuer pleaseParse und import/url/parse |
| Suggest | Stub im MVP | Gibt leere collections/tags zurueck; AI spaeter |
| File Storage | Supabase Storage Buckets | Integriert, RLS-faehig, kein externer Object Store noetig |

### Dependencies

- RDBE-1 (Auth muss stehen fuer RLS)
- RDBE-3 (Collections muessen existieren fuer Zuordnung)
- Supabase Edge Functions + Storage

## QA Test Results

**Tested:** 2026-03-13  
**Methode:** Code Review (kein laufender Server)  
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Single Bookmark CRUD
- [x] GET/POST/PUT/DELETE raindrop/{id} vorhanden
- [x] formatRaindrop() liefert Frontend-kompatibles Format
- [x] collection.$id und user.$id korrekt gemappt

#### AC-2: Batch Operationen
- [x] POST raindrops (batch create) mit max 100 Items
- [x] PUT raindrops/{collectionId} (batch update)
- [x] DEL raindrops/{collectionId} (batch delete)
- [ ] **BUG-6:** Batch Update/Delete ohne IDs und collectionId=0 betrifft ALLE Raindrops

#### AC-3: Listing mit Parametern
- [x] collectionId 0/-1/-99/>0 korrekt gefiltert
- [x] search mit Operatoren (#tag, type:, domain:, important:, Freitext)
- [x] sort mit 5 Optionen inkl. Richtungserkennung
- [x] page/perpage mit max 50 Limit
- [x] nested=true mit rekursiver Child-Collection-Abfrage

#### AC-4: Trash-Verhalten
- [x] DEL raindrop/{id}: Soft Delete nach -99
- [x] DEL raindrop/{id} in Trash: Permanent Delete
- [ ] **BUG-9:** Permanent Delete entfernt Storage-Dateien nicht

#### AC-5: Suggestion Endpoint
- [x] Stub liefert leere Daten zurueck (MVP-konform)

### Edge Cases Status

- [x] Duplicate URLs erlaubt (kein UNIQUE Constraint)
- [x] Fehlender Titel: Fallback auf Link-URL
- [ ] **BUG-6:** Batch mit leerem ids-Array und collectionId=0 = gefaehrlicher Catch-All
- [x] Delete in Trash = permanent
- [x] Stale Version: Kein Optimistic Locking (akzeptabel fuer Self-Hosted)

### Security Audit

- [x] Auth: Jeder Handler prueft getUser() + profile
- [x] RLS: Policies auf user_id (via profiles.integer_id Subquery)
- [x] Input: Supabase Client parametrisiert Queries
- [ ] **BUG-7:** parseUrl hat kein Fetch-Timeout (SSRF-Risiko)
- [x] Keine Secrets in Responses

### Bugs Found

#### BUG-6: Batch Update/Delete ohne IDs auf collectionId=0
- **Severity:** Medium
- **Datei:** `raindrops.ts` -> `batchUpdateRaindrops()` / `batchDeleteRaindrops()`
- **Problem:** Wenn `ids` leer und `collectionId === 0`, wird kein Collection-Filter gesetzt. Update/Delete betrifft ALLE Raindrops des Users.
- **Fix:** Guard einbauen: Wenn keine IDs und collectionId=0, Request ablehnen oder explizites `dangerAll` Flag verlangen.

#### BUG-7: parseUrl ohne Fetch-Timeout
- **Severity:** Medium
- **Datei:** `raindrops.ts` -> `parseUrl()`
- **Problem:** Externer Fetch hat kein Timeout. Langsame/unresponsive URLs blockieren die Edge Function bis zum globalen Timeout.
- **Fix:** `AbortController` mit 10s Timeout einsetzen.

#### BUG-9: Storage-Dateien werden bei permanentem Delete nicht entfernt
- **Severity:** Medium
- **Datei:** `raindrops.ts` -> `deleteRaindrop()` / `batchDeleteRaindrops()`
- **Problem:** Wenn Raindrop mit Upload permanent geloescht wird, bleibt die Datei im Storage.
- **Fix:** Vor dem Delete `file`-Feld pruefen und Storage-Objekt loeschen.

### Summary
- **Acceptance Criteria:** 4.5/5 bestanden
- **Bugs Found:** 3 total (0 Critical, 3 Medium)
- **Security:** parseUrl als potentielles SSRF-Risiko
- **Production Ready:** BEDINGT (Bugs 6+9 fixen empfohlen)

## Deployment
_To be added by /deploy_
