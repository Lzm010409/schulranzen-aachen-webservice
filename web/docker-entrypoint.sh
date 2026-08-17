#!/bin/sh
# Startvorbereitung im Container.
#
#  1. Datenbankschema auf den aktuellen Stand bringen
#  2. Ersten Administrator und die Standard-Provider anlegen, falls gewuenscht
#  3. Anwendung starten
#
# Die Migration laeuft vor dem Server, damit die Anwendung nie gegen ein
# veraltetes Schema arbeitet.
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[start] Wende Datenbankmigrationen an…"
  npx prisma migrate deploy
else
  echo "[start] WARNUNG: DATABASE_URL ist nicht gesetzt — Migration übersprungen."
fi

if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "[start] Stelle Administrator und Standard-Provider sicher…"
  npx tsx scripts/seed.ts || echo "[start] Seed übersprungen (bereits vorhanden oder fehlgeschlagen)."
fi

echo "[start] Starte Anwendung…"
exec "$@"
