# Beispieldateien

Zum Ausprobieren der Importfunktionen unter **Einstellungen → Import**.
Erzeugt mit `npm run beispieldaten`.

| Datei | Wofür |
| --- | --- |
| `kunden-standard.csv` | Der Normalfall: deutsche Überschriften, Semikolon, UTF-8 mit BOM — so schreibt Excel. 12 Zeilen, davon zwei Paare derselben Person mit je zwei Käufen. |
| `kunden-standard.xlsx` | Dieselben Daten als Excel-Mappe. |
| `kunden-problemfaelle.csv` | Absichtlich unbequem — siehe unten. |
| `altsystem-export.sql` | Datenabzug im Schema der alten Vaadin-Anwendung, für die Übernahme aus dem Altsystem. |

## kunden-standard.csv

12 Zeilen, 10 Personen. Anna Berger und Christina Dahmen stehen je zweimal
drin — daraus werden **zwei Kunden mit je zwei Käufen**, nicht vier Kunden.
Jonas Königs hat kein Produkt und kein Kaufdatum: ein Interessent ohne Kauf.

Die Spalte **Warengruppe** wird beim Import mit angelegt; Käufe bekommen ihre
**Saison** (Einschulungsjahrgang) automatisch aus dem Kaufdatum. Ein Kauf im
September oder später zählt zur Einschulung des Folgejahres — deshalb landet
Ines Jansen mit dem 03.09.2021 in der Saison 2022.

## kunden-problemfaelle.csv

Deckt die Fälle ab, an denen ein Import sonst stolpert:

| Zeile | Besonderheit | Erwartetes Verhalten |
| --- | --- | --- |
| 2 | Leerzeichen um Namen und Mail, Mail in Großbuchstaben, PLZ `D-52064` | wird getrimmt, kleingeschrieben, PLZ zu `52064` |
| 2, 3 | dieselbe Person, einmal mit und einmal ohne Mailadresse | ein Kunde mit zwei Käufen |
| 3 | Kaufdatum `45518` (Excel-Serienzahl) | wird als 14.08.2024 gelesen |
| 4 | `miriam(at)example.de` | keine gültige Adresse — wandert in die Notiz, Zeile bleibt erhalten |
| 5 | Kaufdatum `demnächst`, Adresse mit Anführungszeichen | Kauf ohne Datum, Hinweis im Bericht |
| 6 | komplett leere Zeile | wird still übersprungen |
| 7 | keine Namen | wird ausgelassen und im Bericht genannt |
| 8 | unbekanntes Produkt | wird neu angelegt |
| 2 | Anrede `Hr.` | wird als „Herr“ gelesen |
| 5 | Anrede `Firma` | lässt sich nicht zuordnen — bleibt ohne Angabe, statt zu raten |

Außerdem: **Komma** statt Semikolon, **kein BOM**, **englische Überschriften**
und eine Spalte `E-Mail-Adresse` direkt neben `Adresse` — die Spaltenerkennung
darf die beiden nicht verwechseln.

## altsystem-export.sql

Neun Zeilen im alten Modell „ein Kunde hat genau ein Produkt“. Daraus werden
**sechs Kunden mit acht Käufen**:

- Zeile 10 und 12 sind Anna Müller (gleiche Mail, zwei Produkte)
- Zeile 11 und 13 sind Bernd Schmitz — die zweite ohne Mailadresse, erkannt
  über Name und Anschrift
- Zeile 17 hat keinen Namen und wird ausgelassen
- Produkt 1, 4 und 5 sind Schreibvarianten desselben Artikels und fallen
  zu einem Produkt zusammen
- die Saison wird aus dem Kaufdatum abgeleitet; das Altsystem kannte sie nicht

Der Abzug ist bewusst vollqualifiziert (`public.kunde`), damit sich prüfen
lässt, dass der Import ihn in das Schema `legacy` umlenkt und die Tabellen
der neuen Anwendung nicht anfasst.

> Zum Ausprobieren am besten **erst den Trockenlauf** — er schreibt nichts und
> zeigt im Bericht, was passieren würde.

## Nachgeprüft

Alles, was oben steht, prüft `node scripts/beispieldaten-check.mjs` gegen eine
laufende Instanz nach — jede Datei auf leerem Bestand, danach der Abgleich in
der Datenbank.

## Aufräumen

Die eingespielten Beispielkunden lassen sich in der Kundenliste über den
Filter finden und einzeln löschen. Für einen sauberen Neuanfang in einer
Testumgebung:

```bash
npm run testdaten -- --weg   # entfernt nur die Datensätze aus npm run testdaten
```
