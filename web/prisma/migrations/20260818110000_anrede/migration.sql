-- Anrede am Kunden.
--
-- {{anrede}} lieferte bisher „Hallo Vorname Nachname" — fuer eine Sie-Ansprache
-- die falsche Form, und ohne Geschlecht laesst sich „Sehr geehrte Frau …" gar
-- nicht bilden. Geraten wird nichts: Bestandskunden bekommen UNBEKANNT und
-- damit eine neutrale Anrede, bis jemand die Angabe nachtraegt.

CREATE TYPE "Salutation" AS ENUM ('FRAU', 'HERR', 'UNBEKANNT');

ALTER TABLE "customer"
  ADD COLUMN "salutation" "Salutation" NOT NULL DEFAULT 'UNBEKANNT';
