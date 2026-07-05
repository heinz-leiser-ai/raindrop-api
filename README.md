# Raindrop Self-hosted Backend

Self-hosted Backend für das [raindrop-app](https://github.com/user/raindrop-app) Frontend, basierend auf **Supabase** (Postgres, Edge Functions, Auth, Storage).

## Stack


| Komponente | Technologie                                     |
| ---------- | ----------------------------------------------- |
| Datenbank  | PostgreSQL (Supabase)                           |
| API        | Supabase Edge Functions (Deno)                  |
| Auth       | Supabase Auth (Email/Password, Cookie-Sessions) |
| Storage    | Supabase Storage (Files, Covers)                |
| Frontend   | Vercel (`https://project-fijck.vercel.app`)     |


## Features


| ID      | Feature                     | Status   |
| ------- | --------------------------- | -------- |
| RDBE-1  | Auth (Email + Social Login) | Deployed |
| RDBE-2  | User-Profil & Config        | Deployed |
| RDBE-3  | Collections CRUD            | Deployed |
| RDBE-4  | Raindrops CRUD              | Deployed |
| RDBE-5  | Tags                        | Deployed |
| RDBE-6  | Suche & Filter              | Deployed |
| RDBE-7  | File Upload (Storage)       | Deployed |
| RDBE-8  | Import / Export             | Deployed |
| RDBE-9  | Highlights                  | Deployed |
| RDBE-10 | Sharing & Collaboration     | Deployed |
| RDBE-11 | Backups                     | Deployed |


## Projektstruktur

```
supabase/
  functions/
    _shared/           # Shared Utilities (CORS, Auth, Response)
    api/
      index.ts         # Haupt-Router
      routes/
        auth.ts        # Login, Logout, Session
        user.ts        # Profil, Config, Stats
        collections.ts # Collections CRUD, Sharing, Covers
        raindrops.ts   # Bookmarks CRUD, Batch-Ops, File Upload
        tags.ts        # Tags, Filter-Daten
        highlights.ts  # Highlights
        import-export.ts # Import/Export
        backups.ts     # Backups
  migrations/          # PostgreSQL Migrationen
```

## Setup

### Voraussetzungen

- [Supabase CLI](https://supabase.com/docs/guides/cli) (>= v2.78)
- Supabase-Projekt (Cloud oder Self-hosted)

### 1. Supabase Secrets setzen

```bash
supabase secrets set ALLOWED_ORIGINS="http://localhost:2000,https://project-fijck.vercel.app/"
supabase secrets set COOKIE_SAMESITE="None"
supabase secrets set SITE_URL="https://project-fijck.vercel.app/"
```

### 2. Migrationen anwenden

```bash
supabase db push
```

### 3. Edge Functions deployen

```bash
supabase functions deploy api --no-verify-jwt
```

### 4. Supabase Auth konfigurieren

- Email/Password Provider aktivieren im Supabase Dashboard
- Site URL setzen unter Authentication → URL Configuration
- User erstellen unter Authentication → Users

## API Endpoints

Alle Endpoints unter `/functions/v1/api/`:


| Methode | Pfad                       | Beschreibung         |
| ------- | -------------------------- | -------------------- |
| POST    | `auth/email-login`         | Email Login          |
| GET     | `auth/logout`              | Logout               |
| GET     | `user`                     | Aktueller User       |
| PUT     | `user`                     | Profil updaten       |
| GET     | `user/stats`               | User-Statistiken     |
| GET     | `collections/all`          | Alle Collections     |
| POST    | `collection`               | Collection erstellen |
| PUT     | `collection/{id}`          | Collection updaten   |
| DELETE  | `collection/{id}`          | Collection löschen   |
| GET     | `raindrops/{collectionId}` | Bookmarks listen     |
| POST    | `raindrop`                 | Einzelnes Bookmark   |
| POST    | `raindrops`                | Batch-Create         |
| PUT     | `raindrop/{id}`            | Bookmark updaten     |
| DELETE  | `raindrop/{id}`            | Bookmark löschen     |
| GET     | `tags/{collectionId}`      | Tags laden           |
| GET     | `highlights/{raindropId}`  | Highlights laden     |


## Environment Variables


| Variable          | Beschreibung                                       |
| ----------------- | -------------------------------------------------- |
| `ALLOWED_ORIGINS` | Komma-getrennte erlaubte Origins für CORS          |
| `COOKIE_SAMESITE` | Cookie SameSite-Attribut (`None` für Cross-Domain) |
| `SITE_URL`        | Frontend-URL für Redirects nach Login              |


## Bekannte Einschränkungen

- **Screenshot-Service** (`rdl.ink`): Externer Raindrop.io-Service, nicht self-hosted. Thumbnails werden nicht generiert.
- **Import-Redirect**: Import-Seite im Frontend verweist noch auf `app.raindrop.io`.
- **Social Login**: OAuth-Provider (Google, Apple) müssen separat konfiguriert werden.

