# Product Requirements Document (PRD)

## Vision
Wir bauen ein self-hosted, Raindrop-kompatibles Backend auf Supabase, damit Lesezeichen-Daten nicht in den USA liegen muessen. Der Fokus liegt auf API-Kompatibilitaet zum bestehenden `raindrop-app` Fork, damit das Frontend mit minimalen Anpassungen weiter genutzt werden kann. Das Produkt startet als private Loesung fuer eine kleine Gruppe/Familie.

## Target Users
- Private Power-User mit hohem Datenschutzbedarf
- Kleine Familien/Teams mit gemeinsamem Bookmark-Bestand
- Technische Betreiber, die Daten auf eigener Infrastruktur hosten wollen

## Core Features (Roadmap)
| Priority | ID | Feature | Kurzbeschreibung | Status |
|---|---|---|---|---|
| P0 | RDBE-1 | Auth (Email + Social Login) | Login, Session, OAuth-Basis fuer geschlossenen Zugang | Planned |
| P0 | RDBE-2 | User-Profil & Config | Benutzerprofil und App-Konfiguration laden/speichern | Planned |
| P0 | RDBE-3 | Collections CRUD | Ordnerstruktur inklusive nested Collections | Planned |
| P0 | RDBE-4 | Raindrops CRUD | Bookmarks erstellen, lesen, aktualisieren, loeschen | Planned |
| P0 | RDBE-5 | Tags | Tag-Verwaltung und Umbenennen/Loeschen | Planned |
| P0 | RDBE-6 | Suche & Filter | Suchoperatoren, Sortierung, Pagination, Filterdaten | Planned |
| P0 | RDBE-7 | File Upload | Upload von Dateien/Covers via Supabase Storage | Planned |
| P1 | RDBE-8 | Import / Export | Datenimport und Exporte fuer Migration/Backup | Planned |
| P1 | RDBE-9 | Highlights | Text-Highlights an Bookmarks speichern/lesen | Planned |
| P1 | RDBE-10 | Sharing & Collaboration | Collections teilen, Rollen, Einladungen | Planned |
| P1 | RDBE-11 | Backups | Automatisierte und manuelle Backup-Objekte | Planned |
| P0 | RDBE-12 | Token-basierte Auth | Token statt Cookie fuer persistente Sessions (WebApp + Extension) | Planned |
| P2 | RDBE-13 | AI Suggestions/Stella | AI-Features spaeter als separater Block | Planned |

## Success Metrics
- 95%+ der im Frontend genutzten `v1` Calls antworten kompatibel (Schema + Semantik)
- 100% der P0-Flows fuer eine Testgruppe von 3-10 Nutzern funktionieren stabil
- P0-API Fehlerquote < 1% ueber 7 Tage
- Median-Antwortzeit fuer P0 Read-Endpunkte < 300 ms

## Constraints
- Backend-only Scope: Frontend wird geforkt und nur minimal konfiguriert
- Keine oeffentliche Massen-Registrierung im MVP
- Hosting-Entscheid zwischen self-hosted Supabase und Supabase Cloud EU ist offen
- API muss mit Cookie-/Session-Verhalten des bestehenden Frontends kompatibel sein (`credentials: include`), Token-Auth wird parallel eingefuehrt (RDBE-12)

## Non-Goals
- Kein Mobile-Neubau (iOS/Android out of scope)
- Kein kompletter 1:1 Klon aller proprietaeren internen Raindrop-Dienste
- Kein AI/Stella im MVP
- Keine offene Public-Community-Plattform
