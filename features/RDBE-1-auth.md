# RDBE-1: Auth (Email + Social Login)

## Status: In Progress
**Created:** 2026-03-13  
**Last Updated:** 2026-03-13  
**Backend Files:**
- `supabase/migrations/20260313000001_auth_profiles.sql`
- `supabase/functions/api/index.ts`
- `supabase/functions/api/routes/auth.ts`
- `supabase/functions/api/routes/user.ts`
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/_shared/response.ts`
- `supabase/functions/_shared/supabase.ts`

## Dependencies
- None

## User Stories
- As a family user, I want to login with email/password so that I can access my bookmarks securely.
- As a user, I want to login with Google/Apple so that onboarding is faster.
- As an admin, I want registration to stay closed so that only invited users can join.
- As a user, I want session-based auth to work with the existing frontend so that I stay logged in.

## Acceptance Criteria
- [ ] Email/password login works and returns compatible auth response format.
- [ ] OAuth login (Google, Apple) works and maps to existing user accounts.
- [ ] Closed registration is enforceable (invite-only or admin-created users).
- [ ] Logout invalidates session and protected endpoints return unauthorized afterwards.
- [ ] Frontend requests with `credentials: include` are authenticated correctly.

## Edge Cases
- Login with wrong password.
- OAuth account exists but is not linked yet.
- Session expired while client still has old state.
- User tries to register without invitation.
- CORS/cookie misconfiguration blocks login in browser context.

## Technical Requirements (optional)
- Security: HttpOnly/Secure cookie handling, CSRF strategy for state-changing routes.
- Security: Rate limiting for login endpoints.
- Compatibility: Preserve response keys used by frontend sagas (`result`, `auth`, optional `tfa`).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Architektur-Entscheid

Supabase Auth wird als zentrale Auth-Schicht verwendet. Es liefert Email/Password, OAuth-Provider und Session-Management out-of-the-box. Eine duenne Edge-Function-Schicht (API-Fassade) uebersetzt zwischen dem Supabase-Session-Format und dem Response-Format, das das Frontend erwartet.

**Warum Supabase Auth?**
- Email/Password + OAuth (Google, Apple) sind eingebaut, kein eigenes Auth-System noetig.
- Session-Handling mit Cookies ist konfigurierbar.
- RLS (Row Level Security) kann direkt an den Auth-User gebunden werden.

### Endpunkt-Zuordnung (Frontend -> Backend)

```
Frontend-Call                         -> Edge Function Route
-----------------------------------------------------------
POST auth/email/login                 -> v1/auth/email/login
POST auth/email/signup                -> v1/auth/email/signup
POST auth/email/lost                  -> v1/auth/email/lost
POST auth/email/recover               -> v1/auth/email/recover
GET  auth/logout                      -> v1/auth/logout
GET  auth/{provider}/native{token}    -> v1/auth/{provider}/native
POST auth/jwt                         -> v1/auth/jwt
```

### Datenmodell (Klartext)

```
Jeder Benutzer hat:
- Supabase Auth User ID (UUID, automatisch vergeben)
- Interne numerische User ID (Integer, fuer Kompatibilitaet mit Frontend "$id"-Feldern)
- Email
- Name
- Avatar URL (optional)
- Config Objekt (JSON, App-Einstellungen)
- Pro-Status Flag
- Erstellungsdatum

Gespeichert in: Supabase Auth (Kern-Auth-Daten) + eigene "profiles" Tabelle (erweiterte Felder)
```

### Session-Handling

```
Login-Flow:
1. Frontend sendet POST an v1/auth/email/login mit {email, password}
2. Edge Function ruft Supabase Auth signInWithPassword auf
3. Supabase setzt HttpOnly Session Cookie
4. Edge Function antwortet mit {result: true} (oder {tfa: token} falls TFA aktiv)
5. Folge-Requests senden Cookie automatisch mit (credentials: include)
```

### Geschlossene Registrierung

```
Registrierungskontrolle:
- Supabase Auth "Disable signup" Flag aktivieren
- Nutzer werden nur durch Admin ueber Supabase Dashboard oder Admin-Edge-Function angelegt
- Optional: Invite-Token-Tabelle fuer kontrollierte Selbstregistrierung
```

### Komponenten-Uebersicht

```
Auth System
+-- Edge Functions (API-Fassade)
|   +-- v1/auth/email/login (Email-Login, setzt Session)
|   +-- v1/auth/email/signup (nur mit Invite-Token oder deaktiviert)
|   +-- v1/auth/email/lost (Password-Reset-Mail ausloesen)
|   +-- v1/auth/email/recover (Neues Passwort setzen)
|   +-- v1/auth/logout (Session invalidieren)
|   +-- v1/auth/{provider}/native (OAuth Callback Handler)
|   +-- v1/auth/jwt (JWT-basierter Login fuer Extensions)
+-- Supabase Auth (Kern-Engine)
|   +-- Email/Password Provider
|   +-- Google OAuth Provider
|   +-- Apple OAuth Provider
+-- Postgres
|   +-- profiles Tabelle (erweiterte Nutzerdaten, verknuepft mit auth.users)
|   +-- user_id_map Tabelle (UUID -> Integer ID Mapping)
+-- CORS + Cookie Config
    +-- Erlaubte Origins (Frontend-Domain)
    +-- SameSite/Secure/HttpOnly Cookie-Attribute
