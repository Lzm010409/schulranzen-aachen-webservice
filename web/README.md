# Schulranzen-Aachen-Webservice v2

Kundenverwaltung und Mailversand — Nachfolger der Vaadin/Spring-Boot-Anwendung
im Wurzelverzeichnis dieses Repositorys.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Prisma 7 ·
PostgreSQL 16 · Tailwind 4 · Nodemailer

---

## Was sich gegenüber dem Altsystem geändert hat

| Bereich | Altsystem | Jetzt |
| --- | --- | --- |
| Zugriffsschutz | keiner — jeder mit der URL sah alle Kundendaten | Einzelkonten mit fein einstellbaren Rechten, Sitzungen in der Datenbank, Rate-Limit am Login |
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

## Oberfläche

Die Optik entspricht der alten Vaadin-Anwendung (Lumo-Theme): Schublade links
mit dem Anwendungsnamen und den Navigationseinträgen, oben eine Leiste mit dem
Titel der aktuellen Ansicht, darunter der Inhalt. Farben, Abstände, Schrift-
größen sowie das Aussehen von Feldern, Knöpfen und Tabellen sind aus den
Lumo-Variablen von Vaadin 23 übernommen (`src/app/globals.css`).

## Rechte

Jeder Benutzer bekommt ein eigenes Konto. **Administratoren** haben immer alle
Rechte. Für **Mitarbeiter** wird jedes Recht einzeln vergeben:

| Bereich | Rechte |
| --- | --- |
| Kunden | Ansehen · Anlegen und bearbeiten · Löschen und wiederherstellen · Exportieren |
| Produkte | Ansehen · Anlegen, bearbeiten, zusammenführen |
| Vorlagen | Ansehen · Anlegen und bearbeiten |
| Mailversand | Ansehen · Entwürfe anlegen und testen · **Versand freigeben** |
| Verwaltung | Mailkonten und Provider · Protokoll einsehen · Benutzer verwalten |

Vier Vorlagen füllen die Auswahl vor: *Vollzugriff*, *Sachbearbeitung*
(bereitet Mails vor, gibt sie aber nicht frei), *Versand* und *Nur Lesen*.

Abhängige Rechte werden automatisch ergänzt — wer bearbeiten darf, darf auch
ansehen. So entsteht kein Konto, das eine Seite öffnen kann, auf der es nichts
sieht.

Durchgesetzt wird zweifach: die Oberfläche blendet aus, was nicht erlaubt ist,
und **jede Server Action und jede Seite prüft zusätzlich serverseitig**. Auf die
Oberfläche allein verlässt sich nichts — der Katalog steht in
`src/lib/permissions.ts`.

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
npm test                      # 74 Tests: Normalisierung, Mailaufbau, Export,
                              # SMTP-Fehler, Rechte, ETL, Versandstrecke
npm run typecheck

# End-to-End im Browser gegen eine laufende Instanz
node scripts/smoke.mjs http://localhost:3000              # 25 Prüfungen
node scripts/permissions-check.mjs http://localhost:3000  # 16 Prüfungen
```

`permissions-check.mjs` legt ein Konto mit der Vorlage *Nur Lesen* an, meldet
sich damit an und prüft, dass gesperrte Seiten umleiten, verbotene Knöpfe
fehlen und der Export-Endpunkt mit 403 antwortet.

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
    auth.ts           Sitzungen, Rechteprüfung, Rate-Limit
    permissions.ts    Rechtekatalog, Vorlagen, abhängige Rechte
    crypto.ts         Passwort-Hash (scrypt), AES-256-GCM
    queue.ts          Empfänger einreihen, Fortschritt, Wiederholung
    worker.ts         Versand-Worker (FOR UPDATE SKIP LOCKED)
    mailer.ts         Transport, Fehlerdeutung, Abmelde-Token
    template.ts       Platzhalter, Sanitisierung, Mailaufbau
    customer-filter.ts Filter → Prisma-Bedingung
    export.ts         CSV-Streaming und XLSX
scripts/
  seed.ts                 erster Administrator + Standard-Provider
  smoke.mjs               End-to-End-Test im Browser
  permissions-check.mjs   prüft die Rechte am laufenden System
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
