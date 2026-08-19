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
| Empfängerwahl | Einzelklick in eine zweite Tabelle | Mehrfachauswahl über mehrere Seiten hinweg, „alle Treffer", gespeicherte Segmente |
| Abmeldung | nicht vorhanden | signierter Abmeldelink + `List-Unsubscribe`-Header, Pflichtbestandteil jeder Mail |
| Suche/Filter | Stichwort **oder** Zeitraum | alle Kriterien gleichzeitig, Filterstand steht in der URL |
| Kunde ↔ Produkt | genau ein Produkt je Kunde | `Customer` + `Purchase`: mehrere Käufe je Kunde |
| Warengruppe | nicht vorhanden | gepflegte Liste statt Freitext, Filter in Katalog und Kundenliste |
| Saison | nicht vorhanden | Einschulungsjahrgang **am Kauf**, aus dem Kaufdatum abgeleitet |
| Produkte | Freitext legte bei jedem Speichern ein Duplikat an | eindeutiger Schlüssel, Zusammenführen im UI |
| Export | Temp-Datei, komplett in den Speicher, `,`-getrennt | Streaming, Excel-tauglich (`;` + BOM), CSV-Injection entschärft, XLSX |
| Listen | alles auf einer Seite | jede Tabelle blättert seitenweise, Seitenzahl steht in der URL |
| Löschen | endgültig | Soft-Delete mit Wiederherstellung |
| Nachvollziehbarkeit | keine | Änderungshistorie, Export- und Versandprotokoll |
| Konfiguration | `file:/Users/lukegollenstede/Downloads/db.properties` | Umgebungsvariablen, beim Start validiert |

---

## Warengruppen und Saison

Zwei Angaben, die vorher als Freitext am Produkt hingen und nichts bewirkten:

