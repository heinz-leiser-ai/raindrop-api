# RDBE-12: Token-basierte Authentifizierung

## Status: In Review
**Created:** 2026-03-18
**Last Updated:** 2026-03-18
**Backend:** `auth.ts` — Token im JSON-Body, `POST auth/refresh`, Logout mit Bearer; `config.toml` Kommentar zu JWT/Refresh

## Dependencies
- RDBE-1 (Auth) muss deployed sein

## Kontext

Die aktuelle Cookie-basierte Auth (RDBE-1) hat folgende Probleme:
- Session-Verlust bei Cookie-Ablauf oder Browser-Bereinigung
- Chrome Extension kann keine Third-Party-Cookies nutzen (Chrome blockiert zunehmend)
- Safari Extension braucht speziellen Workaround (eigene Web-Origin fuer Popup)
- Frontend macht kompletten State-Reset wenn `GET user` fehlschlaegt

**Loesung:** Login-Endpoints geben zusaetzlich Tokens im Response-Body zurueck. Clients speichern Tokens lokal und senden sie als `Authorization: Bearer` Header. Cookie-Auth bleibt parallel fuer Abwaertskompatibilitaet.

**Voraussetzung im Code:** `createUserClient()` in `_shared/supabase.ts` akzeptiert bereits `Authorization: Bearer` Header (Zeile 21). Die Auth-Middleware muss nicht geaendert werden.

## User Stories

- Als User moechte ich nach dem Login dauerhaft eingeloggt bleiben, damit ich mich nicht bei jedem Browser-Neustart neu anmelden muss.
- Als Extension-Nutzer moechte ich mich einmal einloggen und die Session behalten, damit die Extension sofort funktioniert ohne erneuten Login.
- Als User moechte ich mich explizit ausloggen koennen, damit mein Token danach ungueltig ist.
- Als Betreiber moechte ich Cookie-Auth parallel beibehalten, damit bestehende Clients waehrend der Migration weiter funktionieren.
- Als User moechte ich bei abgelaufenem Access-Token automatisch eine neue Session erhalten, ohne mich neu einloggen zu muessen.

## Acceptance Criteria

- [x] `POST auth/email/login` gibt bei Erfolg zusaetzlich `token` (access_token) und `refresh_token` im JSON-Body zurueck.
- [x] `POST auth/jwt` gibt bei Erfolg `token` und `refresh_token` im JSON-Body zurueck.
- [x] `GET auth/{provider}/native` gibt bei Erfolg `token` und `refresh_token` im JSON-Body zurueck.
- [x] Alle bestehenden Endpoints funktionieren weiterhin mit Cookie-Auth (Abwaertskompatibilitaet).
- [x] `GET auth/logout` akzeptiert auch `Authorization: Bearer` Header (nicht nur Cookie) und invalidiert die Session.
- [x] Neuer Endpoint `POST auth/refresh` nimmt `refresh_token` entgegen und gibt neuen `token` + `refresh_token` zurueck.
- [x] Geschuetzte Endpoints (`GET user`, Collections, Bookmarks etc.) funktionieren mit Bearer-Token genauso wie mit Cookie (unveraendert in `supabase.ts`).

## Edge Cases

- Token und Cookie werden gleichzeitig gesendet: Bearer-Token hat Vorrang (ist bereits so in `createUserClient`).
- Access-Token ist abgelaufen, Refresh-Token ist noch gueltig: Client nutzt `POST auth/refresh` fuer neuen Token.
- Access-Token UND Refresh-Token sind abgelaufen: `POST auth/refresh` gibt 401 zurueck, Client muss sich neu einloggen.
- Logout mit Bearer-Token: Session wird serverseitig invalidiert, alle Tokens dieses Users werden ungueltig.
- Form-basierter Login (nicht-JSON): Gibt weiterhin nur Redirect + Cookie zurueck, kein Token im Body (Redirect kann keinen Body haben).
- Parallele Sessions: Mehrere gueltige Refresh-Tokens pro User erlaubt (WebApp + Extension + weitere Geraete).

## Technical Requirements

- Kein neues Datenmodell noetig: Supabase Auth verwaltet access_token und refresh_token intern.
- `POST auth/refresh` nutzt `supabase.auth.refreshSession()` mit dem uebergebenen Refresh-Token.
- Token-Lebensdauer: Access-Token Standardmaessig 1h (Supabase Default), Refresh-Token ueber Supabase Auth konfigurierbar (empfohlen: unbegrenzt oder 1 Jahr).
- Supabase Auth Konfiguration: `REFRESH_TOKEN_ROTATION_ENABLED=true` fuer Sicherheit bei Token-Erneuerung.
- Performance: Kein zusaetzlicher DB-Lookup noetig, da Supabase Auth die Token-Validierung uebernimmt.

## Betroffene Dateien

- `supabase/functions/api/routes/auth.ts` — Login-Responses um Token-Felder erweitern, neuer `auth/refresh` Endpoint, Logout fuer Bearer erweitern
- `supabase/functions/api/index.ts` — Route fuer `auth/refresh` registrieren (falls noetig)
- Keine Aenderung an `_shared/supabase.ts` (Bearer-Support existiert bereits)

