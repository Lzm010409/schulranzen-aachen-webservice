#!/bin/sh
# Startvorbereitung im Container:
#   1. auf die Datenbank warten
#   2. Schema migrieren
#   3. ersten Administrator und Standard-Provider anlegen (falls gewuenscht)
#   4. Anwendung starten
#
# Die Migration laeuft vor dem Server, damit die Anwendung nie gegen ein
# veraltetes Schema arbeitet.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "[start] FEHLER: DATABASE_URL ist nicht gesetzt."
  exit 1
fi

echo "[start] Warte auf die Datenbank…"
i=1
# package.json steht auf "type": "module" — deshalb import statt require.
until node -e "
import('pg').then(({ default: pg }) => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  return client.connect().then(() => client.end());
}).then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; do
  if [ "$i" -ge 30 ]; then
    echo "[start] FEHLER: Datenbank nach 60 Sekunden nicht erreichbar."
    exit 1
  fi
  i=$((i + 1))
  sleep 2
done
echo "[start] Datenbank erreichbar."

echo "[start] Wende Migrationen an…"
npx prisma migrate deploy

if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "[start] Stelle Administrator und Standard-Provider sicher…"
  # Ein fehlgeschlagener Seed darf den Start nicht verhindern — etwa wenn der
  # Administrator laengst existiert.
  npx tsx scripts/seed.ts || echo "[start] Seed uebersprungen."
fi

echo "[start] Starte Anwendung auf Port ${PORT:-3000}…"
exec "$@"