**Warengruppe** (früher „Kategorie") ist jetzt eine gepflegte Liste
(`ProductCategory`) statt Freitext. Sonst stehen „Ranzen", „Schulranzen" und
„schulranzen" nebeneinander — genau der Fehler, an dem im Altsystem schon die
Produktnamen gescheitert sind. Gepflegt wird sie direkt am Katalog, nicht in
einer eigenen Maske; es sind eine Handvoll Einträge.

**Saison** hängt jetzt am **Kauf**, nicht am Produkt — der
Einschulungsjahrgang des Kindes. Ein „Ergobag Cubo" wird über viele Jahre
verkauft; ein einziges Saisonfeld am Produkt kann deshalb nur falsch sein. Der
Jahrgang entsteht automatisch aus dem Kaufdatum:

```
Kauf im Januar–August       →  Einschulung im selben Jahr
Kauf im September–Dezember  →  Einschulung im Folgejahr
```

Das ist eine Konvention (`src/lib/season.ts`), keine Naturkonstante — im
Kundenformular lässt sich der Jahrgang je Kauf überschreiben, etwa wenn ein
Kind ein Jahr später eingeschult wird. Das Produkt behält stattdessen ein
sauberes **Modelljahr** für die Kollektion.

Damit ist die Frage filterbar, um die es beim Rundbrief eigentlich geht:
*wer hat vor vier Jahren einen Schulranzen gekauft?* — Kundenliste, Filter
„Warengruppe" und „Saison". Beides steht auch im Export.

Beide Importwege füllen die Felder: die CSV-/Excel-Datei über optionale
Spalten *Warengruppe*, *Modelljahr* und *Saison*, die Übernahme aus dem
Altsystem über das Kaufdatum — dort gab es die Angaben nicht, die Saison
entsteht trotzdem rückwirkend für den gesamten Bestand.

## Mitgelieferte Vorlagen

Unter [`vorlagen/`](./vorlagen/) liegen fertige Mail-Layouts zum Einfügen unter
**Vorlagen → Vorlage anlegen**. Sie sind auf E-Mail-Verhältnisse gebaut:
Tabellenlayout, Inline-Styles, keine Abhängigkeit von `<style>` oder
Hintergrundbildern, und sie überstehen die Sanitisierung unverändert — das ist
in `src/lib/__tests__/vorlage-coocazoo.test.ts` festgehalten.

| Vorlage | Wofür |
| --- | --- |
| `standard-neutral.html` | Sachliche Nachricht ohne jede Werbung: Terminbestätigung, Rückfrage, Abholung, Öffnungszeiten |
| `standard-klassik.html` | Allzweck: roter Kopf, Fließtext, Öffnungszeiten, dunkle Fußzeile |
| `standard-aktion.html` | Ranzenwochen, Sonderangebote, Events: großer Aufmacher, Bildfläche, die vier Argumente der Website |
| `standard-brief.html` | Persönliche Nachrichten: Terminbestätigung, Erinnerung, Service — viel Weißraum, feine rote Linie |
| `standard-bild.html` | Ein Motiv oben, Text darunter: Plakat, Herstellergrafik, Foto aus dem Laden — Bild verlinkt, mit Breite und Alternativtext |
| `coocazoo-colour-up.html` | Aktionsmail zum Colour-Up-Event: grünes Kopfband, Titelblock, Bildfläche, roter Terminknopf, Ablauf in drei Schritten |

Das Logo sitzt in allen Vorlagen im Kopf (die öffentliche Adresse des
Bildes von der Website); lädt es nicht, trägt die Wortmarke daneben.

Vorlagen dürfen bis zu **5.000.000 Zeichen** lang sein — genug für
eingebettete Bilder als `data:`-URI, die durch Base64 rund ein Drittel
Aufschlag bekommen. Der Editor zeigt den Stand mit. Beim Speichern wandern
solche Bilder in die [Bildablage](#bildablage) und stehen danach nur noch als
Adresse in der Vorlage — Gmail zeigt eingebettete Bilder nicht an.

Farben, Schriften und feste Angaben stammen aus der Website und stehen in
[`vorlagen/_styleguide.md`](./vorlagen/_styleguide.md) — Markenrot `#D7232A`,
Roboto, Trierer Straße 785. Alle Fußzeilen führen Impressum und
Datenschutzerklärung, wie es geschäftliche Post in Deutschland verlangt.

Bilder kommen über „Bild einfügen" in die [Bildablage](#bildablage) und sind
dann unter der eigenen Domain erreichbar. Fehlt ein Bild, bleibt die Fläche
farbig stehen und der Alternativtext erscheint — die Mail sieht auch dann
vollständig aus.

So sieht eine Vorlage aus, bevor sie verschickt wird:

```bash
npm run vorlage:vorschau -- vorlagen/coocazoo-colour-up.html vorschau.html
```

Das läuft durch dieselbe Strecke wie eine echte Mail — Platzhalter füllen,
sanitisieren, Abmeldelink prüfen. Was dabei herauskommt, ist genau das, was
der Empfänger bekommt.

## Platzhalter in Mails

| Platzhalter | Wird ersetzt durch |
| --- | --- |
| `{{anrede}}` | „Sehr geehrte Frau Müller" · „Sehr geehrter Herr Schmitz" · ohne Angabe „Guten Tag Anna Müller" |
| `{{anrede_kurz}}` | „Hallo Anna" |
| `{{vorname}}` · `{{nachname}}` | Name des Kunden |
| `{{stadt}}` · `{{plz}}` | Anschrift |
| `{{produkt}}` · `{{warengruppe}}` | letzter Kauf |
| `{{kaufdatum}}` · `{{saison}}` | Datum und Einschulungsjahrgang des letzten Kaufs |
| `{{abmeldelink}}` | persönlicher Abmeldelink (Pflicht) |
| `{{content}}` | nur in Vorlagen: Platz für den Kampagnentext |

Die Werte kommen aus **einer** Stelle (`src/lib/mail-vars.ts`) — für den
Versand, die Testmail und die Vorschau. Vorher stand dieselbe Zuordnung
dreimal im Code und lief auseinander: die Vorschau zeigte fest „Anna
Beispiel", egal welcher Kunde gemeint war.

Für die Anrede braucht es das Geschlecht; es steht als Feld am Kunden
(*Frau*, *Herr*, *keine Angabe*) und wird beim Import aus einer Spalte
*Anrede* gelesen. Geraten wird nichts — aus einem Vornamen auf das Geschlecht
zu schließen geht bei Kim, Andrea oder Toni schief.

Jeder bekannte Platzhalter bekommt beim Versand einen Wert, notfalls einen
leeren. Sonst stünde beim Empfänger wörtlich `{{vorname}}` in der Mail — was
passierte, wenn ein Kunde zwischen Einreihen und Versand gelöscht wurde.

## Mailtauglichkeit

Was im Browser gut aussieht, kommt in einem Mailprogramm nicht automatisch an.
Gmail entfernt `<html>`, `<head>` und `<body>`, kürzt Nachrichten ab etwa
102 KB und zeigt eingebettete Bilder (`data:`) gar nicht; Outlook rendert mit
Word und kennt weder `overflow` noch zuverlässig `background` im style-Attribut.

`src/lib/mail-check.ts` prüft eine Vorlage darauf und zeigt die Befunde direkt
im Editor, solange sich noch etwas ändern lässt:

- **Fehler**: Nachricht über 102 KB · eingebettete Bilder · Text hinter `</body>` ·
  Schrift steht nur am `<body>`
- **Hinweis**: nahe an der Grenze · `<style>`-Block · `position`, `float`,
  `background-image`, negative Abstände · Bilder ohne `width` oder Alternativtext ·
  farbige Zellen ohne `bgcolor`

Für die mitgelieferten Vorlagen ist die Prüfung Teil der Testsuite — eine
Verschlechterung fällt damit auf, bevor jemand die Mail vor sich hat.

### Bildablage

Ein Bild, das als `data:`-URI im HTML steckt, kommt bei Gmail nicht an: Gmail
zeigt solche Bilder nicht, und Base64 bläht die Nachricht so weit auf, dass
Gmail sie ab etwa 102 KB abschneidet — samt Abmeldelink darunter.

Deshalb nimmt die Anwendung eingebettete Bilder **beim Speichern** aus dem
HTML heraus (`src/lib/mail-images.ts`), legt sie in `mail_image` ab und setzt
an ihre Stelle die Adresse `APP_URL/bilder/<id>.<endung>`. Gleiche Bilder
werden über ihre Prüfsumme erkannt und nur einmal gespeichert. Wer den Umweg
gar nicht erst gehen will, nimmt im Editor **„Bild einfügen"** — die Datei
landet direkt in der Ablage und im Text steht sofort ein `<img>` mit `width`
und Alternativtext.

`/bilder/…` ist bewusst ohne Anmeldung erreichbar: das Mailprogramm des
Empfängers hat keine Sitzung. Die Kennung ist eine cuid, und ausgeliefert wird
nur, was ohnehin in der versendeten Mail steht. Der Inhalt unter einer Adresse
ändert sich nie, deshalb darf beliebig lange zwischengespeichert werden.

> **Die Adresse muss von außen erreichbar sein.** Die Anwendung setzt
> `APP_URL` vor den Pfad. Solange für `schulranzen.gollenstede.app` kein
> DNS-Eintrag existiert, lädt kein Bild von dort — bei niemandem. Bis dahin
> Bilder auf der Website ablegen und deren Adresse eintragen.

## Rückmeldung und Ladezustand

Jede Änderung meldet sich: gespeichert, angelegt, gelöscht, wiederhergestellt,
abgebrochen, fehlgeschlagen. Die Meldung erscheint oben im Inhaltsbereich,
Erfolgsmeldungen blenden sich nach ein paar Sekunden aus, Fehler bleiben
stehen, bis sie weggeklickt werden.

Technisch liegt die Meldung in einem kurzlebigen Cookie (`src/lib/flash.ts`).
Das ist der einzige Weg, der für alle Aktionen dieser Anwendung funktioniert —
die meisten leiten um oder rufen nur `revalidatePath` auf und haben deshalb
keinen Rückgabewert, den ein Formular anzeigen könnte. Feldfehler in
Formularen bleiben davon unberührt: die gehören an das Feld.

Beim Laden zeigt die Anwendung, dass sie arbeitet: ein Seitenwechsel blendet
eine Ladeanzeige ein (`src/app/(app)/loading.tsx`), der angeklickte
Navigationseintrag bekommt einen Spinner, und Knöpfe, die eine Aktion
auslösen, beschriften sich um („Wird gespeichert…") und sperren sich — das
verhindert nebenbei Doppelklicks und damit doppelte Datensätze.

## Listen und Tabellen

Jede Tabelle der Oberfläche blättert seitenweise: Kunden, Produkte, Vorlagen,
Kampagnen, Benutzer, Mailkonten, Provider, Protokoll, Sitzungen, bisherige
Übernahmen — ebenso die Tabellen auf den Detailseiten (Käufe, Mailhistorie und
Änderungen einer Kundenakte, Empfänger und Fehlversuche einer Kampagne, frühere
Fassungen einer Vorlage).

Unter jeder Tabelle steht, welcher Ausschnitt gerade zu sehen ist
(„51–100 von 12.000"), daneben die **Seitengröße**: 10, 25, 50, 100 oder 200
Zeilen. Stehen mehrere Tabellen auf einer Seite, hat jede ihre eigene
Seitenzahl und ihre eigene Größe und stört die anderen nicht.

Beides steht in der URL und übersteht Filter, Sortierung und einen Reload. Die
zuletzt gewählte Größe merkt sich zusätzlich ein Cookie und gilt dann als
Vorgabe für alle übrigen Tabellen — einmal auf 100 gestellt, bleibt es dabei.
Die Adresse sticht dabei immer die gemerkte Wahl, damit ein geteilter Link
zeigt, was der Absender gesehen hat.

Die Auswahl ist bewusst eine feste Liste (`src/lib/pagination.ts`). Ein freies
Feld ließe `?proSeite=999999` zu — und damit holte die Kundenliste zwölftausend
Datensätze auf einmal. Werte außerhalb der Liste werden verworfen, in der URL
wie im Cookie.

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
| Verwaltung | Mailkonten und Provider · Daten importieren · Protokoll einsehen · Benutzer verwalten |

Vier Vorlagen füllen die Auswahl vor: *Vollzugriff*, *Sachbearbeitung*
(bereitet Mails vor, gibt sie aber nicht frei), *Versand* und *Nur Lesen*.

Abhängige Rechte werden automatisch ergänzt — wer bearbeiten darf, darf auch
ansehen. So entsteht kein Konto, das eine Seite öffnen kann, auf der es nichts
sieht.

Durchgesetzt wird zweifach: die Oberfläche blendet aus, was nicht erlaubt ist,
und **jede Server Action und jede Seite prüft zusätzlich serverseitig**. Auf die
Oberfläche allein verlässt sich nichts — der Katalog steht in
`src/lib/permissions.ts`.

## Protokoll

Unter **Einstellungen → Protokoll** stehen zwei Bereiche.

**Änderungen** beantwortet „wer hat wann was getan". Jede Server Action, die
etwas schreibt, hinterlässt einen Eintrag mit Benutzer, IP, Objektart,
Kennung und den tatsächlich geänderten Feldern (`von → auf`, nicht der ganze
Datensatz). Anmeldung, fehlgeschlagene Anmeldung und Abmeldung kommen aus
`src/lib/auth.ts` dazu.

Gefiltert wird nach Benutzer, Aktion, Objektart, Zeitraum und Objekt-Kennung —
alles gleichzeitig und alles in der Adresse, die Ansicht lässt sich also
weitergeben. Der Weg des Administrators führt über
**Einstellungen → Benutzer → Protokoll**: das ist derselbe Filter, direkt auf
eine Person gesetzt. Ein Klick auf eine Objekt-Kennung zeigt alles, was mit
diesem einen Datensatz passiert ist.

Dass wirklich *jede* Änderung ankommt, hält
[`protokoll-vollstaendigkeit.test.ts`](./src/lib/__tests__/protokoll-vollstaendigkeit.test.ts)
fest: die Prüfung liest den Quelltext aller Server Actions und verlangt zu
jeder einen `recordAudit`-Aufruf. Ausnahmen brauchen einen Eintrag samt
Begründung — ein fehlender Protokolleintrag fällt sonst niemandem auf.

**Anwendung** beantwortet „was hat die Anwendung selbst gemeldet": Versand-
versuche, die endgültig scheiterten, Verbindungsprüfungen, die nicht
durchkamen, abgebrochene Übernahmen, hängengebliebene Versandaufträge nach
einem Neustart und Fehler beim Aufbau einer Seite. Gefiltert wird nach Ebene
(Fehler · Warnung · Information), Quelle, Zeitraum und Text der Meldung; zu
jedem Eintrag stehen Zusatzangaben und, bei Fehlern, die Aufrufliste.

Geschrieben wird über `src/lib/log.ts`. Die Einträge landen zusätzlich auf der
Konsole — wer beim Betrieb zusieht, soll nicht in die Oberfläche wechseln
müssen. Umgekehrt reicht die Konsole allein nicht: ihre Ausgabe ist nach dem
nächsten Neustart des Containers weg, und niemand liest sie.

Aufgeräumt wird automatisch: der Versand-Worker löscht einmal pro Stunde, was
älter ist als `LOG_RETENTION_DAYS` (Vorgabe 90 Tage). Ein Versandlauf mit
mehreren tausend Empfängern kann sonst schnell tausende Zeilen hinterlassen.

> Ein fehlgeschlagener Protokolleintrag kippt nie die Aktion, die ihn ausgelöst
> hat. Er wird dann selbst gemeldet — im jeweils anderen Protokoll.

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
npm test                      # 218 Tests: Normalisierung, Mailaufbau, Export,
                              # SMTP-Fehler, Rechte, Import, Versandstrecke
npm run typecheck

# End-to-End im Browser gegen eine laufende Instanz
node scripts/smoke.mjs http://localhost:3000              # 25 Prüfungen
node scripts/permissions-check.mjs http://localhost:3000  # 16 Prüfungen
node scripts/import-check.mjs http://localhost:3000 legacy.dump  # 18 Prüfungen
# Die Browser-Prüfungen greifen auf denselben Auslieferungsstand zu, den der
# Server geladen hat — nach einem `npm run build` den Server neu starten,
# sonst passen Server- und Browser-Bundle nicht zusammen.
node scripts/pagination-check.mjs http://localhost:3000          # 24 Prüfungen
node scripts/feedback-check.mjs http://localhost:3000            # 17 Prüfungen
node scripts/auswahl-check.mjs http://localhost:3000             # 11 Prüfungen
node scripts/bilder-check.mjs http://localhost:3000              # 13 Prüfungen
node scripts/protokoll-check.mjs http://localhost:3000 \
  postgresql://…/testdatenbank                                   # 15 Prüfungen
node scripts/kategorie-check.mjs http://localhost:3000 \
  postgresql://…/testdatenbank                                   # 20 Prüfungen

# Beispieldateien gegen ihre Beschreibung prüfen (leert dabei den Bestand,
# deshalb nur gegen eine eigene Testdatenbank laufen lassen)
node scripts/beispieldaten-check.mjs http://localhost:3000 \
  postgresql://…/testdatenbank                            # 46 Prüfungen
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
      einstellungen/  Konto, Mailkonten, Benutzer, Import, Protokoll
    login/            Anmeldung
    abmelden/[token]/ öffentliche Abmeldeseite
    api/              Export, Health, Fortschritt
  lib/
    auth.ts           Sitzungen, Rechteprüfung, Rate-Limit
    flash.ts          zentrale Rückmeldung nach jeder Änderung
    season.ts         Einschulungsjahrgang aus dem Kaufdatum
    pagination.ts     Seite und Seitengröße aus URL, Cookie und Vorgabe
    mail-check.ts     prüft Vorlagen auf das, woran Mailprogramme scheitern
    permissions.ts    Rechtekatalog, Vorlagen, abhängige Rechte
    audit.ts          Änderungsprotokoll: wer hat was getan
    log.ts            Anwendungsprotokoll: was die Anwendung meldet
    crypto.ts         Passwort-Hash (scrypt), AES-256-GCM
    queue.ts          Empfänger einreihen, Fortschritt, Wiederholung
    worker.ts         Versand-Worker (FOR UPDATE SKIP LOCKED)
    mailer.ts         Transport, Fehlerdeutung, Abmelde-Token
    template.ts       Platzhalter, Sanitisierung, Mailaufbau
    customer-filter.ts Filter → Prisma-Bedingung
    export.ts         CSV-Streaming und XLSX
    import/           Übernahme aus dem Altsystem, CSV/Excel-Import
scripts/
  seed.ts                 erster Administrator + Standard-Provider
  testdaten.ts            Testdaten anlegen und entfernen
  smoke.mjs               End-to-End-Test im Browser
  permissions-check.mjs   prüft die Rechte am laufenden System
  import-check.mjs        prüft beide Importwege am laufenden System
  beispieldaten.ts        erzeugt die Beispieldateien
  beispieldaten-check.mjs prüft die Beispieldateien gegen ihre Beschreibung
  pagination-check.mjs    prüft, dass jede Tabelle seitenweise blättert
  feedback-check.mjs      prüft Rückmeldungen und Ladezustand
  auswahl-check.mjs       prüft, dass die Kundenauswahl das Blättern übersteht
  bilder-check.mjs        prüft die Bildablage für Mails
  protokoll-check.mjs     prüft Änderungs- und Anwendungsprotokoll
  kategorie-check.mjs     prüft Warengruppen und Saison
  gross-check.mjs         Import mit 12.600 Zeilen am laufenden System
  vorlage-vorschau.ts     rendert eine Vorlage wie beim Versand
  etl/import.ts           Übernahme aus dem Altsystem (Kommandozeile)
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

## Import und Testdaten

In der Anwendung unter **Einstellungen → Import**:

- **Übernahme aus dem Altsystem** — Dump hochladen oder Direktverbindung
  angeben, erst Trockenlauf mit Bericht, dann Übernahme
- **Kunden aus CSV oder Excel** — Spalten werden erraten und lassen sich
  korrigieren, Vorschau vor dem Schreiben

Testdaten für Schulung und Abnahme:

```bash
npm run testdaten          # anlegen (wiederholbar)
npm run testdaten -- --weg # wieder entfernen
npm run beispieldaten      # Beispieldateien zum Ausprobieren des Imports
```

Die Beispieldateien liegen unter [`beispieldaten/`](./beispieldaten/) — eine
saubere Kundenliste als CSV und als Excel-Mappe, eine bewusst unbequeme Datei
mit den üblichen Stolperstellen und ein Abzug im Schema des Altsystems.

Alle Einzelheiten in [MIGRATION.md](./MIGRATION.md).
