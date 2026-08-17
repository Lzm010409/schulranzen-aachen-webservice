# Schulranzen-Aachen-Webservice v2

Kundenverwaltung und Mailversand — Nachfolger der Vaadin/Spring-Boot-Anwendung
im Wurzelverzeichnis dieses Repositorys.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Prisma 7 ·
PostgreSQL 16 · Tailwind 4 · Nodemailer

---

## Was sich gegenüber dem Altsystem geändert hat

| Bereich | Altsystem | Jetzt |
| --- | --- | --- |
| Zugriffsschutz | keiner — jeder mit der URL sah alle Kundendaten | Einzelkonten mit Rollen, Sitzungen in der Datenbank, Rate-Limit am Login |
| SMTP-Zugang | Passwort im Klartext in der Sitzung; `Session.getDefaultInstance()` war JVM-weit, alle Nutzer versendeten über den ersten Login | zentrales Konto, Passwort AES-256-GCM verschlüsselt, ein Transport je Versand |
| Verbindungstest | verschickte eine echte Mail an sich selbst | `SMTP VERIFY` ohne Versand |
| Massenversand | Schleife im UI-Thread, Abbruch beim ersten Fehler, kein Protokoll | Warteschlange in der Datenbank, Rate-Limit, Backoff, Status je Empfänger |
| Fortschritt | Balken wurde eingeblendet, aber nie hochgezählt | echter Fortschritt aus der Datenbank, übersteht einen Reload |
| Empfängerwahl | Einzelklick in eine zweite Tabelle | Mehrfachauswahl, „alle Treffer", gespeicherte Segmente |
| Abmeldung | nicht vorhanden | signierter Abmeldelink + `List-Unsubscribe`-Header, Pflichtbestandteil jeder Mail |
| Suche/Filter | Stichwort **oder** Zeitraum | alle Kriterien gleichzeitig, Filterstand steht in der URL |
| Kunde ↔ Produkt | genau ein Produkt je Kunde | `Customer` + `Purchase`: mehrere Käufe je Kunde |
| Produkte | Freitext legte bei jedem Speichern ein Duplikat an | eindeutiger Schlüssel, Zusammenführen im UI |
| Export | Temp-Datei, komplett in den Speicher, `,`-getrennt | Streaming, Excel-tauglich (`;` + BOM), CSV-Injection entschärft, XLSX |
| Löschen | endgültig | Soft-Delete mit Wiederherstellung |
| Nachvollziehbarkeit | keine | Änderungshistorie, Export- und Versandprotokoll |
| Konfiguration | `file:/Users/lukegollenstede/Downloads/db.properties` | Umgebungsvariablen, beim Start validiert |

---

## Lokale Entwicklung

```bash
cd web
npm install
cp .env.example .env          # Werte eintragen, siehe unten
npx prisma migrate deploy
ADMIN_EMAIL=du@example.de ADMIN_PASSWORD='mindestens-10-zeichen' npm run seed
npm run dev                   # http://localhost:3000
```

Schlüssel erzeugen:

```bash
openssl rand -base64 32       # für SESSION_SECRET
openssl rand -base64 32       # für ENCRYPTION_KEY (muss genau 32 Byte sein)
```

> `ENCRYPTION_KEY` niemals nachträglich ändern — hinterlegte SMTP-Passwörter
> sind sonst nicht mehr lesbar und müssen neu eingegeben werden.

## Tests

```bash
npm test                      # 57 Tests: Normalisierung, Mailaufbau,
                              # Export, SMTP-Fehler, ETL, Versandstrecke
npm run typecheck
node scripts/smoke.mjs http://localhost:3000   # End-to-End im Browser
```

Die Versandstrecke wird gegen einen echten SMTP-Server getestet (eine
Attrappe mit TLS, die eine Adresse gezielt ablehnt) — damit ist geprüft, dass
ein fehlerhafter Empfänger den Rest nicht stoppt.

## Aufbau

```
src/
  app/
    (app)/            angemeldeter Bereich
      kunden/         Liste, Filter, Formular, Detailseite
      produkte/       Katalog inkl. Zusammenführen
      vorlagen/       Editor mit Vorschau und Versionen
      kampagnen/      Entwurf → Test → Freigabe → Fortschritt
      einstellungen/  Konto, Mailkonten, Benutzer, Protokoll
    login/            Anmeldung
    abmelden/[token]/ öffentliche Abmeldeseite
    api/              Export, Health, Fortschritt
  lib/
    auth.ts           Sitzungen, Rollen, Rate-Limit
    crypto.ts         Passwort-Hash (scrypt), AES-256-GCM
    queue.ts          Empfänger einreihen, Fortschritt, Wiederholung
    worker.ts         Versand-Worker (FOR UPDATE SKIP LOCKED)
    mailer.ts         Transport, Fehlerdeutung, Abmelde-Token
    template.ts       Platzhalter, Sanitisierung, Mailaufbau
    customer-filter.ts Filter → Prisma-Bedingung
    export.ts         CSV-Streaming und XLSX
scripts/
  seed.ts             erster Administrator + Standard-Provider
  smoke.mjs           End-to-End-Test im Browser
  etl/                Datenübernahme aus dem Altsystem
```

Der Versand-Worker läuft im selben Prozess wie die Anwendung (gestartet über
`src/instrumentation.ts`). Das spart Redis und einen zweiten Container; die
Warteschlange liegt in der Tabelle `mail_job`, ein Neustart verliert nichts.

## Betrieb

- **Health-Check:** `GET /api/health` — prüft auch die Datenbankverbindung.
- **Migrationen** laufen automatisch beim Containerstart (`docker-entrypoint.sh`).
- **Versandtempo** über `MAIL_RATE_PER_MINUTE` steuern (Standard 20/min).
  Provider drosseln typisch ab 100–500 Mails pro Stunde.
- **Mehrere Instanzen** sind möglich: die Jobs werden per
  `FOR UPDATE SKIP LOCKED` geholt, jeder Job geht an genau einen Worker.

## Datenübernahme aus dem Altsystem

Siehe [MIGRATION.md](./MIGRATION.md).
