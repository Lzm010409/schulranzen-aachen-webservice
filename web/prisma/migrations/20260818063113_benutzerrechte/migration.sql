-- AlterTable
ALTER TABLE "user" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Bestandskonten nicht aussperren: vorhandene Mitarbeiter erhalten die Rechte
-- der Vorlage "Sachbearbeitung" (siehe src/lib/permissions.ts). Administratoren
-- brauchen keine Eintraege, sie haben ohnehin alle Rechte.
UPDATE "user"
   SET "permissions" = ARRAY[
         'kunden.ansehen',
         'kunden.bearbeiten',
         'kunden.exportieren',
         'produkte.ansehen',
         'produkte.verwalten',
         'vorlagen.ansehen',
         'vorlagen.verwalten',
         'kampagnen.ansehen',
         'kampagnen.erstellen'
       ]::TEXT[]
 WHERE "role" = 'MITARBEITER'
   AND ("permissions" IS NULL OR cardinality("permissions") = 0);
