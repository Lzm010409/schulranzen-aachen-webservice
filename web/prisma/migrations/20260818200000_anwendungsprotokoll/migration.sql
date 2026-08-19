-- Anwendungsprotokoll.
--
-- Das Aenderungsprotokoll haelt fest, wer was getan hat. Diese Tabelle haelt
-- fest, was die Anwendung selbst gemeldet hat — fehlgeschlagene Versand-
-- versuche, abgebrochene Uebernahmen, Fehler beim Aufbau einer Seite. Auf der
-- Konsole waere das nach dem naechsten Neustart des Containers weg.
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

CREATE TABLE "app_log" (
    "id" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "stack" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_log_pkey" PRIMARY KEY ("id")
);

-- Gelesen wird fast immer nach Zeit, oft eingegrenzt auf Ebene oder Quelle.
CREATE INDEX "app_log_createdAt_idx" ON "app_log"("createdAt");
CREATE INDEX "app_log_level_createdAt_idx" ON "app_log"("level", "createdAt");
CREATE INDEX "app_log_source_createdAt_idx" ON "app_log"("source", "createdAt");

ALTER TABLE "app_log" ADD CONSTRAINT "app_log_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Das Aenderungsprotokoll wird jetzt auch nach Benutzer und nach Aktion
-- gefiltert; ohne Index laeuft das bei ein paar hunderttausend Zeilen in einen
-- vollstaendigen Durchlauf.
CREATE INDEX "audit_log_userId_createdAt_idx" ON "audit_log"("userId", "createdAt");
CREATE INDEX "audit_log_action_createdAt_idx" ON "audit_log"("action", "createdAt");
