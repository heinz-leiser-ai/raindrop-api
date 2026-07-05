#!/usr/bin/env bash
# Nur Edge Function `api` deployen (kein db push — Migrationen separat / bereits auf Remote).
# Wechselt fest ins raindrop-api-Repo; Supabase-CLI muss eingeloggt / Projekt verlinkt sein.
# Nutzung: ./build-backend.sh (von überall)
set -euo pipefail

REPO="/Users/heinzleiser/repos/raindrop-api"
cd "$REPO" || {
	echo "Fehler: Verzeichnis nicht gefunden: $REPO" >&2
	exit 1
}

if [[ ! -f supabase/config.toml ]]; then
	echo "Fehler: Kein supabase/config.toml unter $REPO — falsches Verzeichnis?" >&2
	exit 1
fi

supabase functions deploy api --no-verify-jwt

echo "OK: API deployed (functions deploy api)."
