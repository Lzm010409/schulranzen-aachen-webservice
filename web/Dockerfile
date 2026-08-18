# syntax=docker/dockerfile:1
#
# Basis ist bewusst Debian (node:22-slim), nicht Alpine:
#   - package-lock.json wird auf glibc erzeugt; die musl-Varianten von SWC,
#     sharp und den Prisma-Engines stehen dort nicht drin.
#   - Der Health-Check von Coolify ruft `curl` im Container auf.
# Beides wird hier zuverlaessig abgedeckt.

# ---------------------------------------------------------------- Abhaengigkeiten
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------- Build
FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Die Werte braucht der Build nur formal — zur Laufzeit kommen die echten aus
# der Umgebung. Es wird zu keinem Zeitpunkt eine Datenbank kontaktiert.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV SESSION_SECRET="build-time-placeholder-secret-32-zeichen"
ENV ENCRYPTION_KEY="YnVpbGQtdGltZS1wbGFjZWhvbGRlci0zMi1ieXRl"

RUN npx prisma generate && npx next build

# ------------------------------------------------------- Laufzeit-Abhaengigkeiten
# Getrennter Schritt, damit im Abbild nur Produktionspakete landen — darunter
# prisma (fuer `migrate deploy`) und tsx (fuer Seed und Datenuebernahme).
FROM node:22-slim AS proddeps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------------------------------------------------------------- Laufzeit
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

#   curl/wget  – Coolify prueft damit den Health-Check im Container
#   tini       – beendet den Container sauber (der Worker haelt Verbindungen)
#   psql/pg_restore 16 – fuer die Dump-basierte Datenuebernahme; Debian liefert
#                        nur Version 15 mit, die neuere Dumps nicht lesen kann
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl wget tini gnupg \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-16 \
 && apt-get purge -y gnupg \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd -g 1001 nodejs \
 && useradd -u 1001 -g nodejs -m -s /bin/bash nextjs

# 1. Standalone-Ausgabe von Next.js (server.js samt verfolgter Abhaengigkeiten)
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# 2. Vollstaendige Produktionspakete darueberlegen. Die Standalone-Ausgabe
#    enthaelt nur, was der Server selbst braucht; prisma und tsx fehlen dort
#    samt ihren Abhaengigkeiten.
COPY --from=proddeps --chown=nextjs:nodejs /app/node_modules ./node_modules

# 3. Werkzeuge fuer Migration, Seed und Datenuebernahme
COPY --from=build --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=build --chown=nextjs:nodejs /app/src/lib ./src/lib
COPY --from=build --chown=nextjs:nodejs /app/src/generated ./src/generated

COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=10 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
