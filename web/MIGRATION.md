# Datenübernahme aus dem Vaadin-Altsystem

Die Übernahme ist **wiederholbar** und **trockenlauffähig**. Jeder übernommene
Datensatz merkt sich seine alte ID (`legacyId`); ein zweiter Durchlauf
aktualisiert, statt zu verdoppeln. Geschrieben wird in einer einzigen
Transaktion — bricht etwas ab, bleibt die neue Datenbank unverändert.

---

## Weg A — über einen Dump (empfohlen)

Kein Netzweg zwischen alt und neu nötig.

### 1. Auf dem Altsystem

```bash
pg_dump -Fc --data-only --schema=public \
  -t kunde -t product -t provider -t mail_template \
  -U <benutzer> <datenbank> > legacy.dump
```

`-Fc` (Custom-Format) wird empfohlen; ein reiner SQL-Dump funktioniert
ebenfalls.

### 2. Datei zum neuen System bringen

```bash
# in den laufenden Coolify-Container kopieren
docker cp legacy.dump <container>:/tmp/legacy.dump
```

### 3. Trockenlauf

```bash
docker exec -it <container> npm run etl:import -- \
  --dump /tmp/legacy.dump --dry-run
```

Es wird nichts geschrieben. Der Bericht zeigt, was passieren würde:
Mengengerüst alt gegen neu, alle Zusammenführungen und jede Auffälligkeit
mit der alten Datensatz-ID.

**Bitte den Bericht ansehen, bevor es weitergeht** — besonders die
zusammengeführten Kunden und die aussortierten E-Mail-Adressen.

### 4. Übernahme

```bash
docker exec -it <container> npm run etl:import -- \
  --dump /tmp/legacy.dump --report /tmp/uebernahme.md
docker cp <container>:/tmp/uebernahme.md .
```

Der Rohbestand liegt danach unverändert im Schema `legacy` der neuen
Datenbank — jederzeit nachprüfbar:

```sql
SELECT * FROM legacy.kunde WHERE id = 4711;
```

---

## Weg B — direkt von Datenbank zu Datenbank

Für Wiederholungsläufe während der Parallelphase. Ein Lesezugriff genügt:

```sql
-- auf dem Altsystem
CREATE USER migration WITH PASSWORD '…';
GRANT CONNECT ON DATABASE <datenbank> TO migration;
GRANT USAGE ON SCHEMA public TO migration;
GRANT SELECT ON kunde, product, provider, mail_template TO migration;
```

```bash
LEGACY_DATABASE_URL="postgresql://migration:…@alt-host:5432/datenbank" \
  npm run etl:import -- --direct --dry-run
```

---

## Was dabei passiert

### Produkte

Namen werden normalisiert (Kleinschreibung, Umlaute aufgelöst, Leerzeichen
verdichtet). Gleichwertige Schreibweisen fallen zu einem Produkt zusammen.

```
"Ergobag Cubo" · "ergobag cubo" · "  Ergobag   Cubo  "   →  ein Produkt
```

Genau dieses Duplikatmuster entstand im Altsystem, weil die Freitext-Auswahl
im Kundenformular bei jedem Speichern einen neuen Datensatz anlegte.

### Kunden und Käufe

Das Altsystem hatte **eine Zeile je Kauf** — wer zweimal kaufte, stand zweimal
in der Tabelle. Das neue Modell trennt Person und Kauf:

```
kunde(10) "Anna Müller, Ergobag, 2023"  ┐
                                        ├→  Customer "Anna Müller"
kunde(12) "Anna Müller, Scout,   2025"  ┘      ├── Purchase Ergobag 2023
                                                └── Purchase Scout   2025
```

Zusammengeführt wird in dieser Reihenfolge:

1. **gleiche E-Mail-Adresse** (nach Normalisierung) — der verlässlichste Hinweis
2. **gleicher Name + PLZ + Straße** — greift auch, wenn eine Zeile keine
   Adresse hat

Jede Zusammenführung steht einzeln im Bericht.

### Feldbereinigung

| Feld | Regel |
| --- | --- |
| E-Mail | getrimmt, kleingeschrieben |
| Telefon | nach E.164: `0241 123456` → `+49241123456`; unklare Eingaben bleiben unverändert erhalten |
| PLZ | nur Ziffern, 5 Stellen: `D-52074` → `52074` |
| Namen, Adresse | getrimmt, mehrfache Leerzeichen verdichtet |

### Nichts geht verloren

- **Ungültige E-Mail-Adressen** werden nicht gelöscht, sondern in die Notiz des
  Kunden verschoben (`clara(at)example.de`) und im Bericht aufgeführt.
- **Eine zweite, abweichende Adresse** bei zusammengeführten Kunden landet
  ebenfalls in der Notiz.
- **Zeilen ohne jeden Namen** werden ausgelassen und einzeln im Bericht genannt.

### Provider

Host und Port werden übernommen. Die Verschlüsselung wird aus dem Port
abgeleitet:

| Port | Verschlüsselung |
| --- | --- |
| 465 | SSL/TLS durchgängig |
| 587, 25 | STARTTLS |

Das Altsystem setzte pauschal `starttls.enable=true` — auch auf Port 465, wo
das nicht zusammenpasst. Bitte nach der Übernahme einmal unter
**Einstellungen → Mailkonten** die Verbindung prüfen.

### Vorlagen

Werden unverändert übernommen. Der alte Platzhalter `{Content}` wird auf die
neue Schreibweise `{{content}}` gebracht.

### Was **nicht** übernommen wird

- **SMTP-Passwörter.** Das Altsystem hielt sie im Klartext in der Sitzung; sie
  stehen nicht in der Datenbank. Sie sind unter **Einstellungen → Mailkonten**
  neu zu hinterlegen.
- **Benutzerkonten.** Es gab keine — die Anwendung war ungeschützt.

---

## Nach der Übernahme — Checkliste

1. Bericht durchsehen, besonders die zusammengeführten Kunden.
2. Anzahl abgleichen: `SELECT count(*) FROM legacy.kunde;` gegen
   `SELECT count(*) FROM purchase;` — die Zahlen müssen bis auf die im Bericht
   genannten ausgelassenen Zeilen übereinstimmen.
3. Stichprobe: zwei, drei Kunden im UI öffnen und mit dem Altsystem vergleichen.
4. SMTP-Konto hinterlegen und **Verbindung prüfen** klicken.
5. Eine Testkampagne an die eigene Adresse senden.
6. Erst danach das Altsystem abschalten.

---

## Erneut ausführen

Der Import ist idempotent. Bei einer weiteren Übernahme (etwa nach ein paar
Tagen Parallelbetrieb) einfach denselben Befehl erneut ausführen — bereits
übernommene Datensätze werden aktualisiert, neue kommen hinzu.

> Änderungen, die **im neuen System** an übernommenen Datensätzen gemacht
> wurden, überschreibt ein erneuter Lauf mit dem Stand des Altsystems.
> Deshalb: während der Parallelphase im Altsystem pflegen, oder umgekehrt —
> aber nicht in beiden.

Jeder Lauf wird in der Tabelle `migration_run` protokolliert, samt
vollständigem Bericht im Feld `report`.