```

### Tech-Entscheidungen

| Entscheidung | Wahl | Begruendung |
|---|---|---|
| Auth-Engine | Supabase Auth | Eingebaut, OAuth + Email out-of-box, kein Eigenbau noetig |
| Session-Typ | HttpOnly Cookie | Frontend erwartet `credentials: include`, kein Token-Handling im Client |
| User-ID-Format | UUID intern + Integer-Mapping extern | Frontend nutzt numerische `$id` Felder, Supabase nutzt UUIDs |
| Registrierung | Standardmaessig geschlossen | Familiengruppe, kein offener Zugang |
| TFA | Spaeter ergaenzbar via Supabase Auth TOTP | MVP ohne, Architektur erlaubt Nachruestung |

### Dependencies

- Supabase Auth (eingebaut)
- Supabase Edge Functions (Deno runtime)
- CORS Middleware (in Edge Functions konfiguriert)

## QA Test Results

**Tested:** 2026-03-13  
**Methode:** Code Review (kein laufender Server)  
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Email/Password Login
- [x] POST auth/email/login vorhanden
- [x] signInWithPassword korrekt aufgerufen
- [x] HttpOnly Cookies gesetzt (access + refresh)
- [x] Response: `{result: true}` kompatibel

#### AC-2: OAuth Login (Google, Apple)
- [x] Route auth/{provider}/native implementiert
- [x] signInWithIdToken korrekt aufgerufen
- [x] Cookies nach OAuth-Login gesetzt

#### AC-3: Geschlossene Registrierung
- [x] config.toml: `enable_signup = false`
- [ ] **BUG-1:** Signup-Endpoint hat keinen Admin-Auth-Check

#### AC-4: Logout
- [x] Session wird invalidiert
- [x] Cookies werden geloescht
- [ ] **BUG-2:** Cookie-Domain fehlt beim Loeschen

#### AC-5: credentials: include
- [x] CORS: `Access-Control-Allow-Credentials: true`
- [x] Cookie-Attribute SameSite=Lax + Secure konfigurierbar

### Edge Cases Status

#### EC-1: Login mit falschem Passwort
- [x] Supabase Error -> 401 unauthorized

#### EC-2: OAuth Account nicht verknuepft
- [x] signInWithIdToken handhabt Auto-Link

#### EC-3: Session expired
- [x] getUser() -> null -> unauthorizedResponse

#### EC-4: Registrierung ohne Einladung
- [ ] **BUG-1:** Endpoint ungeschuetzt (s.o.)

#### EC-5: CORS/Cookie Misconfiguration
- [x] ALLOWED_ORIGINS konfigurierbar
- [x] Secure-Flag per ENV steuerbar

### Security Audit

- [x] Auth-Bypass: Alle geschuetzten Endpoints pruefen getUser()
- [ ] **BUG-1:** Signup-Endpoint kann ohne Admin-Auth aufgerufen werden (Critical)
- [x] XSS: Keine direkte HTML-Ausgabe, nur JSON
- [ ] **BUG-3:** Kein Rate-Limiting auf Login-Endpoints (Medium)
- [x] Secrets: Keine Secrets in Responses

### Bugs Found

#### BUG-1: Signup-Endpoint ohne Admin-Authentifizierung
- **Severity:** Critical
- **Datei:** `auth.ts` -> `emailSignup()`
- **Problem:** Jeder kann POST an `/auth/email/signup` senden. Die Funktion nutzt `createServiceClient()` (Service-Role), prueft aber nicht ob der Caller ein Admin ist.
- **Fix:** Admin-Token oder separate Auth-Pruefung vor `admin.createUser()` einbauen.
- **Priority:** Fix before deployment

#### BUG-2: Logout loescht Cookies ohne Domain-Attribut
- **Severity:** Medium
- **Datei:** `auth.ts` -> `logout()`
- **Problem:** Login setzt Cookies mit `Domain=${COOKIE_DOMAIN}`, Logout loescht ohne Domain. Browser loescht nur Cookies mit exakt passendem Domain-Attribut.
- **Fix:** Gleiche Domain-Logik wie bei Login verwenden.
- **Priority:** Fix before deployment

#### BUG-3: Kein Rate-Limiting
- **Severity:** Medium
- **Problem:** Login-Endpoint hat kein Rate-Limiting. Brute-Force moeglich.
- **Fix:** Supabase hat internes Rate-Limiting fuer Auth. Fuer Extra-Schutz: Counter in Edge Function oder Middleware.
- **Priority:** Fix in next sprint (Supabase bietet Basis-Schutz)

### Summary
- **Acceptance Criteria:** 4/5 bestanden (Signup-Auth fehlt)
- **Bugs Found:** 3 total (1 Critical, 2 Medium)
- **Security:** 1 kritische Luecke (Signup ungeschuetzt)
- **Production Ready:** NEIN
- **Recommendation:** BUG-1 und BUG-2 fixen, dann erneut pruefen

## Deployment
_To be added by /deploy_
