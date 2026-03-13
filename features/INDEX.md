# Feature Index

**Project:** Raindrop Self-hosted Backend (Supabase)  
**Next Available ID:** RDBE-12


| ID      | Name                        | Priority | Status  | Hauptpfade                                                           | Kurzbeschreibung                                      |
| ------- | --------------------------- | -------- | ------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| RDBE-1  | Auth (Email + Social Login) | P0       | Backend Done | `v1/authentication/`*, `src/data/sagas/user.js`                      | Login, Session, OAuth-Basis fuer geschlossenen Zugang |
| RDBE-2  | User-Profil & Config        | P0       | Backend Done | `v1/user/*`, `src/data/sagas/user.js`                                | Userprofil und Konfiguration lesen/schreiben          |
| RDBE-3  | Collections CRUD            | P0       | Backend Done | `v1/collections/*`, `src/data/sagas/collections/*`                   | Collections erstellen, aktualisieren, loeschen, laden |
| RDBE-4  | Raindrops CRUD              | P0       | Backend Done | `v1/raindrops/*`, `src/data/sagas/bookmarks/*`                       | Bookmarks verwalten inkl. Single/Batch-Flows          |
| RDBE-5  | Tags                        | P0       | Backend Done | `v1/tags.md`, `src/data/sagas/tags/*`                                | Tags laden, umbenennen, loeschen                      |
| RDBE-6  | Suche & Filter              | P0       | Backend Done | `v1/filters.md`, `src/data/sagas/filters.js`                         | Suche, Sortierung, Pagination, Filterdaten            |
| RDBE-7  | File Upload (Storage)       | P0       | Backend Done | `v1/raindrops/single.md`, `v1/collections/covers-icons.md`           | Upload von Dateien und Covern ueber Storage           |
| RDBE-8  | Import / Export             | P1       | Backend Done | `v1/import.md`, `v1/export.md`, `src/data/sagas/import.js`           | Daten importieren/exportieren fuer Migration          |
| RDBE-9  | Highlights                  | P1       | Backend Done | `v1/highlights.md`, `src/data/sagas/bookmarks/highlights.js`         | Highlights speichern und abrufen                      |
| RDBE-10 | Sharing & Collaboration     | P1       | Backend Done | `v1/collections/sharing.md`, `src/data/sagas/collections/sharing.js` | Collections teilen, Nutzerrollen, Join-Token          |
| RDBE-11 | Backups                     | P1       | Backend Done | `v1/backups.md`, `src/data/sagas/backups.js`                         | Backup-Objekte erzeugen und abrufen                   |


## Empfohlene Build-Reihenfolge

1. RDBE-1
2. RDBE-2
3. RDBE-3
4. RDBE-4
5. RDBE-5
6. RDBE-6
7. RDBE-7
8. RDBE-10
9. RDBE-9
10. RDBE-8
11. RDBE-11

## Annahmen

- Hosting-Ziel (self-hosted Supabase vs Supabase Cloud EU) ist noch offen.
- AI/Stella bleibt bis nach P1 ausserhalb des Scopes.

