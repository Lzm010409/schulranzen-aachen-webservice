-- Kategorie als Stammdaten, Saison an den Kauf.
--
-- Die alten Freitextfelder product.category und product.season werden nicht
-- verworfen, sondern uebernommen:
--   * aus jedem vorkommenden category-Text entsteht eine Warengruppe,
--     ueber einen normalisierten Schluessel zusammengefasst;
--   * aus season wird das Modelljahr, soweit eine Jahreszahl darin steht;
--   * purchase.season wird aus dem Kaufdatum abgeleitet.
--
-- Der Schluessel ist derselbe wie in lib/normalize.ts (klein, Umlaute
-- ausgeschrieben, alles uebrige zu Bindestrichen). Er steht hier ausgeschrieben
-- statt als Funktion, damit die Uebernahme ohne Anwendungscode auskommt und
-- keine dollar-quoted Bloecke enthaelt.

-- ------------------------------------------------------------ Warengruppen
CREATE TABLE "product_category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_category_slug_key" ON "product_category"("slug");
CREATE INDEX "product_category_active_idx" ON "product_category"("active");

INSERT INTO "product_category" ("id", "name", "slug", "sortOrder", "active", "updatedAt")
SELECT
  gen_random_uuid()::TEXT,
  -- Als Anzeigename die haeufigste Schreibweise nehmen.
  (array_agg(name ORDER BY cnt DESC, name))[1],
  slug,
  0,
  true,
  now()
FROM (
  SELECT
    trim("category") AS name,
    trim(BOTH '-' FROM regexp_replace(
      replace(replace(replace(replace(
        lower(trim("category")),
      'ä','ae'), 'ö','oe'), 'ü','ue'), 'ß','ss'),
      '[^a-z0-9]+', '-', 'g'
    )) AS slug,
    count(*) AS cnt
  FROM "product"
  WHERE "category" IS NOT NULL AND trim("category") <> ''
  GROUP BY trim("category")
) AS vorkommen
WHERE slug <> ''
GROUP BY slug;

-- ---------------------------------------------------------------- Produkt
ALTER TABLE "product" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "product" ADD COLUMN "modelYear" INTEGER;

UPDATE "product" p
SET "categoryId" = c."id"
FROM "product_category" c
WHERE p."category" IS NOT NULL
  AND trim(BOTH '-' FROM regexp_replace(
        replace(replace(replace(replace(
          lower(trim(p."category")),
        'ä','ae'), 'ö','oe'), 'ü','ue'), 'ß','ss'),
        '[^a-z0-9]+', '-', 'g'
      )) = c."slug";

-- Aus "2026", "Saison 2026" oder "2025/26" wird das Modelljahr; alles andere
-- ergibt keine Zahl und bleibt leer.
UPDATE "product"
SET "modelYear" = (substring("season" FROM '\d{4}'))::INTEGER
WHERE "season" ~ '\d{4}'
  AND (substring("season" FROM '\d{4}'))::INTEGER BETWEEN 1990 AND 2100;

ALTER TABLE "product" DROP COLUMN "category";
ALTER TABLE "product" DROP COLUMN "season";

ALTER TABLE "product"
  ADD CONSTRAINT "product_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "product_category"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "product_categoryId_idx" ON "product"("categoryId");

-- ------------------------------------------------------------------ Kauf
ALTER TABLE "purchase" ADD COLUMN "season" INTEGER;

-- Dieselbe Regel wie lib/season.ts: ab September zaehlt der Kauf zur
-- Einschulung des Folgejahres.
UPDATE "purchase"
SET "season" = CASE
  WHEN EXTRACT(MONTH FROM "purchasedAt") >= 9
    THEN EXTRACT(YEAR FROM "purchasedAt")::INTEGER + 1
  ELSE EXTRACT(YEAR FROM "purchasedAt")::INTEGER
END
WHERE "purchasedAt" IS NOT NULL
  AND EXTRACT(YEAR FROM "purchasedAt") BETWEEN 1990 AND 2100;

CREATE INDEX "purchase_season_idx" ON "purchase"("season");
