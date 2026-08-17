# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- Abhaengigkeiten
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------- Build
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Der Build braucht die Werte nur formal — zur Laufzeit kommen die echten aus
# der Umgebung. Es wird zu keinem Zeitpunkt eine Datenbank kontaktiert.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV SESSION_SECRET="build-time-placeholder-secret-32-zeichen"
ENV ENCRYPTION_KEY="YnVpbGQtdGltZS1wbGFjZWhvbGRlci0zMi1ieXRl"

RUN npx prisma generate && npx next build

# ------------------------------------------------------- Laufzeit-Abhaengigkeiten
# Getrennter Schritt, damit im Abbild nur die Produktionspakete landen —
# darunter prisma (fuer `migrate deploy`) und tsx (fuer Seed und Datenuebernahme).
FROM node:22-alpine AS proddeps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------------------------------------------------------------- Laufzeit
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# postgresql-client wird fuer die Dump-basierte Datenuebernahme gebraucht,
# tini beendet den Container sauber (der Versand-Worker haelt Verbindungen offen).
RUN apk add --no-cache postgresql16-client tini \
 && addgroup -g 1001 -S nodejs \
 && adduser -u 1001 -S nextjs -G nodejs

# 1. Standalone-Ausgabe von Next.js (bringt server.js und die verfolgten
#    Abhaengigkeiten mit).
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# 2. Vollstaendige Produktionspakete darueberlegen. Die Standalone-Ausgabe
#    enthaelt nur, was der Server selbst braucht; prisma und tsx fehlen dort
#    samt ihrer Abhaengigkeiten.
COPY --from=proddeps --chown=nextjs:nodejs /app/node_modules ./node_modules

# 3. Werkzeuge fuer Migration, Seed und Datenuebernahme.
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

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
