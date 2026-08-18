-- Bildablage fuer Mails.
--
-- Eingebettete Bilder (data:-URI) zeigt Gmail nicht an und sie sprengen das
-- Groessenlimit von etwa 102 KB, ab dem Gmail die Nachricht abschneidet.
-- Die Bytes liegen deshalb hier und die Mail verweist auf APP_URL/bilder/....
CREATE TABLE "mail_image" (
    "id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "filename" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "mail_image_pkey" PRIMARY KEY ("id")
);

-- Dasselbe Bild soll nur einmal liegen, egal wie oft es eingefuegt wird.
CREATE UNIQUE INDEX "mail_image_sha256_key" ON "mail_image"("sha256");

ALTER TABLE "mail_image" ADD CONSTRAINT "mail_image_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
