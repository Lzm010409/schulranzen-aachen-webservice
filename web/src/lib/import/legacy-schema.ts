/**
 * Hilfsschema fuer den Import aus dem Altsystem.
 *
 * Bewusst als Zeichenkette und nicht als .sql-Datei: der gebuendelte Server
 * bringt keine Dateien aus dem Quellbaum mit, ein Lesen zur Laufzeit wuerde
 * dort fehlschlagen.
 *
 * Der Dump des Vaadin-Systems wird in das Schema `legacy` eingespielt. Der
 * Rohbestand bleibt danach zur Kontrolle liegen und wird nie veraendert.
 * Die Spaltennamen entsprechen dem, was Hibernate 5.6 (Spring Boot 2.7) aus
 * den Entities erzeugt hat.
 */
export const LEGACY_SCHEMA_SQL = `-- Hilfsschema fuer den Import aus dem Altsystem.
--
-- Der Dump des Vaadin-Systems wird in das Schema \`legacy\` eingespielt. Der
-- Rohbestand bleibt danach zur Kontrolle liegen und wird nie veraendert.
--
-- Die Spaltennamen entsprechen dem, was Hibernate 5.6 (Spring Boot 2.7) aus
-- den Entities erzeugt hat.

CREATE SCHEMA IF NOT EXISTS legacy;

CREATE TABLE IF NOT EXISTS legacy.product (
  id           bigint PRIMARY KEY,
  product_name varchar(255)
);

CREATE TABLE IF NOT EXISTS legacy.kunde (
  id         bigint PRIMARY KEY,
  vorname    varchar(255),
  nachname   varchar(255),
  adresse    varchar(255),
  plz        varchar(255),
  stadt      varchar(255),
  kaufdatum  date,
  mail       varchar(255),
  tel        varchar(255),
  product_id bigint
);

CREATE TABLE IF NOT EXISTS legacy.provider (
  id            bigint PRIMARY KEY,
  provider_name varchar(255),
  smtp_host     varchar(255),
  smtp_port     varchar(255)
);

CREATE TABLE IF NOT EXISTS legacy.mail_template (
  id      bigint PRIMARY KEY,
  name    varchar(255),
  subject varchar(255),
  body    text,
  html    boolean
);
`;