## Abgrenzung

- Frontend-Aenderungen (Token speichern, Authorization Header senden) sind NICHT Teil dieses Features → siehe RAIN-1 (raindrop-app)
- Extension-spezifischer Login-Flow ist NICHT Teil dieses Features → siehe RAIN-2 (raindrop-app)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Architektur-Entscheid

Supabase Auth liefert bei jedem Login bereits ein access_token und refresh_token. Aktuell werden diese nur als HttpOnly-Cookies gesetzt. Die Aenderung: Tokens werden **zusaetzlich** im JSON-Response-Body zurueckgegeben. Cookie-Auth bleibt parallel bestehen.

**Warum kein eigenes Token-System?**

- Supabase Auth verwaltet Token-Lebensdauer, Rotation und Invalidierung bereits
- Kein eigenes Datenmodell (Token-Tabelle) noetig
- `createUserClient()` in `_shared/supabase.ts` akzeptiert Bearer-Tokens bereits — alle geschuetzten Endpoints funktionieren automatisch

### Komponenten-Uebersicht

```
Token-Auth System (Erweiterung von RDBE-1)
+-- Auth Routes (auth.ts)
|   +-- emailLogin — NEU: token + refresh_token im JSON-Body
|   +-- jwtLogin — NEU: token + refresh_token im JSON-Body
|   +-- oauthNative — NEU: token + refresh_token im JSON-Body
|   +-- refreshToken — NEUER Endpoint: erneuert abgelaufenen access_token
|   +-- logout — ERWEITERT: akzeptiert Bearer-Token zusaetzlich zu Cookie
+-- Shared Auth Middleware (supabase.ts)
|   +-- createUserClient — KEINE AENDERUNG (Bearer-Support existiert)
|   +-- getUser — KEINE AENDERUNG
+-- Supabase Auth Engine
    +-- signInWithPassword — liefert session mit tokens
    +-- refreshSession — erneuert tokens
    +-- signOut — invalidiert session
```

### Datenfluss

**Login (Email)**

```
Aktuell:
Client -> POST auth/email/login -> Supabase Auth -> Session Cookie -> {result: true}

Neu (JSON-Request):
Client -> POST auth/email/login -> Supabase Auth -> Session Cookie + {result: true, token: "...", refresh_token: "..."}

Neu (Form-POST, Redirect):
Client -> POST auth/email/login -> Supabase Auth -> Session Cookie + 302 Redirect (kein Token im Body, da Redirect)
```

**Token-Erneuerung**

```
Client -> POST auth/refresh {refresh_token: "..."} -> Supabase Auth refreshSession() -> {result: true, token: "...", refresh_token: "..."}
```

**Logout**

```
Aktuell:
Client -> GET auth/logout (Cookie) -> signOut -> Cookies loeschen

Neu:
Client -> GET auth/logout (Bearer ODER Cookie) -> signOut -> Cookies loeschen + {result: true}
```

### Betroffene Stellen im Detail

- **`auth.ts` emailLogin()** — Nach erfolgreichem Login: `token` und `refresh_token` aus `data.session` zum JSON-Body hinzufuegen. Nur bei JSON-Requests (nicht bei Form-Redirect).
- **`auth.ts` jwtLogin()** — Gleiche Erweiterung: Tokens im Response-Body.
- **`auth.ts` oauthNative()** — Gleiche Erweiterung: Tokens im Response-Body.
- **`auth.ts` logout()** — Zusaetzlich Bearer-Token aus Authorization-Header lesen (nicht nur aus Cookie). `createUserClient(req)` nutzt den Header bereits; Logout sollte dieselbe Quelle verwenden wie die geschuetzten Routen.
- **`auth.ts` refreshToken() (NEU)** — Neuer Endpoint. Nimmt `refresh_token` aus dem Body, ruft `supabase.auth.refreshSession()` auf, gibt neue Tokens zurueck.
- **`index.ts`** — Keine Aenderung noetig, da `auth/refresh` bereits unter `auth/` geroutet wird.

### Tech-Entscheidungen

- **Supabase Auth Tokens statt eigenes System:** Kein Eigenbau, kein neues Datenmodell, Token-Verwaltung ist eingebaut
- **Cookies bleiben parallel:** Abwaertskompatibilitaet, bestehende Clients funktionieren weiter
- **Refresh-Token im Body statt Cookie:** Client muss Token selbst speichern (localStorage/localforage), dafuer funktioniert es cross-origin (Extension)
- **Access-Token-Lebensdauer:** Standard Supabase (z. B. 1h); Refresh-Token-Lebensdauer in Supabase Config maximieren. Client erneuert access_token ueber den Refresh-Endpoint
- **Token-Rotation:** `REFRESH_TOKEN_ROTATION_ENABLED=true` — bei jedem Refresh wird ein neuer Refresh-Token ausgegeben, alter wird ungueltig

### Dependencies

- Keine neuen Packages noetig
- Supabase Auth Config: Refresh-Token-Lebensdauer erhoehen (Supabase Dashboard oder config.toml)
- Optional: `REFRESH_TOKEN_ROTATION_ENABLED=true` in Supabase Config

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
